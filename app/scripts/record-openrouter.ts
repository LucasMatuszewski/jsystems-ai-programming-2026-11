import "./load-env"
import { execSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { experimental_evaluate } from "ai"
import sharp from "sharp"
import {
  buildSignalQuestions,
  buildSignalStateText,
  type SignalCaseType,
} from "../server/ai/signals/questions"
import {
  type Capture,
  captureFromExchange,
  diffCapture,
  type RecordedResponse,
} from "./lib/structure-diff"

// ADR-006 3.1: records REAL OpenRouter exchanges at the HTTP level.
//   pnpm record:openrouter decisions | errors | refusal | --compare

const here = path.dirname(fileURLToPath(import.meta.url))
const appDir = path.resolve(here, "..")
const imagesDir = path.resolve(appDir, "..", "assets", "example-images")
const fixturesDir = path.join(appDir, "tests", "fixtures", "openrouter")
const MODEL = process.env.DECISION_MODEL ?? "typesafe/jev-1.14"
const REAL_KEY = process.env.OPENROUTER_API_KEY

type Exchange = {
  request: { method: string; url: string; bodySummary: unknown }
  response?: { status: number; headers: Record<string, string>; body: string }
  networkError?: { name: string; message: string; cause?: string }
  latencyMs: number
}

type Case = {
  file: string
  caseType: SignalCaseType
  category: string
  model: string
  reason: string
  photo: string
}

const CASES: Case[] = [
  { file: "return-laptop-2", caseType: "return", category: "laptop", model: "Lenovo ThinkPad E14", reason: "", photo: "laptop-2.webp" },
  { file: "return-phone-1", caseType: "return", category: "smartphone", model: "Samsung Galaxy A55", reason: "Telefon nie spełnia moich oczekiwań.", photo: "phone-1.jpg" },
  { file: "complaint-laptop-1", caseType: "complaint", category: "laptop", model: "Dell Latitude 5440", reason: "Zawias pękł podczas zwykłego otwierania pokrywy, laptop nigdy nie upadł.", photo: "laptop-1.png" },
  { file: "complaint-phone-3", caseType: "complaint", category: "smartphone", model: "Xiaomi Redmi Note 13", reason: "Ekran przestał reagować na dotyk w dolnej części bez żadnego upadku.", photo: "phone-3.jpeg" },
]

// ADR-002 rule 4: EXIF rotate, fit 1536x1536 without enlargement, JPEG q80, no metadata.
async function modelImage(photo: string): Promise<{ dataUrl: string; bytes: number }> {
  const input = fs.readFileSync(path.join(imagesDir, photo))
  const encode = (quality: number) =>
    sharp(input).rotate().resize(1536, 1536, { fit: "inside", withoutEnlargement: true }).jpeg({ quality }).toBuffer()
  let out = await encode(80)
  if (out.length > 1.5 * 1024 * 1024) out = await encode(65)
  return { dataUrl: `data:image/jpeg;base64,${out.toString("base64")}`, bytes: out.length }
}

function summarize(value: unknown, photo: string, bytes: number): unknown {
  if (typeof value === "string") {
    return value.startsWith("data:image/") ? `<image:${photo}, ${bytes} bytes>` : value
  }
  if (Array.isArray(value)) return value.map((v) => summarize(v, photo, bytes))
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, summarize(v, photo, bytes)]))
  }
  return value
}

