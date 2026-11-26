import type { CaseFormValues, DecisionSignals } from "@/lib/schemas"

export type CaseInputText = Pick<
  CaseFormValues,
  "caseType" | "category" | "model" | "purchaseDate" | "reason"
>

/** Case data as plain text. Customer text is wrapped in delimiters and is data, never instructions. */
export function renderCaseData(caseInput: CaseInputText, days: number): string {
  const reason = caseInput.reason.trim()
  return [
    `Case type: ${caseInput.caseType}`,
    `Category: ${caseInput.category}`,
    `Model: ${caseInput.model}`,
    `Purchase date: ${caseInput.purchaseDate}`,
    `daysSincePurchase (given by the system): ${days}`,
    `Customer reason: <customer_reason>${reason.length > 0 ? reason : "(not provided)"}</customer_reason>`,
  ].join("\n")
}

export function renderSignals(signals: DecisionSignals | null | undefined): string {
  if (!signals || signals.status !== "ok") {
    return "Preliminary automated signals: unavailable."
  }
  const lines = Object.entries(signals.answers).map(([key, answer]) => {
    const probabilities = Object.entries(answer.probabilities)
      .map(([option, p]) => `${option}=${p.toFixed(2)}`)
      .join(", ")
    return `- ${key}: ${String(answer.value)} (confidence ${answer.confidence.toFixed(2)}; ${probabilities})`
  })
  const refusals = signals.refusals.length > 0 ? `\nRefused questions: ${signals.refusals.join(", ")}` : ""
  return `Preliminary automated signals (verify against the photo, do not trust blindly):\n${lines.join("\n")}${refusals}`
}

export function withPolicy(promptText: string, policy: string): string {
  return `${promptText}\n\n## Policy\n\n${policy.trim()}`
}
