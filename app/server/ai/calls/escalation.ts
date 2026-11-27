import { type LanguageModel, Output } from "ai"
import { type DecisionSignals, EscalatedDecisionOutputSchema } from "@/lib/schemas"
import { loadPrompt } from "@/server/ai/prompts"
import type { ReasoningEffort } from "@/server/env"
import { type CaseInputText, renderCaseData, renderSignals, withPolicy } from "./shared"

export interface EscalationCallArgs {
  caseInput: CaseInputText
  days: number
  signals: DecisionSignals | null
  image: { buffer: Uint8Array; mediaType: string }
  policy: string
  reasoningEffort: ReasoningEffort
  model: LanguageModel
}

/** Options for `generateText` of the escalated decision (ADR-001 3.2 stage 5). */
export function buildEscalationCall(args: EscalationCallArgs) {
  const prompt = loadPrompt(
    args.caseInput.caseType === "return" ? "decision-return" : "decision-complaint",
  )
  const text = `${renderCaseData(args.caseInput, args.days)}\n\n${renderSignals(args.signals)}`
  return {
    model: args.model,
    instructions: withPolicy(prompt.text, args.policy),
    messages: [
      {
        role: "user" as const,
        content: [
          { type: "file" as const, mediaType: args.image.mediaType, data: args.image.buffer },
          { type: "text" as const, text },
        ],
      },
    ],
    output: Output.object({ schema: EscalatedDecisionOutputSchema }),
    reasoning: args.reasoningEffort,
    maxRetries: 0,
  }
}
