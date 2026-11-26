import "server-only"

// AC-23 (T28 F4): the justification states the system day count and cites only rules from the policy.
// Checked in code, because prompt-only enforcement is rejected in ADR-001 ("Deterministic facts and policy guards in code").

/** A day count: the number, then a form of "dzień" (dni, dniach, dnia, dzień). */
const DAY_COUNT = /(?<![\d.,])(\d+)\s*(?:dni|dniach|dnia|dzień|dzien)(?![\p{L}])/giu
/** A rule ID such as R-2, C-5 or R-2.4, not glued to other letters, digits or hyphens (USB-C-3). */
const RULE_ID = /(?<![\p{L}\d-])[RC]-\d+(?:\.\d+)?(?![\p{L}\d-])/gu

export type BodyCheck = { daysMissing: boolean; unknownRuleIds: string[] }

const JUSTIFICATION_HEADING = /^#{1,6}\s+.*uzasadnieni/i
const ANY_HEADING = /^#{1,6}\s/

/** The text of the Uzasadnienie section (up to the next heading); empty when there is none. */
function justificationSection(bodyMarkdown: string): string {
  const lines = bodyMarkdown.split("\n")
  const start = lines.findIndex((line) => JUSTIFICATION_HEADING.test(line))
  if (start === -1) return ""
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => ANY_HEADING.test(line))
  return (end === -1 ? rest : rest.slice(0, end)).join("\n")
}

/** AC-23: the day count is looked for in the justification section only; rule IDs anywhere in the body. */
export function checkBody(bodyMarkdown: string, days: number, policyRuleIds: readonly string[]): BodyCheck {
  const counts = [...justificationSection(bodyMarkdown).matchAll(DAY_COUNT)].map((m) => Number(m[1]))
  const cited = [...bodyMarkdown.matchAll(RULE_ID)].map((m) => m[0])
  const unknownRuleIds = [...new Set(cited)].filter((id) => !policyRuleIds.includes(id))
  return { daysMissing: !counts.includes(days), unknownRuleIds }
}

/** "Od zakupu minęło N dni." with the Polish plural: 1 dzień, 2-4 (not 12-14) minęły ... dni, otherwise minęło ... dni. */
export function dayCountSentence(days: number): string {
  if (days === 1) return "Od zakupu minął 1 dzień."
  const few = days % 10 >= 2 && days % 10 <= 4 && (days % 100 < 12 || days % 100 > 14)
  return `Od zakupu ${few ? "minęły" : "minęło"} ${days} dni.`
}

/** Inserts the day-count sentence as the first paragraph of the justification (or at the end without one). */
export function ensureDayCount(bodyMarkdown: string, days: number): { bodyMarkdown: string; inserted: boolean } {
  if (!checkBody(bodyMarkdown, days, []).daysMissing) return { bodyMarkdown, inserted: false }
  const sentence = dayCountSentence(days)
  const lines = bodyMarkdown.split("\n")
  const heading = lines.findIndex((line) => JUSTIFICATION_HEADING.test(line))
  if (heading === -1) return { bodyMarkdown: `${bodyMarkdown.trimEnd()}\n\n${sentence}`, inserted: true }
  const rest = lines.slice(heading + 1)
  while (rest.length > 0 && rest[0]?.trim() === "") rest.shift()
  return { bodyMarkdown: [...lines.slice(0, heading + 1), "", sentence, "", ...rest].join("\n"), inserted: true }
}