function makeRecordingFetch(exchanges: Exchange[], photo: string, bytes: number): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    let body: unknown = null
    if (typeof init?.body === "string") {
      try { body = JSON.parse(init.body) } catch { body = "<non-json>" }
    }
    const request = { method: init?.method ?? "GET", url, bodySummary: summarize(body, photo, bytes) }
    const started = Date.now()
    try {
      const response = await fetch(input, init)
      const text = await response.clone().text()
      const headers: Record<string, string> = {}
      response.headers.forEach((v, k) => {
        if (k === "content-type" || k.startsWith("x-")) headers[k] = v
      })
      exchanges.push({ request, response: { status: response.status, headers, body: text }, latencyMs: Date.now() - started })
      return response
    } catch (error) {
      const e = error as Error & { cause?: { message?: string; code?: string } }
      exchanges.push({
        request,
        networkError: { name: e.name, message: e.message, ...(e.cause ? { cause: `${e.cause.code ?? ""} ${e.cause.message ?? ""}`.trim() } : {}) },
        latencyMs: Date.now() - started,
      })
      throw error
    }
  }) as typeof fetch
}

function pkgVersion(name: string): string {
  const p = path.join(appDir, "node_modules", ...name.split("/"), "package.json")
  return (JSON.parse(fs.readFileSync(p, "utf8")) as { version: string }).version
}

type RunOptions = { apiKey: string; baseURL?: string; questions?: ReturnType<typeof buildSignalQuestions> }

async function runCase(c: Case, o: RunOptions, extraNotes: string) {
  const img = await modelImage(c.photo)
  const exchanges: Exchange[] = []
  const provider = createOpenRouter({
    apiKey: o.apiKey,
    ...(o.baseURL ? { baseURL: o.baseURL } : {}),
    fetch: makeRecordingFetch(exchanges, c.photo, img.bytes),
  })
  const questions = o.questions ?? buildSignalQuestions(c.caseType, c.reason.trim().length > 0)
  const state = [
    buildSignalStateText(c),
    { type: "image_url", image_url: { url: img.dataUrl } },
  ]
  let sdkResult: unknown
  let error: { name: string; message: string } | undefined
  try {
    const result = await experimental_evaluate({
      model: provider.evaluationModel(MODEL),
      // The Decisions API takes images as image_url parts in the top-level state array.
      state: state as never,
      questions,
      maxRetries: 0,
    })
    sdkResult = JSON.parse(JSON.stringify({ answers: result.answers, usage: result.usage, warnings: result.warnings, rounding: result.rounding, providerMetadata: result.providerMetadata, response: { id: result.response.id, modelId: result.response.modelId, timestamp: result.response.timestamp } }))
  } catch (e) {
    const err = e as Error
    error = { name: err.name, message: err.message }
  }
  let provider_: string | undefined
  const ok = exchanges.find((x) => x.response?.status === 200)
  if (ok?.response) {
    try { provider_ = (JSON.parse(ok.response.body) as { provider?: string }).provider } catch { /* not json */ }
  }
  return {
    meta: {
      capturedAt: new Date().toISOString(),
      target: `${MODEL} POST /api/alpha/decisions`,
      request: { caseType: c.caseType, category: c.category, model: c.model, reason: c.reason, photo: c.photo, questionKeys: Object.keys(questions), modelImageBytes: img.bytes },
      appCommit: execSync("git rev-parse --short HEAD", { cwd: appDir }).toString().trim(),
      versions: { ai: pkgVersion("ai"), "@openrouter/ai-sdk-provider": pkgVersion("@openrouter/ai-sdk-provider") },
      provider: provider_ ?? null,
      script: "record-openrouter.ts",
      notes: `SDK call: experimental_evaluate + openrouter.evaluationModel, maxRetries 0. ${extraNotes}`.trim(),
    },
    exchanges,
    ...(sdkResult !== undefined ? { sdkResult } : {}),
    ...(error ? { error } : {}),
  }
}

