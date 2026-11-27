import "server-only"

import { generateText } from "ai"
import {
  EscalatedDecisionOutputSchema, WriterOutputSchema,
  type CaseDecision, type CaseFormValues, type Decision, type DecisionSignals, type ImageFindings, type SignalsSummary,
} from "@/lib/schemas"
import { buildEscalationCall } from "@/server/ai/calls/escalation"
import { buildWriterCall } from "@/server/ai/calls/writer"
import { appendDecisionLog, toDecisionLogEntry, type DecisionLogEntry } from "@/server/ai/log/decision-log"
import { createRequestId, type LogSink } from "@/server/ai/log/call-log"
import { daysSincePurchase } from "@/server/ai/logic/days"
import { evaluateFastPath } from "@/server/ai/logic/fast-path"
import { applyGuards } from "@/server/ai/logic/guards"
import { loadPolicy } from "@/server/ai/logic/policy"
import { applyDateRules } from "@/server/ai/logic/rules"
import { checkBody, ensureDayCount } from "@/server/ai/pipeline/body-checks"
import { findingsFromSignals } from "@/server/ai/pipeline/image-findings"
import { createProvider } from "@/server/ai/provider"
import { loadPrompt } from "@/server/ai/prompts"
import { getDecisionSignals } from "@/server/ai/signals/get-signals"
import { openRouterCostOf, withCallLog } from "@/server/ai/upstream"
import { getEnv, type AppEnv } from "@/server/env"

// ADR-001 3.2 (stage order), 3.5 (guards + one retry), 3.7 (decision log), A1 (signals unavailable).

export type PipelineErrorCode = "model_unavailable" | "invalid_model_output" | "timeout"

const MESSAGES: Record<PipelineErrorCode, string> = {
  model_unavailable: "The decision model is unavailable.",
  invalid_model_output: "The decision model returned an invalid result.",
  timeout: "The analysis timed out.",
}

/** Carries a fixed message only; provider text never reaches it (ADR-002 5). */
export class PipelineError extends Error {
  constructor(public readonly code: PipelineErrorCode) {
    super(MESSAGES[code])
    this.name = "PipelineError"
  }
}

/** Failure line for the decision log (ADR-001 3.7): routing metadata only, no customer text. */
export type FailedDecisionLogEntry = Omit<DecisionLogEntry, "decision"> & {
  decision: null
  outcome: "error"
  errorCode: PipelineErrorCode
}

/** Rule references of a fast-path acceptance: return R-2 (days 0-14) or R-3 (15-30); complaint C-4 (covered defect). */
export function fastRuleRefs(caseType: CaseFormValues["caseType"], days: number): string[] {
  if (caseType === "complaint") return ["C-4"]
  return days <= 14 ? ["R-2"] : ["R-3"]
}

export interface PipelineDeps {
  provider?: ReturnType<typeof createProvider>
  env?: AppEnv
  now?: () => Date
  onStage?: (stage: "decision") => void
  requestId?: string
  callLogSink?: LogSink
  decisionLogSink?: (entry: DecisionLogEntry | FailedDecisionLogEntry) => void | Promise<void>
}

/** `CaseDecision` (includes `photoAdvice`: the model's photo advice, null when none; ADR-001 3.5 guard 5). */
export type PipelineResult = CaseDecision

export type PipelineCaseInput = Pick<CaseFormValues, "caseType" | "category" | "model" | "purchaseDate" | "reason">

const INVALID_OUTPUT_ERRORS = /NoOutputGenerated|NoObjectGenerated|TypeValidation|JSONParse|InvalidResponseData/

/** Thrown inside the retry loop when a model result breaks an output invariant. */
class OutputViolation extends Error {}

function isAbort(error: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")
}

