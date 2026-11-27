import { describe, expect, it, vi } from "vitest"
import { applyDateRules } from "@/server/ai/logic/rules"

vi.mock("server-only", () => ({}))

describe("applyDateRules", () => {
  it.each([
    ["return", 31, { decision: "Odrzucenie", ruleRefs: ["R-4"] }],
    ["complaint", 731, { decision: "Odrzucenie", ruleRefs: ["C-2"] }],
  ] as const)("applies the %s date rule at day %i", (caseType, days, expected) => {
    expect(applyDateRules(caseType, days)).toEqual(expected)
  })

  it.each([
    ["return", 30],
    ["complaint", 730],
    ["complaint", 30],
  ] as const)("does not apply a date rule to %s at day %i", (caseType, days) => {
    expect(applyDateRules(caseType, days)).toBeNull()
  })
})
