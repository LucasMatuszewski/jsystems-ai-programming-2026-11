import {
  convertToModelMessages,
  isStepCount,
  type LanguageModel,
  type ToolSet,
  type UIMessage,
} from "ai"
import { type CaseContext, UpdateRecommendationInputSchema } from "@/lib/schemas"
import { loadPrompt } from "@/server/ai/prompts"
import type { ReasoningEffort } from "@/server/env"
import { renderCaseData, withPolicy } from "./shared"

/** Input schema of `update_recommendation` (ADR-001 3.8); T23 adds the server-side `execute`. */
export const updateRecommendationToolSchema = {
  description:
    "Update the recommendation when the customer gives NEW FACTS relevant to the policy. Never call it because the customer insists.",
  inputSchema: UpdateRecommendationInputSchema,
}

export interface ChatCallArgs {
  caseContext: CaseContext
  messages: UIMessage[]
  policy: string
  model: LanguageModel
  reasoningEffort: ReasoningEffort
  tools: ToolSet
}

function renderCaseContext(ctx: CaseContext): string {
  return [
    "## Case context",
    "<case_context>",
    renderCaseData(ctx.form, ctx.daysSincePurchase),
    `Image findings: ${JSON.stringify(ctx.imageFindings)}`,
    `Signals summary: ${Object.keys(ctx.signalsSummary).length > 0 ? JSON.stringify(ctx.signalsSummary) : "unavailable"}`,
    `Current recommendation: ${ctx.currentDecision.decision}, rules ${ctx.currentDecision.ruleRefs.join(", ")} (source: ${ctx.currentDecision.source})`,
    "</case_context>",
  ].join("\n")
}

type AnyPart = { type: string; [key: string]: unknown }

function decisionText(decision: unknown, ruleRefs: unknown, label: string): string {
  const refs = Array.isArray(ruleRefs) ? ruleRefs.join(", ") : ""
  return `[${label}: ${String(decision)}, reguły ${refs}]`
}

/** Data and update-tool parts become short text; reasoning parts are dropped (ADR-001 3.8). */
function toModelFriendlyPart(part: AnyPart): AnyPart | null {
  if (part.type === "data-decision") {
    const data = (part.data ?? {}) as { decision?: unknown; ruleRefs?: unknown }
    return { type: "text", text: decisionText(data.decision, data.ruleRefs, "Rekomendacja") }
  }
  if (part.type === "tool-update_recommendation") {
    if (part.state !== "output-available") return null
    const out = (part.output ?? {}) as { newDecision?: unknown; ruleRefs?: unknown }
    return {
      type: "text",
      text: decisionText(out.newDecision, out.ruleRefs, "Zaktualizowana rekomendacja"),
    }
  }
  if (part.type.startsWith("data-")) return null
  if (part.type === "reasoning" || part.type === "reasoning-file") return null
  return part
}

export function sanitizeChatMessages(messages: UIMessage[]): UIMessage[] {
  return messages
    .map((message) => ({
      ...message,
      parts: (message.parts as AnyPart[])
        .map(toModelFriendlyPart)
        .filter((p): p is AnyPart => p !== null),
    }))
    .filter((message) => message.parts.length > 0) as UIMessage[]
}

/** Options for `streamText` of one chat turn (ADR-001 3.8). The photo is never re-sent. */
export async function buildChatCall(args: ChatCallArgs) {
  const prompt = loadPrompt(args.caseContext.form.caseType === "return" ? "chat-return" : "chat-complaint")
  return {
    model: args.model,
    instructions: `${withPolicy(prompt.text, args.policy)}\n\n${renderCaseContext(args.caseContext)}`,
    messages: await convertToModelMessages(sanitizeChatMessages(args.messages)),
    tools: args.tools,
    stopWhen: isStepCount(2),
    reasoning: args.reasoningEffort,
    maxRetries: 0,
  }
}
