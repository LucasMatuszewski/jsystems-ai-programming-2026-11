import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  SESSION_KEY,
  clearSession,
  deriveCurrentDecision,
  readMemorySession,
  readSession,
  rememberSessionInMemory,
  writeSession,
} from "@/lib/session-store"
import type { StoredSession } from "@/lib/schemas"
import { replayAppResponse } from "@/tests/helpers/replay-app"

const fixture = fileURLToPath(
  new URL("../../fixtures/app/cases/escalated-return-laptop-2.ndjson.json", import.meta.url),
)

async function recordedCase() {
  const body = await replayAppResponse(fixture).text()
  const result = body
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as { type: string; case?: unknown })
    .find((event) => event.type === "result")
  if (!result?.case) throw new Error("no result event in recording")
  return result.case as StoredSession["case"]
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
  }
}

function quotaStorage() {
  return {
    getItem: () => null,
    setItem: () => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError")
    },
    removeItem: () => {},
  }
}

describe("session store", () => {
  it("uses the versioned key from ADR-003 3.3", () => {
    expect(SESSION_KEY).toBe("hsdc.session.v1")
  })

  it("round-trips the recorded payload with the first message", async () => {
    const caseData = await recordedCase()
    const storage = memoryStorage()
    const session: StoredSession = { version: 1, case: caseData, messages: [caseData.firstMessage] }

    expect(writeSession(session, storage)).toEqual({ ok: true })
    expect(readSession(storage)).toEqual(session)
  })

  it("returns null without touching storage when nothing is stored", () => {
    const storage = memoryStorage()
    expect(readSession(storage)).toBeNull()
    expect(storage.data.size).toBe(0)
  })

  it("clears and returns null on corrupt JSON", () => {
    const storage = memoryStorage({ [SESSION_KEY]: "{not json" })
    expect(readSession(storage)).toBeNull()
    expect(storage.data.has(SESSION_KEY)).toBe(false)
  })

  it("clears and returns null on a wrong version", async () => {
    const caseData = await recordedCase()
    const storage = memoryStorage({
      [SESSION_KEY]: JSON.stringify({ version: 2, case: caseData, messages: [] }),
    })
    expect(readSession(storage)).toBeNull()
    expect(storage.data.has(SESSION_KEY)).toBe(false)
  })

  it("clears and returns null when the schema fails", () => {
    const storage = memoryStorage({ [SESSION_KEY]: JSON.stringify({ version: 1, messages: [] }) })
    expect(readSession(storage)).toBeNull()
    expect(storage.data.has(SESSION_KEY)).toBe(false)
  })

  it("reports a quota error without throwing", async () => {
    const caseData = await recordedCase()
    const session: StoredSession = { version: 1, case: caseData, messages: [caseData.firstMessage] }
    expect(writeSession(session, quotaStorage())).toEqual({ ok: false, reason: "quota" })
  })

  it("reports a non-quota storage error (blocked storage) as its own reason, not as a throw (T28 F6)", async () => {
    const caseData = await recordedCase()
    const session: StoredSession = { version: 1, case: caseData, messages: [caseData.firstMessage] }
    const blocked = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("The operation is insecure.", "SecurityError")
      },
      removeItem: () => {},
    }
    expect(writeSession(session, blocked)).toEqual({ ok: false, reason: "unavailable" })
  })

  it("keeps a session in memory when storage fails, and clearSession drops it (T28 F6)", async () => {
    const caseData = await recordedCase()
    const session: StoredSession = { version: 1, case: caseData, messages: [caseData.firstMessage] }
    expect(readMemorySession()).toBeNull()
    rememberSessionInMemory(session)
    expect(readMemorySession()).toEqual(session)
    clearSession(memoryStorage())
    expect(readMemorySession()).toBeNull()
  })

  it("clearSession removes the stored session", async () => {
    const caseData = await recordedCase()
    const storage = memoryStorage()
    writeSession({ version: 1, case: caseData, messages: [caseData.firstMessage] }, storage)
    clearSession(storage)
    expect(storage.data.has(SESSION_KEY)).toBe(false)
  })

  describe("deriveCurrentDecision", () => {
    it("returns the initial decision from the first message data part", async () => {
      const caseData = await recordedCase()
      const session: StoredSession = { version: 1, case: caseData, messages: [caseData.firstMessage] }

      expect(deriveCurrentDecision(session)).toEqual({
        decision: caseData.decision.decision,
        ruleRefs: caseData.decision.ruleRefs,
        source: "initial",
      })
    })

    it("returns the latest successful update_recommendation output appended after the base message", async () => {
      const caseData = await recordedCase()
      const initialDecision = caseData.decision.decision
      const session: StoredSession = {
        version: 1,
        case: caseData,
        messages: [
          caseData.firstMessage,
          {
            id: "user-1",
            role: "user",
            parts: [{ type: "text", text: "Mam zdjęcie z dowodem zakupu." }],
          },
          {
            id: "assistant-2",
            role: "assistant",
            parts: [
              { type: "text", text: "Dziękuję." },
              {
                type: "tool-update_recommendation",
                toolCallId: "call-1",
                state: "input-streaming",
                input: { decision: "Odrzucenie", reason: "w toku", ruleRefs: ["R-1"] },
              },
            ],
          },
          {
            id: "assistant-3",
            role: "assistant",
            parts: [
              {
                type: "tool-update_recommendation",
                toolCallId: "call-2",
                state: "output-available",
                input: { decision: "Akceptacja", reason: "dowód zakupu", ruleRefs: ["R-4"] },
                output: {
                  previousDecision: initialDecision,
                  newDecision: "Akceptacja",
                  reason: "dowód zakupu",
                  ruleRefs: ["R-4"],
                  updatedAt: "2026-11-26T12:00:00.000Z",
                },
              },
            ],
          },
        ],
      }

      expect(deriveCurrentDecision(session)).toEqual({
        decision: "Akceptacja",
        ruleRefs: ["R-4"],
        source: "update",
      })
    })

    it("ignores an update_recommendation part that has no output yet", async () => {
      const caseData = await recordedCase()
      const session: StoredSession = {
        version: 1,
        case: caseData,
        messages: [
          caseData.firstMessage,
          {
            id: "assistant-2",
            role: "assistant",
            parts: [
              {
                type: "tool-update_recommendation",
                toolCallId: "call-3",
                state: "input-available",
                input: { decision: "Odrzucenie", reason: "w toku", ruleRefs: ["R-1"] },
              },
            ],
          },
        ],
      }

      expect(deriveCurrentDecision(session)?.source).toBe("initial")
    })
  })
})
