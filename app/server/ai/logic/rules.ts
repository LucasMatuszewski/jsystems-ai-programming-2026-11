import "server-only"

import type { CaseType } from "@/lib/schemas"

export type DateRuleResult =
  | { decision: "Odrzucenie"; ruleRefs: ["R-4"] }
  | { decision: "Odrzucenie"; ruleRefs: ["C-2"] }

/** Applies the deterministic date-based rejection rules before model routing. */
export function applyDateRules(caseType: CaseType, days: number): DateRuleResult | null {
  if (caseType === "return" && days > 30) {
    return { decision: "Odrzucenie", ruleRefs: ["R-4"] }
  }

  if (caseType === "complaint" && days > 730) {
    return { decision: "Odrzucenie", ruleRefs: ["C-2"] }
  }

  return null
}
