import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  normalizeDecisionAnswers,
  type ProviderAnswerMeta,
  type RawAnswer,
} from "@/server/ai/signals/normalize"

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

// Real recordings (2026-11-26, openai/gpt-6-luna-decisions): the SDK result plus the
// provider metadata carry the confidence of choice and score answers (ADR-001 A1).
describe("normalizeDecisionAnswers on the four real recordings", () => {
  type Recording = {
    meta: { request: { questionKeys: string[] } }
    sdkResult: {
      answers: Record<string, RawAnswer>
      providerMetadata: { openrouter: { answers: ProviderAnswerMeta } }
    }
  }
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../fixtures/openrouter/decisions")
  const load = (name: string) => JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), "utf8")) as Recording
  const names = ["return-laptop-2", "return-phone-1", "complaint-laptop-1", "complaint-phone-3"]

  it.each(names)("%s: every question normalized, confidence in [0, 1]", (name) => {
    const rec = load(name)
    const out = normalizeDecisionAnswers(rec.sdkResult.answers, rec.sdkResult.providerMetadata.openrouter.answers)
    expect(Object.keys(out).sort()).toEqual([...rec.meta.request.questionKeys].sort())
    for (const answer of Object.values(out)) {
      expect(answer.confidence).toBeGreaterThanOrEqual(0)
      expect(answer.confidence).toBeLessThanOrEqual(1)
    }
  })

  it("return-laptop-2: booleans, choice with provider confidence, score level is 1-based", () => {
    const rec = load("return-laptop-2")
    const out = normalizeDecisionAnswers(rec.sdkResult.answers, rec.sdkResult.providerMetadata.openrouter.answers)
    expect(out.device_visible).toMatchObject({ value: true, confidence: 1 })
    expect(out.damage_visible!.value).toBe(false)
    expect(out.damage_visible!.confidence).toBeCloseTo(0.97, 10)
    expect(out.damage_type).toMatchObject({ value: "none", confidence: 0.9 })
    // Recorded score 2.48 with top distribution index 2 -> level 3, provider confidence 0.58.
    expect(out.condition).toMatchObject({ value: 3, confidence: 0.58 })
    expect(out.description_consistent).toBeUndefined()
  })

  it("return-phone-1: description_consistent present and a cracked screen", () => {
    const rec = load("return-phone-1")
    const out = normalizeDecisionAnswers(rec.sdkResult.answers, rec.sdkResult.providerMetadata.openrouter.answers)
    expect(out.damage_type).toMatchObject({ value: "crack", confidence: 1 })
    expect(out.damage_location!.value).toBe("screen")
    expect(out.condition!.value).toBe(1)
    expect(out.description_consistent).toBeDefined()
  })

  it("complaint recordings: damage_cause is a choice with provider confidence", () => {
    const laptop = load("complaint-laptop-1")
    const phone = load("complaint-phone-3")
    const l = normalizeDecisionAnswers(laptop.sdkResult.answers, laptop.sdkResult.providerMetadata.openrouter.answers)
    const p = normalizeDecisionAnswers(phone.sdkResult.answers, phone.sdkResult.providerMetadata.openrouter.answers)
    expect(l.damage_cause).toMatchObject({ value: "user_caused", confidence: 0.97 })
    expect(p.damage_cause).toMatchObject({ value: "manufacturing_defect", confidence: 0.43 })
    // A zero provider confidence is kept as 0 (fail-closed), not replaced by the top probability.
    expect(p.condition).toMatchObject({ value: 5, confidence: 0 })
  })
})
