import "server-only"

import { createUIMessageStreamResponse, streamText, tool, toUIMessageStream, type UIMessage } from "ai"
import { type ChatRequest, type UpdateRecommendationOutput } from "@/lib/schemas"
import { buildChatCall, updateRecommendationToolSchema } from "@/server/ai/calls/chat"
import { defaultSink, type LogSink } from "@/server/ai/log/call-log"
import { applyGuards } from "@/server/ai/logic/guards"
import { loadPolicy } from "@/server/ai/logic/policy"
import { NEUTRAL_FINDINGS } from "@/server/ai/pipeline/image-findings"
import { createProvider } from "@/server/ai/provider"
import { createStepCallLogger } from "@/server/ai/upstream"
import { getEnv, type AppEnv } from "@/server/env"

// ADR-001 3.5 / 3.8 / 4.6: one chat turn; `update_recommendation` is executed on the server.

export interface BuildChatStreamDeps {
  provider?: ReturnType<typeof createProvider>
  env?: AppEnv
  now?: () => Date
  requestId?: string
  callLogSink?: LogSink
  abortSignal?: AbortSignal
}

/** Fixed text sent to the client for any stream failure (no provider text, ADR-002 8). */
export const CHAT_FAILED = "chat_failed"

/**
 * A timeout or an abort ends the AI SDK stream with an `abort` chunk whose `reason` carries raw
 * error text, and `useChat` treats it as a normal finish. Replace it with the masked error chunk
 * so the client shows the error row with "Ponów" (AC-42, AC-43; T28 F1).
 */
function maskAbort<T extends { type: string }>(): TransformStream<T, T> {
  return new TransformStream<T, T>({
    transform(chunk, controller) {
      controller.enqueue(chunk.type === "abort" ? ({ type: "error", errorText: CHAT_FAILED } as unknown as T) : chunk)
    },
  })
}

export async function buildChatStream(body: ChatRequest, deps: BuildChatStreamDeps = {}): Promise<Response> {
  const env = deps.env ?? getEnv()
  const provider = deps.provider ?? createProvider()
  const now = deps.now ?? (() => new Date())
  const sink = deps.callLogSink ?? defaultSink
  const { caseContext } = body
  const policy = loadPolicy(caseContext.form.caseType, env.policiesDir) // never from the client

  // ADR-001 3.8: at most one recommendation update per turn, enforced here and not only in the prompt (T28 F7).
  let updateExecutions = 0
  const update_recommendation = tool({
    ...updateRecommendationToolSchema,
    execute: async (input): Promise<UpdateRecommendationOutput> => {
      updateExecutions += 1
      if (updateExecutions > 1) throw new Error("update_limit: one recommendation update per turn")
      const guarded = applyGuards({
        caseType: caseContext.form.caseType,
        days: caseContext.daysSincePurchase,
        decision: input.decision,
        ruleRefs: input.ruleRefs,
        policyRuleIds: policy.ruleIds,
        // Chat guards cover enum, rule IDs, date rules and R-2.4 only (ADR-001 3.8): neutral
        // signals and findings keep the image-quality guard (AC-27) out of the chat path.
        signals: { status: "unavailable", answers: {}, refusals: [], cost: null, durationMs: 0 },
        imageFindings: NEUTRAL_FINDINGS,
        threshold: env.fastPathThreshold,
        route: "escalated",
        photoAdvice: null,
      })
      if ("violation" in guarded) throw new Error(guarded.violation)
      // D1 / AC-35: a guarded result equal to the current decision is not an update (no card, no panel change).
      if (guarded.decision === caseContext.currentDecision.decision) throw new Error("no_change: decision unchanged after policy checks")
      return {
        previousDecision: caseContext.currentDecision.decision,
        newDecision: guarded.decision,
        reason: input.reason,
        ruleRefs: guarded.ruleRefs,
        updatedAt: now().toISOString(),
      }
    },
  })
  const tools = { update_recommendation }

  const call = await buildChatCall({
    caseContext,
    messages: body.messages as unknown as UIMessage[],
    policy: policy.text,
    model: provider.chat(env.llmModel),
    reasoningEffort: env.reasoning.chat,
    tools,
  })

  const upstreamLog = createStepCallLogger({
    requestId: deps.requestId ?? "chat",
    stage: "chat-step",
    modelId: env.llmModel,
    sink,
  })
  const result = streamText({
    ...call,
    ...(deps.abortSignal && { abortSignal: deps.abortSignal }),
    // After the update step the tool is no longer offered, so step 2 can only explain it in text.
    prepareStep: ({ stepNumber }: { stepNumber: number }) => (stepNumber > 0 ? { activeTools: [] } : undefined),
    onStepStart: () => upstreamLog.start(),
    onStepEnd: (step) => upstreamLog.end(step),
    onError: ({ error }) => upstreamLog.fail(error),
  })

  const uiStream = toUIMessageStream({
    stream: result.stream,
    tools,
    sendReasoning: false, // ai 7.0.118 defaults to true (TAC-001-07)
    onError: () => CHAT_FAILED,
  })
  return createUIMessageStreamResponse({ stream: uiStream.pipeThrough(maskAbort()) })
}

