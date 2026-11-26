import { describe, expect, it, vi } from "vitest"
import type { Category, CaseType, DecisionSignals } from "@/lib/schemas"
import { evaluateFastPath } from "@/server/ai/logic/fast-path"

vi.mock("server-only", () => ({}))

function answer(value: boolean | string | number, confidence = 0.9) {
  return { value, confidence, probabilities: {} }
}

function returnSignals(): DecisionSignals {
  return {
    status: "ok",
    answers: {
      photo_usable: answer(true),
      device_visible: answer(true),
      category_match: answer(true),
      damage_visible: answer(false),
      signs_of_use: answer(false),
      condition: answer(5),
      packaging_visible: answer(true),
    },
    refusals: [],
    cost: null,
    durationMs: 1,
  }
}

function complaintSignals(): DecisionSignals {
  return {
    status: "ok",
    answers: {
      photo_usable: answer(true),
      device_visible: answer(true),
      category_match: answer(true),
      damage_visible: answer(true),
      damage_type: answer("scratch_or_scuff"),
      damage_cause: answer("manufacturing_defect"),
    },
    refusals: [],
    cost: null,
    durationMs: 1,
  }
}

function evaluate(
  caseType: CaseType,
  signals: DecisionSignals,
  overrides: Partial<{
    category: Category
    days: number
    hasReason: boolean
    enabled: boolean
    threshold: number
  }> = {},
) {
  return evaluateFastPath({
    caseType,
    category: overrides.category ?? "laptop",
    days: overrides.days ?? 10,
    hasReason: overrides.hasReason ?? false,
    signals,
    enabled: overrides.enabled ?? true,
    threshold: overrides.threshold ?? 0.8,
  })
}

describe("evaluateFastPath", () => {
  it("admits a complete clear return and complaint acceptance", () => {
    expect(evaluate("return", returnSignals())).toEqual({ eligible: true })
    expect(evaluate("complaint", complaintSignals())).toEqual({ eligible: true })
  })

  it.each([
    ["photo_usable", "return", returnSignals()],
    ["device_visible", "return", returnSignals()],
    ["category_match", "return", returnSignals()],
    ["damage_visible", "return", returnSignals()],
    ["signs_of_use", "return", returnSignals()],
    ["condition", "return", returnSignals()],
    ["packaging_visible", "return", returnSignals()],
    ["damage_visible", "complaint", complaintSignals()],
    ["damage_cause", "complaint", complaintSignals()],
  ] as const)("requires %s confidence at/above threshold and rejects just below", (key, caseType, signals) => {
    const current = signals.answers[key]
    expect(current).toBeDefined()
    const boundary = { ...signals, answers: { ...signals.answers, [key]: { ...current!, confidence: 0.8 } } }
    const below = { ...signals, answers: { ...signals.answers, [key]: { ...current!, confidence: 0.79 } } }
    const options = key === "packaging_visible" ? { days: 15 } : {}
    expect(evaluate(caseType, boundary, options)).toEqual({ eligible: true })
    expect(evaluate(caseType, below, options).eligible).toBe(false)
  })

  it("requires description consistency when the customer supplied a reason", () => {
    const signals = returnSignals()
    signals.answers.description_consistent = answer(true, 0.8)
    expect(evaluate("return", signals, { hasReason: true })).toEqual({ eligible: true })
    signals.answers.description_consistent = answer(true, 0.79)
    expect(evaluate("return", signals, { hasReason: true }).eligible).toBe(false)
    signals.answers.description_consistent = answer(false)
    expect(evaluate("return", signals, { hasReason: true }).eligible).toBe(false)
  })

  it("excludes audio returns and goodwill returns without visible packaging", () => {
    expect(evaluate("return", returnSignals(), { category: "audio" }).eligible).toBe(false)
    const signals = returnSignals()
    delete signals.answers.packaging_visible
    expect(evaluate("return", signals, { days: 15 }).eligible).toBe(false)
  })

  it.each(["crack", "liquid", "burn_or_melt", "opened_or_modified", "dent_or_bend"])(
    "escalates excluded complaint damage type %s",
    (damageType) => {
      const signals = complaintSignals()
      signals.answers.damage_type = answer(damageType)
      expect(evaluate("complaint", signals).eligible).toBe(false)
    },
  )

  it("escalates user-caused damage even at high confidence", () => {
    const signals = complaintSignals()
    signals.answers.damage_cause = answer("user_caused", 0.95)
    expect(evaluate("complaint", signals).eligible).toBe(false)
  })

  it("escalates an excluded damage type even when its confidence is below threshold", () => {
    const signals = complaintSignals()
    signals.answers.damage_type = answer("crack", 0.79)
    expect(evaluate("complaint", signals).eligible).toBe(false)
  })

  it("fails closed for disabled, unavailable, refused, missing, and out-of-window signals", () => {
    expect(evaluate("return", returnSignals(), { enabled: false }).eligible).toBe(false)
    expect(evaluate("return", { ...returnSignals(), status: "unavailable" }).eligible).toBe(false)
    expect(evaluate("return", { ...returnSignals(), refusals: ["photo_usable"] }).eligible).toBe(false)
    const missing = returnSignals()
    delete missing.answers.condition
    expect(evaluate("return", missing).eligible).toBe(false)
    expect(evaluate("return", returnSignals(), { days: 31 }).eligible).toBe(false)
    expect(evaluate("complaint", complaintSignals(), { days: 731 }).eligible).toBe(false)
  })
})