function save(rel: string, data: unknown) {
  const file = path.join(fixturesDir, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n")
  console.log(`saved ${path.relative(appDir, file)} (${fs.statSync(file).size} bytes)`)
}

// --compare baseline: the success fixture when recorded, otherwise the newest
// upstream account_deactivated error recording (ADR-001 amendment A1).
function loadCompareBaseline(file: string): { label: string; capture: Capture } | { error: string } {
  const successRel = path.join("decisions", `${file}.json`)
  const successFile = path.join(fixturesDir, successRel)
  if (fs.existsSync(successFile)) {
    const fixture = JSON.parse(fs.readFileSync(successFile, "utf8")) as { exchanges: { response?: RecordedResponse }[] }
    return { label: `${successRel} (success fixture)`, capture: captureFromExchange(fixture.exchanges[0]?.response) }
  }
  const errorsDir = path.join(fixturesDir, "errors")
  const candidates = fs.existsSync(errorsDir)
    ? fs.readdirSync(errorsDir).filter((f) => /^decisions-upstream-account-deactivated-.*\.json$/.test(f))
    : []
  const recorded = candidates
    .map((f) => {
      const rel = path.join("errors", f)
      const parsed = JSON.parse(fs.readFileSync(path.join(fixturesDir, rel), "utf8")) as {
        meta?: { capturedAt?: string }
        exchanges?: { response?: RecordedResponse }[]
      }
      return { rel, capturedAt: parsed.meta?.capturedAt ?? "", response: parsed.exchanges?.[0]?.response }
    })
    .filter((x) => x.response !== undefined)
    .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : a.capturedAt > b.capturedAt ? -1 : 0))
  const newest = recorded[0]
  if (!newest) {
    return {
      error: `no baseline. Neither ${successRel} nor errors/decisions-upstream-account-deactivated-*.json exists under tests/fixtures/openrouter. Record one with \`pnpm record:openrouter decisions\` once the model is available.`,
    }
  }
  return {
    label: `${newest.rel} (newest upstream error recording, captured ${newest.capturedAt})`,
    capture: captureFromExchange(newest.response),
  }
}

function requireKey(): string {
  if (!REAL_KEY) {
    console.error("OPENROUTER_API_KEY is not set (root .env or app/.env.local).")
    process.exit(1)
  }
  return REAL_KEY
}


// ---------------------------------------------------------------------------
// `llm` command: records the production call builders (server/ai/calls) against
// the real reasoning model. Server modules are imported dynamically because
// `server-only` must resolve under the `react-server` condition (re-exec below).
// ---------------------------------------------------------------------------
const LLM_NAMES = [
  "escalated-return-laptop-2",
  "escalated-complaint-phone-1",
  "writer-rule-return-r4",
  "writer-rule-complaint-c2",
  "chat-plain",
  "chat-tool-update",
  "chat-401",
] as const
type LlmName = (typeof LLM_NAMES)[number]

const LLM_TODAY = "2026-11-26" // fixed clock so recordings are reproducible
const TOOL_UPDATED_AT = `${LLM_TODAY}T12:00:00.000Z`
const llmDir = path.join(fixturesDir, "llm")
const COMPLAINT_REASON = "Ekran zaczął migać i pojawiły się kolorowe pasy, telefon nigdy nie upadł."
const TOOL_MESSAGE =
  "Chcę dodać ważny fakt: telefon był w etui i nigdy nie miał kontaktu z wodą, a pasy pojawiły się po aktualizacji systemu."
const TOOL_MESSAGE_ALT =
  "Dodatkowa informacja: producent wydał oficjalny komunikat o wadzie ekranów w tej serii po aktualizacji oprogramowania, a mój egzemplarz nie ma żadnych śladów mechanicznych uszkodzeń."

function ensureReactServerCondition() {
  if (process.execArgv.some((a) => a.includes("react-server")) || process.env.RECORD_LLM_CHILD) return
  const r = spawnSync(process.execPath, [...process.execArgv, "--conditions=react-server", ...process.argv.slice(1)], {
    stdio: "inherit",
    env: { ...process.env, RECORD_LLM_CHILD: "1" },
  })
  process.exit(r.status ?? 1)
}

