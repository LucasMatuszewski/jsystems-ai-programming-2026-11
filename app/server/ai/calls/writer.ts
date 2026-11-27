import { type LanguageModel, Output } from "ai"
import { type Decision, type ImageFindings, type SignalsSummary, WriterOutputSchema } from "@/lib/schemas"
import { loadPrompt } from "@/server/ai/prompts"
import type { ReasoningEffort } from "@/server/env"
import { type CaseInputText, renderCaseData, withPolicy } from "./shared"

export interface WriterCallArgs {
  caseInput: CaseInputText
  days: number
  decision: Decision
  ruleRefs: string[]
  imageFindings: ImageFindings
  signalsSummary: SignalsSummary | null
  policy: string
  reasoningEffort: ReasoningEffort
  model: LanguageModel
}

/** Options for `generateText` of the first-message writer (rule and fast routes). No image. */
export function buildWriterCall(args: WriterCallArgs) {
  const prompt = loadPrompt("writer")
  const signals =
    args.signalsSummary && Object.keys(args.signalsSummary).length > 0
      ? JSON.stringify(args.signalsSummary)
      : "unavailable"
  const text = [
    `LOCKED decision: ${args.decision}`,
    `Rule references: ${args.ruleRefs.join(", ")}`,
    renderCaseData(args.caseInput, args.days),
    `Image findings: ${JSON.stringify(args.imageFindings)}`,
    `Signals summary: ${signals}`,
  ].join("\n")
  return {
    model: args.model,
    instructions: withPolicy(prompt.text, args.policy),
    messages: [{ role: "user" as const, content: [{ type: "text" as const, text }] }],
    output: Output.object({ schema: WriterOutputSchema }),
    reasoning: args.reasoningEffort,
    maxRetries: 0,
  }
}
