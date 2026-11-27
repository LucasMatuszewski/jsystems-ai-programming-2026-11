import "./load-env"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { generateText } from "ai"
import {
  EscalatedDecisionOutputSchema,
  WriterOutputSchema,
  type CaseFormValues,
  type Decision,
  type DecisionSignals,
  type ImageFindings,
  type SignalsSummary,
} from "@/lib/schemas"
import { todayInWarsaw } from "@/lib/dates"
import { buildEscalationCall } from "@/server/ai/calls/escalation"
import { buildWriterCall } from "@/server/ai/calls/writer"
import { applyGuards } from "@/server/ai/logic/guards"
import { daysSincePurchase } from "@/server/ai/logic/days"
import { evaluateFastPath } from "@/server/ai/logic/fast-path"
import { loadPolicy } from "@/server/ai/logic/policy"
import { fastRuleRefs } from "@/server/ai/pipeline/run-case-pipeline"
import { findingsFromSignals } from "@/server/ai/pipeline/image-findings"
import { prepareForModel } from "@/server/image"
import { createProvider } from "@/server/ai/provider"
import { getDecisionSignals } from "@/server/ai/signals/get-signals"
import { openRouterCostOf, withCallLog } from "@/server/ai/upstream"
import { getEnv } from "@/server/env"

// T26: decision evaluation. Runs the real pipeline building blocks (signals,
// fast-path gate, escalation call, writer call, guards) on the example photos
// for two synthetic case types, without writing the decision log.
// Usage: pnpm eval:decisions            (real OpenRouter calls, up to 30)
//        pnpm eval:decisions -- --check (loads modules, prints the plan, no calls)

const here = path.dirname(fileURLToPath(import.meta.url))
const appDir = path.resolve(here, "..")
const imagesDir = path.resolve(appDir, "..", "assets", "example-images")
const outDir = path.resolve(appDir, "..", "docs", "qa", "T26")

const CALL_TIMEOUT_MS = 90_000
const SYNTHETIC_MODEL = "Model testowy (eval T26)"
const SYNTHETIC_COMPLAINT_REASON = "Syntetyczny powod reklamacji do ewaluacji T26."

// Category comes from the file name only (README: the name says laptop or phone).
const PHOTOS: Array<{ file: string; category: CaseFormValues["category"] }> = [
  { file: "laptop-1.png", category: "laptop" },
  { file: "laptop-2.webp", category: "laptop" },
  { file: "phone-1.jpg", category: "smartphone" },
  { file: "phone-2.jpeg", category: "smartphone" },
  { file: "phone-3.jpeg", category: "smartphone" },
]

const CASE_TYPES: Array<{ caseType: CaseFormValues["caseType"]; daysAgo: number; reason: string }> = [
  { caseType: "return", daysAgo: 10, reason: "" },
  { caseType: "complaint", daysAgo: 400, reason: SYNTHETIC_COMPLAINT_REASON },
]

type CallStat = { latencyMs: number; costUsd: number | null; error?: string }

type CaseRun = {
  photo: string
  caseType: CaseFormValues["caseType"]
  category: CaseFormValues["category"]
  purchaseDate: string
  daysSincePurchase: number
  signals: { status: DecisionSignals["status"]; reason?: string; answers: Record<string, { value: string | number | boolean; confidence: number }>; durationMs: number; costUsd: number | null }
  gate: { eligible: boolean; reasons: string[] }
  escalated: { decision: Decision | null; ruleRefs: string[]; guardsApplied: string[]; violation?: string; call: CallStat }
  fast: { decision: Decision | null; ruleRefs: string[]; violation?: string; call: CallStat } | null
  agreement: boolean | null
  minConfidence: number | null
}

const summarize = (signals: DecisionSignals): SignalsSummary => {
  const summary: SignalsSummary = {}
  if (signals.status !== "ok") return summary
  for (const [key, answer] of Object.entries(signals.answers)) {
    summary[key] = { value: answer.value, confidence: answer.confidence }
  }
  return summary
}

