import { describe, expect, it, vi } from "vitest"
import type { DecisionSignals } from "@/lib/schemas"

vi.mock("server-only", () => ({}))

import { findingsFromSignals, NEUTRAL_FINDINGS } from "@/server/ai/pipeline/image-findings"

// Pure formatter (ADR-001 4.4): boundary values over the internal type; no endpoint involved.
const ans = (value: boolean | string | number, confidence = 0.95) => ({ value, confidence, probabilities: {} })

describe("findingsFromSignals", () => {
  it("returns neutral findings when signals are unavailable (A1)", () => {
    const s: DecisionSignals = { status: "unavailable", reason: "auth", answers: {}, refusals: [], cost: null, durationMs: 1 }
    expect(findingsFromSignals(s, 0.8)).toEqual(NEUTRAL_FINDINGS)
    expect(NEUTRAL_FINDINGS.photoQuality).toBe("limited")
    expect(NEUTRAL_FINDINGS.evidence).toEqual(["Zdjęcie nie zostało ocenione automatycznie."])
  })

  it("maps typed signals to Polish findings with confidence in the evidence", () => {
    const s: DecisionSignals = {
      status: "ok", refusals: [], cost: 0, durationMs: 1,
      answers: {
        photo_usable: ans(true), device_visible: ans(true), category_match: ans(true), damage_visible: ans(true),
        damage_type: ans("crack"), damage_location: ans("screen"), condition: ans(2), signs_of_use: ans(false),
        damage_cause: ans("user_caused"), description_consistent: ans(false),
      },
    }
    const f = findingsFromSignals(s, 0.8)
    expect(f).toMatchObject({ deviceVisible: true, categoryMatches: true, photoQuality: "good", likelyCause: "user_caused", contradictsDescription: true })
    expect(f.damage).toMatch(/pęknięcie/i)
    expect(f.evidence.some((e) => e.includes("0.95") || e.includes("95%"))).toBe(true)
  })

  it("marks photoQuality limited below the threshold and unusable when false", () => {
    const base = { status: "ok" as const, refusals: [], cost: 0, durationMs: 1 }
    expect(findingsFromSignals({ ...base, answers: { photo_usable: ans(true, 0.5) } }, 0.8).photoQuality).toBe("limited")
    expect(findingsFromSignals({ ...base, answers: { photo_usable: ans(false) } }, 0.8).photoQuality).toBe("unusable")
  })
})
