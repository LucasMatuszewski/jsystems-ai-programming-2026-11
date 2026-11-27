import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { appendDecisionLog, toDecisionLogEntry } from "@/server/ai/log/decision-log"

// Synthetic, customer-like strings: none of them may reach the decision log.
const CUSTOMER_REASON =
  "Ekran pękł po upuszczeniu laptopa na podłogę w kuchni, klientka prosi o szybki zwrot pieniędzy"
const CUSTOMER_DEVICE_MODEL = "Lenovo ThinkPad T14 Gen 4 (synt-0042-zz)"
const IMAGE_DATA_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAAQABAAD2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/"

const pipeline = {
  caseType: "complaint" as const,
  category: "laptop",
  daysSincePurchase: 41,
  reason: CUSTOMER_REASON,
  model: CUSTOMER_DEVICE_MODEL,
  image: IMAGE_DATA_URL,
  signals: {
    status: "ok" as const,
    answers: {
      damage_visible: {
        value: true,
        confidence: 0.93,
        probabilities: { true: 0.93, false: 0.07 },
      },
      damage_type: {
        value: "screen_defect",
        confidence: 0.88,
        probabilities: { screen_defect: 0.88, other: 0.12 },
      },
    },
    refusals: [],
    cost: 0.0021,
    durationMs: 812,
    reason: CUSTOMER_REASON,
  },
  decision: {
    decision: "Odrzucenie" as const,
    ruleRefs: ["R-2.1"],
    route: "escalated" as const,
    escalationReasons: ["damage_visible:confidence_below_threshold"],
    guardsApplied: ["R-2.4"],
    firstMessage: { greeting: "Dzień dobry", bodyMarkdown: "Treść wiadomości dla klientki." },
  },
  promptVersions: { "decision-escalated": "v3", writer: "v2" },
  modelIds: { escalated: "openai/gpt-6-luna", signals: "openai/gpt-6-luna-decisions" },
  durations: { signalsMs: 812, escalatedMs: 4310 },
  cost: 0.0187,
}

const ALLOWED_KEYS = [
  "timestamp",
  "caseType",
  "category",
  "daysSincePurchase",
  "signals",
  "route",
  "escalationReasons",
  "decision",
  "guardsApplied",
  "promptVersions",
  "modelIds",
  "durations",
  "cost",
].sort()

let tmp: string

beforeEach(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), "hsdc-decision-log-"))
})

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe("toDecisionLogEntry", () => {
  it("keeps only the allowed fields and drops customer text, device model and image data", () => {
    const entry = toDecisionLogEntry(pipeline, new Date("2026-11-26T10:00:00.000Z"))
    expect(Object.keys(entry).sort()).toEqual(ALLOWED_KEYS)
    expect(entry.timestamp).toBe("2026-11-26T10:00:00.000Z")
    expect(entry.signals.damage_type).toEqual({
      value: "screen_defect",
      confidence: 0.88,
      probabilities: { screen_defect: 0.88, other: 0.12 },
    })
    expect(entry.route).toBe("escalated")
    expect(entry.decision).toBe("Odrzucenie")
  })
})

describe("appendDecisionLog", () => {
  it("appends one JSON line per entry, creates the directory, and leaks no customer data", async () => {
    const file = path.join(tmp, "nested", "dir", "decision-log.jsonl")
    const entry = toDecisionLogEntry(pipeline, new Date("2026-11-26T10:00:00.000Z"))

    await appendDecisionLog(entry, file)
    await appendDecisionLog(entry, file)

    const lines = (await readFile(file, "utf8")).split("\n").filter(Boolean)
    expect(lines).toHaveLength(2)
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow()
      expect(line).not.toContain(CUSTOMER_REASON)
      expect(line).not.toContain("Ekran pękł")
      expect(line).not.toContain(CUSTOMER_DEVICE_MODEL)
      expect(line).not.toContain("data:image")
      expect(line).not.toContain("base64")
      expect(line).not.toContain("/9j/4AAQ")
      expect(line).not.toContain("Treść wiadomości")
    }
  })

  it("does not throw on a write failure and logs the error to the console", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const entry = toDecisionLogEntry(pipeline, new Date("2026-11-26T10:00:00.000Z"))
    // A directory path cannot be opened for appending.
    await mkdir(path.join(tmp, "is-a-directory"))
    await expect(appendDecisionLog(entry, path.join(tmp, "is-a-directory"))).resolves.toBeUndefined()
    expect(errorSpy).toHaveBeenCalled()
  })

  it("writes nothing when the path is an empty string (log disabled)", async () => {
    const entry = toDecisionLogEntry(pipeline, new Date("2026-11-26T10:00:00.000Z"))
    await expect(appendDecisionLog(entry, "")).resolves.toBeUndefined()
    const { readdir } = await import("node:fs/promises")
    expect(await readdir(tmp)).toEqual([])
  })
})
