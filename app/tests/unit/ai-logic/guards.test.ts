import { describe, expect, it, vi } from "vitest"
import type { DecisionSignals, ImageFindings } from "@/lib/schemas"
import { applyGuards } from "@/server/ai/logic/guards"

vi.mock("server-only", () => ({}))

function answer(value: boolean | string | number, confidence = 0.9) {
  return { value, confidence, probabilities: {} }
}

const signals: DecisionSignals = {
  status: "ok",
  answers: { photo_usable: answer(true), category_match: answer(true) },
  refusals: [],
  cost: null,
  durationMs: 1,
}

const findings: ImageFindings = {
  deviceVisible: true,
  categoryMatches: true,
  photoQuality: "good",
  damage: "",
  signsOfUse: null,
  likelyCause: null,
  evidence: [],
  contradictsDescription: false,
}

function guard(overrides: Partial<Parameters<typeof applyGuards>[0]> = {}) {
  return applyGuards({
    caseType: "return",
    days: 10,
    decision: "Akceptacja",
    ruleRefs: ["R-2"],
    policyRuleIds: ["R-2", "R-2.4", "R-4"],
    signals,
    imageFindings: findings,
    threshold: 0.8,
    route: "escalated",
    photoAdvice: null,
    ...overrides,
  })
}

describe("applyGuards", () => {
  it("overrides a return rejection within 14 days to manual review", () => {
    expect(guard({ decision: "Odrzucenie" })).toMatchObject({
      decision: "Weryfikacja ręczna",
      guardsApplied: ["R-2.4"],
    })
  })

  it("does not apply R-2.4 after day 14", () => {
    expect(guard({ days: 15, decision: "Odrzucenie" })).toMatchObject({
      decision: "Odrzucenie",
      guardsApplied: [],
    })
  })

  it("rejects a decision outside the shared decision enum", () => {
    expect(guard({ decision: "Nieznana decyzja" as never })).toEqual({ violation: "invalid_rule_refs" })
  })

  it.each([{ ruleRefs: ["R-9"] }, { ruleRefs: ["C-2"] }, { ruleRefs: [] }])(
    "rejects invalid rule references $ruleRefs",
    ({ ruleRefs }) => {
    expect(guard({ ruleRefs })).toEqual({ violation: "invalid_rule_refs" })
    },
  )

  it("keeps deterministic date-rule rejections even when the photo is unusable", () => {
    expect(
      guard({
        days: 31,
        decision: "Odrzucenie",
        ruleRefs: ["R-4"],
        signals: { ...signals, answers: { photo_usable: answer(false), category_match: answer(true) } },
        imageFindings: { ...findings, photoQuality: "unusable" },
      }),
    ).toMatchObject({ decision: "Odrzucenie", ruleRefs: ["R-4"] })
  })

  it("requires photo advice and applies AC-27 for LLM image findings", () => {
    expect(guard({ imageFindings: { ...findings, photoQuality: "unusable" } })).toEqual({
      violation: "missing_photo_advice",
    })
    expect(
      guard({ imageFindings: { ...findings, photoQuality: "unusable" }, photoAdvice: "Prosimy o wyraźne zdjęcie." }),
    ).toMatchObject({ decision: "Weryfikacja ręczna", photoAdvice: "Prosimy o wyraźne zdjęcie." })
  })

  it.each([
    ["categoryMatches", false],
    ["contradictsDescription", true],
  ] as const)("applies AC-27 when %s is %s", (key, value) => {
    const result = guard({
      imageFindings: { ...findings, [key]: value },
      photoAdvice: "Prosimy o dodatkowe zdjęcie.",
    })
    expect(result).toMatchObject({ decision: "Weryfikacja ręczna" })
  })

  it("applies AC-27 to confident negative signal answers", () => {
    const result = guard({
      signals: {
        ...signals,
        answers: { photo_usable: answer(false), category_match: answer(true) },
      },
      photoAdvice: "Prosimy o wyraźne zdjęcie.",
    })
    expect(result).toMatchObject({ decision: "Weryfikacja ręczna" })
  })

  it("enforces the date-rule decision assertion", () => {
    expect(guard({ days: 31, decision: "Akceptacja", ruleRefs: ["R-2"] })).toMatchObject({
      decision: "Odrzucenie",
      ruleRefs: ["R-4"],
    })
    expect(
      guard({
        caseType: "complaint",
        days: 731,
        decision: "Akceptacja",
        ruleRefs: ["C-2"],
        policyRuleIds: ["C-2"],
      }),
    ).toMatchObject({ decision: "Odrzucenie", ruleRefs: ["C-2"] })
  })

  it("never returns a rejection for return days 0–14 across guarded outcomes", () => {
    for (let days = 0; days <= 14; days += 1) {
      for (const decision of ["Akceptacja", "Odrzucenie", "Weryfikacja ręczna"] as const) {
        const result = guard({ days, decision })
        expect("violation" in result ? decision : result.decision).not.toBe("Odrzucenie")
      }
    }
  })
})
