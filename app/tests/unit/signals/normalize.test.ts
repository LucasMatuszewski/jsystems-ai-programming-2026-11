import { describe, expect, it } from "vitest"
import { normalizeDecisionAnswers } from "@/server/ai/signals/normalize"

// ADR-001 3.3 confidence rules, checked on boundary values over the internal
// answer types (A1: no success recording exists yet, so no real capture is used).

describe("normalizeDecisionAnswers: boolean", () => {
  it.each([
    [0.1, false, 0.9],
    [0.5, true, 0.5],
    [0.93, true, 0.93],
  ])("p=%s -> value %s, confidence %s", (p, value, confidence) => {
    const out = normalizeDecisionAnswers({
      photo_usable: { type: "boolean", probability: p },
    })
    expect(out.photo_usable!.value).toBe(value)
    expect(out.photo_usable!.confidence).toBeCloseTo(confidence, 10)
    expect(out.photo_usable!.probabilities).toEqual({
      true: p,
      false: 1 - p,
    })
  })

  it("ignores provider confidence for boolean answers (ADR-001 A1)", () => {
    const out = normalizeDecisionAnswers(
      { device_visible: { type: "boolean", probability: 0.93 } },
      { device_visible: { confidence: 0.2 } }
    )
    expect(out.device_visible!.confidence).toBeCloseTo(0.93, 10)
  })

  it("rejects a probability outside [0, 1]", () => {
    expect(() =>
      normalizeDecisionAnswers({
        photo_usable: { type: "boolean", probability: 1.2 },
      })
    ).toThrow()
  })
})

describe("normalizeDecisionAnswers: choice", () => {
  it("uses provider confidence when present", () => {
    const out = normalizeDecisionAnswers(
      {
        damage_type: {
          type: "choice",
          choice: "crack",
          probabilities: { none: 0.1, crack: 0.8, other: 0.1 },
        },
      },
      { damage_type: { confidence: 0.67 } }
    )
    expect(out.damage_type!.value).toBe("crack")
    expect(out.damage_type!.confidence).toBe(0.67)
    expect(out.damage_type!.probabilities).toEqual({
      none: 0.1,
      crack: 0.8,
      other: 0.1,
    })
  })

  it("falls back to the top probability without provider confidence", () => {
    const out = normalizeDecisionAnswers({
      damage_type: {
        type: "choice",
        choice: "crack",
        probabilities: { none: 0.1, crack: 0.8, other: 0.1 },
      },
    })
    expect(out.damage_type!.confidence).toBe(0.8)
  })

  it("fails closed to confidence 0 when neither confidence nor probabilities exist", () => {
    const out = normalizeDecisionAnswers({
      damage_location: { type: "choice", choice: "screen" },
    })
    expect(out.damage_location!.value).toBe("screen")
    expect(out.damage_location!.confidence).toBe(0)
    expect(out.damage_location!.probabilities).toEqual({ screen: 1 })
  })

  it("rejects an empty choice", () => {
    expect(() =>
      normalizeDecisionAnswers({ damage_cause: { type: "choice", choice: "" } })
    ).toThrow()
  })
})

describe("normalizeDecisionAnswers: score", () => {
  it("maps the top level to its 1-based level number with provider confidence", () => {
    const out = normalizeDecisionAnswers(
      {
        condition: {
          type: "score",
          score: 4.1,
          probabilities: { "0": 0.02, "1": 0.05, "2": 0.1, "3": 0.7, "4": 0.13 },
        },
      },
      { condition: { confidence: 0.7 } }
    )
    expect(out.condition!.value).toBe(4)
    expect(out.condition!.confidence).toBe(0.7)
    expect(out.condition!.probabilities).toEqual({
      "1": 0.02,
      "2": 0.05,
      "3": 0.1,
      "4": 0.7,
      "5": 0.13,
    })
  })

  it("uses the top level probability as confidence without provider confidence", () => {
    const out = normalizeDecisionAnswers({
      condition: {
        type: "score",
        score: 1.2,
        probabilities: { "0": 0.1, "1": 0.9 },
      },
    })
    expect(out.condition!.value).toBe(2)
    expect(out.condition!.confidence).toBe(0.9)
  })

  it("rounds the score when no distribution is given", () => {
    const out = normalizeDecisionAnswers({
      condition: { type: "score", score: 2.6 },
    })
    expect(out.condition!.value).toBe(4)
    expect(out.condition!.confidence).toBe(0)
  })

  it("rejects a non-finite score", () => {
    expect(() =>
      normalizeDecisionAnswers({
        condition: { type: "score", score: Number.NaN },
      })
    ).toThrow()
  })
})
