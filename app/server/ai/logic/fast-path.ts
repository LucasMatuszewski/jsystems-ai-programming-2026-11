import "server-only"

import type { Category, CaseType, DecisionSignals, SignalAnswer } from "@/lib/schemas"

export type FastPathInput = {
  caseType: CaseType
  category: Category
  days: number
  hasReason: boolean
  signals: DecisionSignals
  enabled: boolean
  threshold: number
}

export type FastPathResult = { eligible: true } | { eligible: false; reasons: string[] }

const EXCLUDED_COMPLAINT_DAMAGE_TYPES = new Set([
  "crack",
  "liquid",
  "burn_or_melt",
  "opened_or_modified",
  "dent_or_bend",
])

function answerMeets(answer: SignalAnswer | undefined, expected: boolean | number | string, threshold: number) {
  return answer !== undefined && answer.value === expected && answer.confidence >= threshold
}

/** Allows only clear acceptances; all uncertain or adverse cases escalate. */
export function evaluateFastPath(input: FastPathInput): FastPathResult {
  const reasons = new Set<string>()
  const { caseType, category, days, hasReason, signals, enabled, threshold } = input

  if (!enabled) reasons.add("fast_path_disabled")
  if (signals.status !== "ok") reasons.add("signals_unavailable")
  for (const refusal of signals.refusals) reasons.add(`refusal:${refusal}`)

  const requiredCommon: Array<[string, boolean]> = [
    ["photo_usable", true],
    ["device_visible", true],
    ["category_match", true],
  ]
  for (const [key, value] of requiredCommon) {
    if (!answerMeets(signals.answers[key], value, threshold)) reasons.add(key)
  }

  if (hasReason && !answerMeets(signals.answers.description_consistent, true, threshold)) {
    reasons.add("description_consistent")
  }

  if (caseType === "return") {
    if (days < 0 || days > 30) reasons.add("return_days_out_of_range")
    if (category === "audio") reasons.add("audio_requires_review")
    for (const [key, value] of [
      ["damage_visible", false],
      ["signs_of_use", false],
      ["condition", 5],
    ] as const) {
      if (!answerMeets(signals.answers[key], value, threshold)) reasons.add(key)
    }
    if (days >= 15 && !answerMeets(signals.answers.packaging_visible, true, threshold)) {
      reasons.add("packaging_visible")
    }
  } else {
    if (days < 0 || days > 730) reasons.add("complaint_days_out_of_range")
    if (!answerMeets(signals.answers.damage_visible, true, threshold)) reasons.add("damage_visible")
    if (!answerMeets(signals.answers.damage_cause, "manufacturing_defect", threshold)) {
      reasons.add("damage_cause")
    }
    const damageType = signals.answers.damage_type
    if (damageType === undefined) {
      reasons.add("damage_type")
    } else if (EXCLUDED_COMPLAINT_DAMAGE_TYPES.has(String(damageType.value))) {
      reasons.add("excluded_damage_type")
    }
  }

  return reasons.size === 0 ? { eligible: true } : { eligible: false, reasons: [...reasons] }
}