function daysBefore(today: string, days: number): string {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function readPolicy(caseType: "return" | "complaint"): string {
  return fs.readFileSync(path.resolve(appDir, "..", "docs", "policies", `${caseType}-policy.md`), "utf8")
}

function readLlmFixture(name: string): { meta: Record<string, unknown>; sdkResult: { output?: Record<string, unknown> } } {
  const file = path.join(llmDir, `${name}.json`)
  if (!fs.existsSync(file)) throw new Error(`Missing prerequisite recording ${name}.json (run it first).`)
  return JSON.parse(fs.readFileSync(file, "utf8")) as never
}

function usageCost(exchanges: Exchange[]): number | null {
  let cost: number | null = null
  for (const x of exchanges) {
    const body = x.response?.body ?? ""
    for (const m of body.matchAll(/"cost":\s*([0-9.eE+-]+)/g)) cost = (cost ?? 0) + Number(m[1])
  }
  return cost
}

async function recordLlm(name: LlmName, opts: { alt: boolean }) {
  ensureReactServerCondition()
  const { generateText, streamText, toUIMessageStream, tool } = await import("ai")
  const { createProvider } = await import("../server/ai/provider")
  const { buildEscalationCall } = await import("../server/ai/calls/escalation")
  const { buildWriterCall } = await import("../server/ai/calls/writer")
  const { buildChatCall, updateRecommendationToolSchema } = await import("../server/ai/calls/chat")
  const { loadPrompt } = await import("../server/ai/prompts")
  const { prepareForModel } = await import("../server/image")
  const { getEnv } = await import("../server/env")
  type PromptName = Parameters<typeof loadPrompt>[0]

  const key = name === "chat-401" ? "sk-or-v1-invalid" : requireKey()
  const env = getEnv()
  const exchanges: Exchange[] = []
  const recFetch = makeRecordingFetch(exchanges, "<photo>", 0)
  const provider = createProvider({ fetch: recFetch, apiKey: key })
  const model = provider.chat(env.llmModel)
  const promptsUsed: PromptName[] = []
  const trackPrompt = (p: PromptName) => {
    promptsUsed.push(p)
    return loadPrompt(p).version
  }

  type Meta = { request: Record<string, unknown>; effort: string; notes: string }
  let meta!: Meta
  let sdkResult: unknown
  let error: { name: string; message: string } | undefined
  let reasoningSeen: Record<string, unknown> | undefined

  const caseOf = (kind: "laptop" | "phone") =>
    kind === "laptop"
      ? { caseType: "return" as const, category: "laptop" as const, model: "Lenovo ThinkPad E14", reason: "", photo: "laptop-2.webp", days: 10 }
      : { caseType: "complaint" as const, category: "smartphone" as const, model: "Samsung Galaxy A55", reason: COMPLAINT_REASON, photo: "phone-1.jpg", days: 400 }

  const jsonClean = (v: unknown) => JSON.parse(JSON.stringify(v)) as unknown

  async function runGenerate(call: Parameters<typeof generateText>[0]) {
    try {
      const r = await generateText(call)
      sdkResult = jsonClean({
        output: r.output,
        finishReason: r.finishReason,
        usage: r.usage,
        providerMetadata: r.providerMetadata,
        reasoningText: r.reasoningText ?? null,
        response: { id: r.response.id, modelId: r.response.modelId, timestamp: r.response.timestamp },
      })
      reasoningSeen = { sdkReasoningChars: r.reasoningText?.length ?? 0 }
    } catch (e) {
      const err = e as Error
      error = { name: err.name, message: err.message }
    }
  }

  async function runStream(call: Awaited<ReturnType<typeof buildChatCall>>) {
    const streamErrors: string[] = []
    const result = streamText({ ...call, onError: ({ error: e }) => void streamErrors.push((e as Error)?.message ?? String(e)) } as Parameters<typeof streamText>[0])
    const parts: Array<Record<string, unknown>> = []
    const uiChunks: unknown[] = []
    const ui = toUIMessageStream({ stream: result.stream, tools: call.tools, sendReasoning: true })
    const reader = ui.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      uiChunks.push(value)
    }
    void parts
    let finishReason: unknown
    let usage: unknown
    try {
      finishReason = await result.finishReason
      usage = await result.totalUsage
    } catch {
      /* failed stream */
    }
    const types = uiChunks.map((c) => (c as { type: string }).type)
    const toolCalls = uiChunks.filter((c) => (c as { type: string }).type === "tool-input-available").map((c) => jsonClean(c))
    const text = uiChunks.filter((c) => (c as { type: string }).type === "text-delta").map((c) => (c as { delta: string }).delta).join("")
    const httpBody = exchanges.map((x) => x.response?.body ?? "").join("\n")
    reasoningSeen = {
      uiReasoningChunks: types.filter((t) => t.startsWith("reasoning")).length,
      httpReasoningDeltas: /"reasoning(_details|_content)?":\s*(\[|")/.test(httpBody),
    }
    sdkResult = jsonClean({ text, finishReason, usage, toolCalls, uiMessageChunkTypes: types, uiMessageChunks: uiChunks, streamErrors })
    if (streamErrors.length > 0) error = { name: "StreamError", message: streamErrors.join(" | ") }
  }

  const effortMap = { high: "high", low: "low", medium: "medium" } as const
  const firstMessageOf = (out: Record<string, unknown>, decision: string, ruleRefs: string[]) => ({
    id: "first-message",
    role: "assistant" as const,
    parts: [
      { type: "text" as const, text: String(out.greeting) },
      { type: "data-decision" as const, data: { decision, ruleRefs, kind: "initial", remedy: out.remedy ?? null } },
      { type: "text" as const, text: String(out.bodyMarkdown) },
    ],
  })

  if (name === "escalated-return-laptop-2" || name === "escalated-complaint-phone-1") {
    const c = caseOf(name === "escalated-return-laptop-2" ? "laptop" : "phone")
    const img = await prepareForModel(fs.readFileSync(path.join(imagesDir, c.photo)))
    const caseInput = { caseType: c.caseType, category: c.category, model: c.model, purchaseDate: daysBefore(LLM_TODAY, c.days), reason: c.reason }
    trackPrompt(c.caseType === "return" ? "decision-return" : "decision-complaint")
    meta = { request: { ...caseInput, days: c.days, photo: c.photo, modelImageBytes: img.bytes, signals: "unavailable" }, effort: "high", notes: "generateText + Output.object(EscalatedDecisionOutputSchema) via buildEscalationCall." }
    const call = buildEscalationCall({
      caseInput, days: c.days, signals: null, image: { buffer: img.buffer, mediaType: img.mediaType },
      policy: readPolicy(c.caseType), reasoningEffort: effortMap.high, model,
    })
    await runGenerate(call as Parameters<typeof generateText>[0])
  } else if (name === "writer-rule-return-r4" || name === "writer-rule-complaint-c2") {
    const isReturn = name === "writer-rule-return-r4"
    const c = caseOf(isReturn ? "laptop" : "phone")
    const days = isReturn ? 45 : 800
    const reason = isReturn ? "Laptop przestał się ładować po miesiącu." : COMPLAINT_REASON
    const source = readLlmFixture(isReturn ? "escalated-return-laptop-2" : "escalated-complaint-phone-1")
    const findings = source.sdkResult.output?.imageFindings
    if (!findings) throw new Error("source recording has no imageFindings")
    const caseInput = { caseType: c.caseType, category: c.category, model: c.model, purchaseDate: daysBefore(LLM_TODAY, days), reason }
    trackPrompt("writer")
    meta = { request: { ...caseInput, days, decision: "Odrzucenie", ruleRefs: [isReturn ? "R-4" : "C-2"], imageFindingsFrom: `${isReturn ? "escalated-return-laptop-2" : "escalated-complaint-phone-1"}.json` }, effort: "low", notes: "generateText + Output.object(WriterOutputSchema) via buildWriterCall; no image." }
    const call = buildWriterCall({
      caseInput, days, decision: "Odrzucenie", ruleRefs: [isReturn ? "R-4" : "C-2"],
      imageFindings: findings as never, signalsSummary: null,
      policy: readPolicy(c.caseType), reasoningEffort: effortMap.low, model,
    })
    await runGenerate(call as Parameters<typeof generateText>[0])
  } else {
    const isReturn = name === "chat-plain"
    const sourceName = isReturn ? "escalated-return-laptop-2" : "escalated-complaint-phone-1"
    const c = caseOf(isReturn ? "laptop" : "phone")
    const source = readLlmFixture(sourceName)
    const out = source.sdkResult.output
    if (!out) throw new Error("source recording has no output")
    const decision = String(out.decision)
    const ruleRefs = out.ruleRefs as string[]
    const caseContext = {
      caseId: "00000000-0000-4000-8000-000000000001",
      form: { caseType: c.caseType, category: c.category, model: c.model, purchaseDate: daysBefore(LLM_TODAY, c.days), reason: c.reason, consent: true as const },
      daysSincePurchase: c.days,
      imageFindings: out.imageFindings as never,
      signalsSummary: {},
      currentDecision: { decision: decision as never, ruleRefs, source: "initial" as const },
    }
    const userText = name === "chat-plain" ? "Jaki model urządzenia zgłosiłem?" : opts.alt ? TOOL_MESSAGE_ALT : TOOL_MESSAGE
    const messages = [
      firstMessageOf(out, decision, ruleRefs),
      { id: "user-1", role: "user" as const, parts: [{ type: "text" as const, text: userText }] },
    ]
    const tools = {
      update_recommendation: tool({
        ...updateRecommendationToolSchema,
        execute: async (input) => ({
          previousDecision: caseContext.currentDecision.decision,
          newDecision: input.decision,
          reason: input.reason,
          ruleRefs: input.ruleRefs,
          updatedAt: TOOL_UPDATED_AT,
        }),
      }),
    }
    trackPrompt(isReturn ? "chat-return" : "chat-complaint")
    meta = { request: { caseContext: { ...caseContext, imageFindings: "<from source recording>" }, contextFrom: `${sourceName}.json`, userMessage: userText, toolFixedClock: TOOL_UPDATED_AT }, effort: "medium", notes: `streamText via buildChatCall (stopWhen 2 steps), update_recommendation with a fixed-shape execute.${opts.alt ? " Alternate fact message (second attempt)." : ""}` }
    const call = await buildChatCall({
      caseContext, messages: messages as never, policy: readPolicy(c.caseType),
      model, reasoningEffort: effortMap.medium, tools,
    })
    await runStream(call)
  }

  const okEx = exchanges.find((x) => x.response?.status === 200)
  let providerName: string | undefined
  if (okEx?.response) {
    const m = /"provider":\s*"([^"]+)"/.exec(okEx.response.body)
    providerName = m?.[1]
  }
  const fixture = {
    meta: {
      capturedAt: new Date().toISOString(),
      target: `${env.llmModel} POST /api/v1/chat/completions`,
      request: meta.request,
      reasoningEffort: meta.effort,
      promptVersions: Object.fromEntries(promptsUsed.map((p) => [p, loadPrompt(p).version])),
      appCommit: execSync("git rev-parse --short HEAD", { cwd: appDir }).toString().trim(),
      versions: { ai: pkgVersion("ai"), "@openrouter/ai-sdk-provider": pkgVersion("@openrouter/ai-sdk-provider") },
      provider: providerName ?? null,
      costUsd: usageCost(exchanges),
      reasoningSeen: reasoningSeen ?? null,
      script: "record-openrouter.ts llm",
      notes: meta.notes,
    },
    exchanges,
    ...(sdkResult !== undefined ? { sdkResult } : {}),
    ...(error ? { error } : {}),
  }
  const rel = name === "chat-401" ? "errors/chat-401.json" : `llm/${name}.json`
  save(rel, fixture)
  const sdk = sdkResult as { output?: Record<string, unknown>; text?: string; toolCalls?: unknown[] } | undefined
  console.log(`  status ${exchanges.map((x) => x.response?.status ?? "net-error").join(",")}; cost ${fixture.meta.costUsd}; error ${error ? error.message.slice(0, 120) : "none"}`)
  if (sdk?.output) console.log(`  decision ${String(sdk.output.decision)} ${JSON.stringify(sdk.output.ruleRefs)}; greeting: ${String(sdk.output.greeting).slice(0, 100)}`)
  if (sdk?.text !== undefined) console.log(`  text: ${sdk.text.slice(0, 120)}; toolCalls ${sdk.toolCalls?.length ?? 0}`)
  console.log(`  reasoning: ${JSON.stringify(reasoningSeen)}`)
}