function toPipelineError(error: unknown, signal: AbortSignal): PipelineError {
  if (error instanceof PipelineError) return error
  if (isAbort(error, signal)) return new PipelineError("timeout")
  if (error instanceof OutputViolation) return new PipelineError("invalid_model_output")
  if (error instanceof Error && INVALID_OUTPUT_ERRORS.test(error.name)) return new PipelineError("invalid_model_output")
  return new PipelineError("model_unavailable")
}

function summarize(signals: DecisionSignals): SignalsSummary {
  const summary: SignalsSummary = {}
  if (signals.status !== "ok") return summary
  for (const [key, answer] of Object.entries(signals.answers)) {
    summary[key] = { value: answer.value, confidence: answer.confidence }
  }
  return summary
}

/** Runs the model call at most twice: a first invariant violation retries once, a second one fails. */
async function withOneRetry<T>(attempt: () => Promise<T>, signal: AbortSignal): Promise<T> {
  for (let n = 0; ; n += 1) {
    try {
      return await attempt()
    } catch (error) {
      const violation = error instanceof OutputViolation || (error instanceof Error && INVALID_OUTPUT_ERRORS.test(error.name))
      if (!violation || isAbort(error, signal) || n >= 1) throw error
    }
  }
}

export async function runCasePipeline(
  caseInput: PipelineCaseInput,
  image: { buffer: Buffer; mediaType: string },
  signal: AbortSignal,
  deps: PipelineDeps = {},
): Promise<PipelineResult> {
  const failure: FailureHook = {}
  try {
    return await run(caseInput, image, signal, deps, failure)
  } catch (error) {
    const pipelineError = toPipelineError(error, signal)
    // Not logged when the failure happened before any work (hook not yet installed).
    await failure.log?.(pipelineError.code)
    throw pipelineError
  }
}

type FailureHook = { log?: (code: PipelineErrorCode) => Promise<void> }

