import "server-only"

import { DECISIONS, type CaseType, type Decision, type DecisionSignals, type ImageFindings, type Route } from "@/lib/schemas"

export type GuardInput = {
  caseType: CaseType
  days: number
  decision: Decision
  ruleRefs: string[]
  policyRuleIds: string[]
  signals: DecisionSignals
  imageFindings: ImageFindings
  threshold: number
  route: Route
  photoAdvice: string | null
}

export type GuardResult =
  | { decision: Decision; ruleRefs: string[]; photoAdvice: string | null; guardsApplied: string[] }
  | { violation: "invalid_rule_refs" | "missing_photo_advice" }

function hasConfidentAnswer(
  signals: DecisionSignals,
  key: string,
  value: boolean,
  threshold: number,
): boolean {
  const answer = signals.answers[key]
  return answer?.value === value && answer.confidence >= threshold
}

function dateRule(caseType: CaseType, days: number): string | null {
  if (caseType === "return" && days > 30) return "R-4"
  if (caseType === "complaint" && days > 730) return "C-2"
  return null
}

/** Enforces policy-reference, statutory-period, date-rule, and image-quality invariants. */
export function applyGuards(input: GuardInput): GuardResult {
  if (!DECISIONS.includes(input.decision)) return { violation: "invalid_rule_refs" }
  if (
    input.ruleRefs.length === 0 ||
    input.ruleRefs.some((ruleRef) => !input.policyRuleIds.includes(ruleRef))
  ) {
    return { violation: "invalid_rule_refs" }
  }

  let decision: Decision = input.decision
  let ruleRefs = [...input.ruleRefs]
  const guardsApplied: string[] = []
  const requiredDateRule = dateRule(input.caseType, input.days)

  // The deterministic stage is authoritative even if a later model output disagrees.
  if (requiredDateRule !== null) {
    if (decision !== "Odrzucenie" || !ruleRefs.includes(requiredDateRule)) {
      decision = "Odrzucenie"
      ruleRefs = [requiredDateRule]
      guardsApplied.push(requiredDateRule)
    }
  }

  if (
    input.caseType === "return" &&
    input.days <= 14 &&
    decision === "Odrzucenie"
  ) {
    decision = "Weryfikacja ręczna"
    guardsApplied.push("R-2.4")
  }

  const isDateRuleRejection = requiredDateRule !== null && decision === "Odrzucenie"
  const imageQualityIssue =
    hasConfidentAnswer(input.signals, "photo_usable", false, input.threshold) ||
    hasConfidentAnswer(input.signals, "category_match", false, input.threshold) ||
    input.imageFindings.photoQuality === "unusable" ||
    !input.imageFindings.categoryMatches ||
    input.imageFindings.contradictsDescription

  if (!isDateRuleRejection && imageQualityIssue) {
    if (!input.photoAdvice?.trim()) return { violation: "missing_photo_advice" }
    decision = "Weryfikacja ręczna"
    guardsApplied.push("AC-27")
  }

  return { decision, ruleRefs, photoAdvice: input.photoAdvice, guardsApplied }
}
