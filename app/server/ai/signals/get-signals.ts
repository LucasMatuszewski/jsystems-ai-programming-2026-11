import "server-only"

import { experimental_evaluate as evaluate } from "ai"
import type { CaseFormValues, DecisionSignals } from "@/lib/schemas"
import { createRequestId } from "@/server/ai/log/call-log"
import { createProvider } from "@/server/ai/provider"
import { buildSignalQuestions, buildSignalStateText } from "@/server/ai/signals/questions"
import { InvalidAnswerError, normalizeDecisionAnswers, type RawAnswer } from "@/server/ai/signals/normalize"
import { getEnv } from "@/server/env"
import { httpStatusOf, openRouterCostOf, withCallLog } from "@/server/ai/upstream"

// ADR-001 3.2 step 2 and A1. Never throws: every failure returns
// status "unavailable" with a fixed reason code. Reason codes never contain
// provider text, customer text or image data.

export type SignalsReason = "auth" | "network" | "upstream" | "refusal" | "invalid_answer" | "timeout"

export type SignalCaseInput = Pick<CaseFormValues, "caseType" | "category" | "model" | "reason">

export type SignalImage = { buffer: Buffer; mediaType: string }

export type GetSignalsDeps = {
  provider?: { evaluationModel: ReturnType<typeof createProvider>["evaluationModel"] }
  modelId?: string
  requestId?: string
  callLogSink?: (line: string) => void
  /** Monotonic clock in milliseconds; defaults to `performance.now`. */
  now?: () => number
  /** The request or pipeline signal: aborting it cancels the signals call (T28 F8). */
  abortSignal?: AbortSignal
}

/** Upper bound for one signals call. Not configurable in this slice. */
export const SIGNALS_TIMEOUT_MS = 20_000

const INVALID_ERROR_NAMES = new Set([
  "InvalidAnswerError",
  "InvalidResponseDataError",
  "TypeValidationError",
  "JSONParseError",
  "EvaluationUnsupportedQuestionTypeError",
])

/** Maps an error to a fixed reason code. The message text is never used. */
export function classifySignalsError(error: unknown, timedOut: boolean): SignalsReason {
  if (timedOut) return "timeout"
  const name = error instanceof Error ? error.name : ""
  if (INVALID_ERROR_NAMES.has(name) || error instanceof InvalidAnswerError) return "invalid_answer"
  if (/refus/i.test(name)) return "refusal"
  if (name === "AbortError" || name === "TimeoutError") return "timeout"
  const status = httpStatusOf(error)
  if (status === 401 || status === 403) return "auth"
  if (status !== undefined) return status === 408 ? "timeout" : "upstream"
  // Transport failure: fetch rejected or the SDK wrapped a connection error without a status.
  return "network"
}

function unavailable(reason: SignalsReason, durationMs: number): DecisionSignals {
  return { status: "unavailable", reason, answers: {}, refusals: [], cost: null, durationMs }
}

/**
 * Asks the decision model (Jev 1.14) endpoint for the photo signals of one case.
 * Fail-closed: any error returns `{ status: "unavailable", reason }`.
 */
export async function getDecisionSignals(
  caseInput: SignalCaseInput,
  image: SignalImage,
  deps: GetSignalsDeps = {}
): Promise<DecisionSignals> {
  const now = deps.now ?? (() => performance.now())
  const startedAt = now()
  const elapsed = () => Math.max(0, Math.round(now() - startedAt))

  let provider: NonNullable<GetSignalsDeps["provider"]>
  let modelId: string
  try {
    provider = deps.provider ?? createProvider()
    modelId = deps.modelId ?? getEnv().decisionModel
  } catch {
    return unavailable("auth", elapsed())
  }
  const requestId = deps.requestId ?? createRequestId()

  const hasReason = caseInput.reason.trim().length > 0
  const questions = buildSignalQuestions(caseInput.caseType, hasReason)
  const stateText = buildSignalStateText({
    caseType: caseInput.caseType,
    category: caseInput.category,
    model: caseInput.model,
    reason: caseInput.reason,
  })
  const imageUrl = `data:${image.mediaType};base64,${image.buffer.toString("base64")}`
  const timeout = AbortSignal.timeout(SIGNALS_TIMEOUT_MS)

  try {
    const result = await withCallLog(
      {
        requestId,
        stage: "signals",
        modelId,
        ...(deps.callLogSink ? { sink: deps.callLogSink } : {}),
        extractCost: (r) => openRouterCostOf(r.providerMetadata),
      },
      () =>
        evaluate({
          model: provider.evaluationModel(modelId),
          state: [stateText, { type: "image_url", image_url: { url: imageUrl } }],
          questions,
          maxRetries: 0,
          abortSignal: deps.abortSignal ? AbortSignal.any([timeout, deps.abortSignal]) : timeout,
        })
    )

    for (const key of Object.keys(questions)) {
      if (!(key in result.answers)) throw new InvalidAnswerError(`missing answer: ${key}`)
    }
    const meta = (result.providerMetadata as { openrouter?: { answers?: Record<string, { confidence?: number }> } } | undefined)
      ?.openrouter?.answers
    const answers = normalizeDecisionAnswers(result.answers as Record<string, RawAnswer>, meta)
    return {
      status: "ok",
      answers,
      refusals: [],
      cost: openRouterCostOf(result.providerMetadata) ?? null,
      durationMs: elapsed(),
    }
  } catch (error) {
    return unavailable(classifySignalsError(error, timeout.aborted), elapsed())
  }
}