async function run(
  caseInput: PipelineCaseInput,
  image: { buffer: Buffer; mediaType: string },
  signal: AbortSignal,
  deps: PipelineDeps,
  failure: FailureHook,
): Promise<PipelineResult> {
  signal.throwIfAborted()
  const env = deps.env ?? getEnv()
  const now = deps.now ?? (() => new Date())
  const requestId = deps.requestId ?? createRequestId()
  const callLogSink = deps.callLogSink ? { sink: deps.callLogSink } : {}
  const provider = deps.provider ?? createProvider()
  const { caseType } = caseInput
  const policy = loadPolicy(caseType, env.policiesDir)

  // Stage 1: facts.
  const days = daysSincePurchase(caseInput.purchaseDate, now())

  // Stage 2: signals (always called; never throws).
  const signals = await getDecisionSignals(caseInput, image, {
    provider,
    modelId: env.decisionModel,
    requestId,
    abortSignal: signal,
    ...(deps.callLogSink ? { callLogSink: deps.callLogSink } : {}),
  })
  signal.throwIfAborted()
  deps.onStage?.("decision")

  const model = provider.chat(env.llmModel)
  const signalsSummary = summarize(signals)
  const modelCosts: number[] = []
  const durations: Record<string, number> = { signals: signals.durationMs }
  const promptVersions: Record<string, string> = {}

  const state: { route: CaseDecision["route"] | null; reasons: string[] } = { route: null, reasons: [] }
  failure.log = async (code) => {
    const entry: FailedDecisionLogEntry = {
      timestamp: now().toISOString(),
      caseType,
      category: caseInput.category,
      daysSincePurchase: days,
      signals: Object.fromEntries(Object.entries(signals.answers)),
      route: state.route as CaseDecision["route"],
      escalationReasons: state.reasons,
      decision: null,
      guardsApplied: [],
      promptVersions,
      modelIds: { signals: env.decisionModel, llm: env.llmModel },
      durations,
      cost: null,
      outcome: "error",
      errorCode: code,
    }
    // appendDecisionLog only serialises the entry, so the failure shape is safe to pass.
    await (deps.decisionLogSink ?? ((e) => appendDecisionLog(e as unknown as DecisionLogEntry)))(entry)
  }

  const finish = async (
    route: CaseDecision["route"],
    escalationReasons: string[],
    result: { decision: Decision; ruleRefs: string[]; remedy: CaseDecision["remedy"]; imageFindings: ImageFindings; photoAdvice: string | null; greeting: string; bodyMarkdown: string },
    guardsApplied: string[],
    decisionOverride: Decision,
    ruleRefsOverride: string[],
  ): Promise<PipelineResult> => {
    const decision: PipelineResult = {
      decision: decisionOverride,
      ruleRefs: ruleRefsOverride,
      route,
      escalationReasons,
      imageFindings: result.imageFindings,
      signalsSummary,
      remedy: result.remedy,
      firstMessage: { greeting: result.greeting, bodyMarkdown: result.bodyMarkdown },
      guardsApplied,
      daysSincePurchase: days,
      photoAdvice: result.photoAdvice,
    }
    const costs = [...(signals.cost !== null ? [signals.cost] : []), ...modelCosts]
    await (deps.decisionLogSink ?? appendDecisionLog)(
      toDecisionLogEntry(
        {
          caseType,
          category: caseInput.category,
          daysSincePurchase: days,
          signals,
          decision,
          promptVersions,
          modelIds: { signals: env.decisionModel, llm: env.llmModel },
          durations,
          cost: costs.length > 0 ? costs.reduce((x, y) => x + y, 0) : null,
        },
        now(),
      ),
    )
    return decision
  }

  const guard = (
    route: CaseDecision["route"],
    decision: Decision,
    ruleRefs: string[],
    imageFindings: ImageFindings,
    photoAdvice: string | null,
  ) => {
    const guarded = applyGuards({
      caseType, days, decision, ruleRefs, policyRuleIds: policy.ruleIds, signals, imageFindings,
      threshold: env.fastPathThreshold, route, photoAdvice,
    })
    if ("violation" in guarded) throw new OutputViolation(guarded.violation)
    return guarded
  }

  /**
   * AC-23: the justification states the system day count and cites only policy rules. A violation
   * uses the existing single retry; a day count still missing after it is inserted by the server.
   */
  const checkBodyFacts = (bodyMarkdown: string, attemptNo: number) => {
    const body = checkBody(bodyMarkdown, days, policy.ruleIds)
    if (body.unknownRuleIds.length > 0) throw new OutputViolation("rule_id_not_in_policy")
    if (body.daysMissing && attemptNo < 2) throw new OutputViolation("day_count_missing")
  }
  const withDayCount = <T extends { bodyMarkdown: string }>(parsed: T, guardsApplied: string[]) => {
    const fixed = ensureDayCount(parsed.bodyMarkdown, days)
    return {
      parsed: { ...parsed, bodyMarkdown: fixed.bodyMarkdown },
      guardsApplied: [
        ...guardsApplied,
        ...(fixed.normalized ? ["day_count_normalized"] : []),
        ...(fixed.inserted ? ["day_count_inserted"] : []),
      ],
    }
  }

  // Writer for the rule and fast routes: the decision is locked, the model only writes the message.
  const writeMessage = async (route: "rule" | "fast", escalationReasons: string[], locked: Decision, lockedRefs: string[]) => {
    // A1: the date rule does not depend on the photo, so neutral findings are valid when signals are unavailable.
    const imageFindings = findingsFromSignals(signals, env.fastPathThreshold)
    state.route = route
    state.reasons = escalationReasons
    promptVersions.writer = loadPrompt("writer").version
    const startedAt = performance.now()
    let attempts = 0
    const attempt = async () => {
      attempts += 1
      const result = await withCallLog(
        { requestId, stage: "writer", modelId: env.llmModel, ...callLogSink, extractCost: (r) => openRouterCostOf(r.providerMetadata) },
        () =>
          generateText({
            ...buildWriterCall({
              caseInput, days, decision: locked, ruleRefs: lockedRefs, imageFindings, signalsSummary, policy: policy.text,
              reasoningEffort: env.reasoning.writer, model,
            }),
            abortSignal: signal,
          } as Parameters<typeof generateText>[0]),
      )
      const cost = openRouterCostOf(result.providerMetadata)
      if (cost !== undefined) modelCosts.push(cost)
      const parsed = WriterOutputSchema.safeParse(result.output)
      if (!parsed.success) throw new OutputViolation("schema")
      const guarded = guard(route, locked, lockedRefs, imageFindings, parsed.data.photoAdvice)
      checkBodyFacts(parsed.data.bodyMarkdown, attempts)
      return { parsed: parsed.data, guarded }
    }
    const attempted = await withOneRetry(attempt, signal)
    const { guarded } = attempted
    const { parsed, guardsApplied } = withDayCount(attempted.parsed, guarded.guardsApplied)
    durations.writer = Math.round(performance.now() - startedAt)
    return finish(
      route, escalationReasons,
      { decision: guarded.decision, ruleRefs: guarded.ruleRefs, remedy: null, imageFindings, ...parsed, photoAdvice: guarded.photoAdvice },
      guardsApplied, guarded.decision, guarded.ruleRefs,
    )
  }

  // Stage 3: deterministic date rules.
  const dateRule = applyDateRules(caseType, days)
  if (dateRule) return writeMessage("rule", [], dateRule.decision, dateRule.ruleRefs)

  // Stage 4: fast path (Akceptacja only; off by default, A1).
  const hasReason = caseInput.reason.trim().length > 0
  const gate = evaluateFastPath({
    caseType, category: caseInput.category, days, hasReason, signals, enabled: env.fastPathEnabled, threshold: env.fastPathThreshold,
  })
  if (gate.eligible) {
    return writeMessage("fast", [], "Akceptacja", fastRuleRefs(caseType, days))
  }
  const escalationReasons = [
    ...(!env.fastPathEnabled ? ["fast_path_disabled"] : []),
    ...(signals.status !== "ok" ? ["signals_unavailable"] : []),
    ...(env.fastPathEnabled && signals.status === "ok" ? gate.reasons : []),
  ]
  state.route = "escalated"
  state.reasons = escalationReasons

  // Stage 5: escalated decision.
  promptVersions.decision = loadPrompt(caseType === "return" ? "decision-return" : "decision-complaint").version
  const startedAt = performance.now()
  let attempts = 0
  const attempt = async () => {
    attempts += 1
    const result = await withCallLog(
      { requestId, stage: "escalated", modelId: env.llmModel, ...callLogSink, extractCost: (r) => openRouterCostOf(r.providerMetadata) },
      () =>
        generateText({
          ...buildEscalationCall({
            caseInput, days, signals, image, policy: policy.text, reasoningEffort: env.reasoning.decision, model,
          }),
          abortSignal: signal,
        } as Parameters<typeof generateText>[0]),
    )
    const cost = openRouterCostOf(result.providerMetadata)
    if (cost !== undefined) modelCosts.push(cost)
    const parsed = EscalatedDecisionOutputSchema.safeParse(result.output)
    if (!parsed.success) throw new OutputViolation("schema")
    const guarded = guard("escalated", parsed.data.decision, parsed.data.ruleRefs, parsed.data.imageFindings, parsed.data.photoAdvice)
    checkBodyFacts(parsed.data.bodyMarkdown, attempts)
    return { parsed: parsed.data, guarded }
  }
  const attempted = await withOneRetry(attempt, signal)
  const { guarded } = attempted
  const { parsed, guardsApplied } = withDayCount(attempted.parsed, guarded.guardsApplied)
  durations.decision = Math.round(performance.now() - startedAt)
  return finish("escalated", escalationReasons, { ...parsed, photoAdvice: guarded.photoAdvice }, guardsApplied, guarded.decision, guarded.ruleRefs)
}