const command = process.argv[2]
const only = process.argv[3]

if (command === "decisions") {
  const key = requireKey()
  for (const c of CASES.filter((x) => !only || x.file === only)) {
    save(`decisions/${c.file}.json`, await runCase(c, { apiKey: key }, ""))
  }
} else if (command === "errors") {
  const c = CASES[0]!
  save("errors/decisions-401.json", await runCase(c, { apiKey: "sk-or-v1-invalid" }, "Invalid key on purpose."))
  save("errors/decisions-connection-failure.json", await runCase(c, { apiKey: "sk-or-v1-invalid", baseURL: "http://127.0.0.1:9/api/v1" }, "Closed local port, real network error."))
} else if (command === "refusal") {
  const key = requireKey()
  const c = CASES[0]!
  const questions = {
    owner_name: { type: "choice" as const, instructions: "Whose personal name is written on the device in the photo? Pick 'a_name_is_visible' only if a full personal name is legible.", criteria: { a_name_is_visible: null, no_name_visible: null } },
    photo_usable: { type: "boolean" as const, instructions: "The photo is sharp and well lit." },
  }
  const fixture = await runCase(c, { apiKey: key, questions }, "Refusal attempt with a harmless personal-name question.")
  const body = fixture.exchanges.map((e) => e.response?.body ?? "").join("")
  if (body.includes('"refusal"')) save("decisions/refusal-attempt.json", fixture)
  else console.log("No refusal produced; not saved (list in GAPS.md).")
} else if (command === "--compare") {
  const c = CASES[0]!
  // Baseline first: a missing baseline must fail without spending a live call.
  const baseline = loadCompareBaseline(c.file)
  if ("error" in baseline) {
    console.error(`compare: ${baseline.error}`)
    process.exit(2)
  }
  const key = requireKey()
  const live = await runCase(c, { apiKey: key }, "compare run")
  console.log(`compare: baseline = ${baseline.label}`)
  const diffs = diffCapture(baseline.capture, captureFromExchange(live.exchanges[0]?.response))
  if (diffs.length === 0) {
    console.log("compare: structure identical (HTTP status, keys and value types).")
  } else {
    console.log("compare: structural differences:")
    diffs.forEach((d) => console.log("  " + d))
    process.exit(1)
  }
} else if (command === "llm") {
  const alt = process.argv.includes("--alt")
  const requested = process.argv.slice(3).filter((a) => !a.startsWith("--"))
  const names = requested.length > 0 ? requested : [...LLM_NAMES]
  for (const n of names) {
    if (!(LLM_NAMES as readonly string[]).includes(n)) {
      console.error(`Unknown llm recording ${n}. Known: ${LLM_NAMES.join(", ")}`)
      process.exit(2)
    }
    console.log(`recording ${n}`)
    await recordLlm(n as LlmName, { alt })
  }
} else {
  console.error("Usage: pnpm record:openrouter decisions [file] | errors | refusal | --compare | llm [name...] [--alt]")
  process.exit(2)
}