function purchaseDateDaysAgo(daysAgo: number, now: Date): string {
  const [y, m, d] = todayInWarsaw(now).split("-").map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d - daysAgo)).toISOString().slice(0, 10)
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown"
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T } | { error: string; latencyMs: number }> {
  const startedAt = performance.now()
  try {
    return { value: await fn() }
  } catch (error) {
    return { error: errorName(error), latencyMs: Math.round(performance.now() - startedAt) }
  }
}

async function main(): Promise<void> {
  const checkOnly = process.argv.includes("--check")
  const startedAt = new Date()
  const env = getEnv()
  const policies = {
    return: loadPolicy("return", env.policiesDir),
    complaint: loadPolicy("complaint", env.policiesDir),
  }
  const threshold = env.fastPathThreshold

  const plan = PHOTOS.flatMap((photo) => CASE_TYPES.map((kase) => ({ photo, kase })))
  if (checkOnly) {
    console.log(`Plan: ${plan.length} cases, up to ${plan.length * 3} upstream calls. Threshold ${threshold}, fast path enabled in config: ${env.fastPathEnabled}.`)
    for (const { photo, kase } of plan) console.log(`- ${photo.file} x ${kase.caseType} (${photo.category}, ${kase.daysAgo} days)`)
    return
  }

  const provider = createProvider()
  const upstream: string[] = []
  const sink = (line: string) => upstream.push(line)
  const runs: CaseRun[] = []

  for (const { photo, kase } of plan) {
    const now = new Date()
    const original = fs.readFileSync(path.join(imagesDir, photo.file))
    const prepared = await prepareForModel(original)
    const image = { buffer: prepared.buffer, mediaType: prepared.mediaType }
    const purchaseDate = purchaseDateDaysAgo(kase.daysAgo, now)
    const caseInput = {
      caseType: kase.caseType,
      category: photo.category,
      model: SYNTHETIC_MODEL,
      purchaseDate,
      reason: kase.reason,
    }
    const days = daysSincePurchase(purchaseDate, now)
    const policy = policies[kase.caseType]
    const requestId = `t26-${runs.length + 1}`

    // Stage 2: signals (never throws; fail-closed to "unavailable").
    const signals = await getDecisionSignals(caseInput, image, {
      provider,
      modelId: env.decisionModel,
      requestId,
      callLogSink: sink,
    })

    // Stage 4 gate, evaluated with the gate forced on so the escalation and the fast path can be compared.
    const gate = evaluateFastPath({
      caseType: kase.caseType,
      category: photo.category,
      days,
      hasReason: kase.reason.trim().length > 0,
      signals,
      enabled: true,
      threshold,
    })

    const model = provider.chat(env.llmModel)

    // Stage 5: escalated decision (always run, for the agreement comparison).
    const escalationCall = await timed(async () => {
      const result = await withCallLog(
        { requestId, stage: "escalated", modelId: env.llmModel, sink, extractCost: (r) => openRouterCostOf(r.providerMetadata) },
        () =>
          generateText({
            ...buildEscalationCall({
              caseInput, days, signals, image, policy: policy.text, reasoningEffort: env.reasoning.decision, model,
            }),
            abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
          } as Parameters<typeof generateText>[0]),
      )
      return { result, cost: openRouterCostOf(result.providerMetadata) ?? null }
    })
    const escalated: CaseRun["escalated"] = { decision: null, ruleRefs: [], guardsApplied: [], call: { latencyMs: 0, costUsd: null } }
    if ("error" in escalationCall) {
      escalated.call = { latencyMs: escalationCall.latencyMs, costUsd: null, error: escalationCall.error }
    } else {
      const { result, cost } = escalationCall.value
      escalated.call = { latencyMs: 0, costUsd: cost }
      const parsed = EscalatedDecisionOutputSchema.safeParse(result.output)
      if (!parsed.success) {
        escalated.violation = "schema"
      } else {
        const guarded = applyGuards({
          caseType: kase.caseType, days, decision: parsed.data.decision, ruleRefs: parsed.data.ruleRefs,
          policyRuleIds: policy.ruleIds, signals, imageFindings: parsed.data.imageFindings, threshold,
          route: "escalated", photoAdvice: parsed.data.photoAdvice,
        })
        if ("violation" in guarded) escalated.violation = guarded.violation
        else {
          escalated.decision = guarded.decision
          escalated.ruleRefs = guarded.ruleRefs
          escalated.guardsApplied = guarded.guardsApplied
        }
      }
    }

    // Stage 4 fast path: writer call with the decision locked to Akceptacja.
    let fast: CaseRun["fast"] = null
    if (gate.eligible) {
      const ruleRefs = fastRuleRefs(kase.caseType, days)
      const imageFindings: ImageFindings = findingsFromSignals(signals, threshold)
      const writerCall = await timed(async () => {
        const result = await withCallLog(
          { requestId, stage: "writer", modelId: env.llmModel, sink, extractCost: (r) => openRouterCostOf(r.providerMetadata) },
          () =>
            generateText({
              ...buildWriterCall({
                caseInput, days, decision: "Akceptacja", ruleRefs, imageFindings, signalsSummary: summarize(signals),
                policy: policy.text, reasoningEffort: env.reasoning.writer, model,
              }),
              abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
            } as Parameters<typeof generateText>[0]),
        )
        return { result, cost: openRouterCostOf(result.providerMetadata) ?? null }
      })
      if ("error" in writerCall) {
        fast = { decision: null, ruleRefs, call: { latencyMs: writerCall.latencyMs, costUsd: null, error: writerCall.error } }
      } else {
        const parsed = WriterOutputSchema.safeParse(writerCall.value.result.output)
        const guarded = parsed.success
          ? applyGuards({
              caseType: kase.caseType, days, decision: "Akceptacja", ruleRefs, policyRuleIds: policy.ruleIds, signals,
              imageFindings, threshold, route: "fast", photoAdvice: parsed.data.photoAdvice,
            })
          : { violation: "schema" as const }
        fast = {
          decision: "violation" in guarded ? null : guarded.decision,
          ruleRefs: "violation" in guarded ? ruleRefs : guarded.ruleRefs,
          ...("violation" in guarded ? { violation: guarded.violation } : {}),
          call: { latencyMs: 0, costUsd: writerCall.value.cost },
        }
      }
    }

    const agreement = fast && fast.decision !== null && escalated.decision !== null
      ? fast.decision === escalated.decision
      : null
    const confidences = Object.values(signals.answers).map((a) => a.confidence)
    const minConfidence = signals.status === "ok" && confidences.length > 0 ? Math.min(...confidences) : null

    runs.push({
      photo: photo.file,
      caseType: kase.caseType,
      category: photo.category,
      purchaseDate,
      daysSincePurchase: days,
      signals: {
        status: signals.status,
        ...(signals.reason !== undefined ? { reason: signals.reason } : {}),
        answers: Object.fromEntries(Object.entries(signals.answers).map(([k, a]) => [k, { value: a.value, confidence: a.confidence }])),
        durationMs: signals.durationMs,
        costUsd: signals.cost,
      },
      gate: { eligible: gate.eligible, reasons: gate.eligible ? [] : gate.reasons },
      escalated,
      fast,
      agreement,
      minConfidence,
    })
    process.stderr.write(`done ${requestId} ${photo.file} ${kase.caseType}\n`)
  }

  const agreedAccept = runs.filter(
    (r) => r.agreement === true && r.fast?.decision === "Akceptacja" && r.escalated.decision === "Akceptacja",
  )
  const agreedMins = agreedAccept.map((r) => r.minConfidence).filter((v): v is number => v !== null)
  const suggestedMinConfidence = agreedMins.length > 0 ? Math.min(...agreedMins) : null
  const compared = runs.filter((r) => r.agreement !== null)
  const agreed = compared.filter((r) => r.agreement === true).length
  const totalCost = [
    ...runs.map((r) => r.signals.costUsd),
    ...runs.flatMap((r) => [r.escalated.call.costUsd, r.fast?.call.costUsd ?? null]),
  ].reduce<number>((sum, c) => sum + (c ?? 0), 0)

  const fmt = (v: number | null | undefined, digits = 3) => (v === null || v === undefined ? "-" : v.toFixed(digits))
  const out: string[] = []
  out.push(`# T26 decision evaluation (${startedAt.toISOString()})`, "")
  out.push(`Threshold ${threshold}, fast path enabled in config: ${env.fastPathEnabled}, signals model ${env.decisionModel}, decision model ${env.llmModel}.`, "")
  out.push("| # | Photo | Case | Gate | Signals | Min conf | Escalated | Fast | Agree | Latency sig/esc/fast (ms) | Cost USD |")
  out.push("|---|---|---|---|---|---|---|---|---|---|---|")
  runs.forEach((r, i) => {
    const gateText = r.gate.eligible ? "eligible" : `no: ${r.gate.reasons.join(", ")}`
    const escText = r.escalated.decision ?? `error ${r.escalated.call.error ?? r.escalated.violation ?? ""}`.trim()
    const fastText = r.fast ? (r.fast.decision ?? `error ${r.fast.call.error ?? r.fast.violation ?? ""}`.trim()) : "-"
    const agreeText = r.agreement === null ? "n/a" : r.agreement ? "yes" : "no"
    const cost = (r.signals.costUsd ?? 0) + (r.escalated.call.costUsd ?? 0) + (r.fast?.call.costUsd ?? 0)
    out.push(`| ${i + 1} | ${r.photo} | ${r.caseType} (${r.daysSincePurchase} d) | ${gateText} | ${r.signals.status}${r.signals.reason ? ` (${r.signals.reason})` : ""} | ${fmt(r.minConfidence, 2)} | ${escText} | ${fastText} | ${agreeText} | ${r.signals.durationMs}/${r.escalated.call.latencyMs}/${r.fast?.call.latencyMs ?? "-"} | ${fmt(cost, 5)} |`)
  })
  out.push("")
  out.push("## Signals per run", "")
  runs.forEach((r, i) => {
    const answers = Object.entries(r.signals.answers).map(([k, a]) => `${k}=${String(a.value)}@${a.confidence.toFixed(2)}`).join(", ")
    out.push(`${i + 1}. ${r.photo} ${r.caseType}: ${answers || "no answers"}`)
  })
  out.push("")
  out.push(`Agreement: ${agreed}/${compared.length} compared cases (${compared.length ? ((100 * agreed) / compared.length).toFixed(0) : "-"}%).`)
  out.push(`Upstream lines: ${upstream.length}. Total cost USD ${totalCost.toFixed(5)} (upstream, not billed to the key under BYOK).`)
  out.push(
    suggestedMinConfidence === null
      ? "Threshold suggestion: no case where fast path and escalation both agreed on Akceptacja; no minimum to suggest."
      : `Threshold suggestion: minimum signal confidence among the ${agreedAccept.length} cases where fast path and escalation agreed on Akceptacja is ${suggestedMinConfidence.toFixed(2)} (current threshold ${threshold}). Input for calibration only; threshold not changed.`,
  )
  console.log(out.join("\n"))

  fs.mkdirSync(outDir, { recursive: true })
  const stamp = startedAt.toISOString().replace(/[:.]/g, "-")
  const jsonPath = path.join(outDir, `eval-${stamp}.json`)
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        threshold,
        fastPathEnabledInConfig: env.fastPathEnabled,
        modelIds: { signals: env.decisionModel, llm: env.llmModel },
        runs,
        upstreamLines: upstream,
        agreement: { agreed, compared: compared.length },
        suggestion: { minConfidenceAgreedAccept: suggestedMinConfidence, agreedAcceptCases: agreedAccept.length },
        totalCostUsd: totalCost,
      },
      null,
      2,
    ) + "\n",
  )
  console.log(`JSON: ${jsonPath}`)
}

await main()
