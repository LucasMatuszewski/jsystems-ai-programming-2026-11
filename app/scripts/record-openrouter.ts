import "./load-env"
import { execSync } from "node:child_process"
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

// ADR-006 3.1: records REAL OpenRouter exchanges at the HTTP level.
//   pnpm record:openrouter decisions | errors | refusal | --compare

const here = path.dirname(fileURLToPath(import.meta.url))
const appDir = path.resolve(here, "..")
const imagesDir = path.resolve(appDir, "..", "assets", "example-images")
const fixturesDir = path.join(appDir, "tests", "fixtures", "openrouter")
const MODEL = process.env.DECISION_MODEL ?? "openai/gpt-6-luna-decisions"
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

function shape(v: unknown): unknown {
  if (Array.isArray(v)) return v.length ? [shape(v[0])] : []
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).sort().map(([k, x]) => [k, shape(x)]))
  return v === null ? "null" : typeof v
}

function diffShape(a: unknown, b: unknown, at = ""): string[] {
  if (typeof a === "string" || typeof b === "string" || a === undefined || b === undefined) {
    return a === b ? [] : [`${at || "(root)"}: fixture=${JSON.stringify(a)} live=${JSON.stringify(b)}`]
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) ? (a.length && b.length ? diffShape(a[0], b[0], `${at}[]`) : []) : [`${at}: array mismatch`]
  }
  const ao = a as Record<string, unknown>, bo = b as Record<string, unknown>
  const out: string[] = []
  for (const k of new Set([...Object.keys(ao), ...Object.keys(bo)])) {
    if (!(k in ao)) out.push(`${at}.${k}: only in live`)
    else if (!(k in bo)) out.push(`${at}.${k}: only in fixture`)
    else out.push(...diffShape(ao[k], bo[k], `${at}.${k}`))
  }
  return out
}

function requireKey(): string {
  if (!REAL_KEY) {
    console.error("OPENROUTER_API_KEY is not set (root .env or app/.env.local).")
    process.exit(1)
  }
  return REAL_KEY
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
  const key = requireKey()
  const c = CASES[0]!
  const fixture = JSON.parse(fs.readFileSync(path.join(fixturesDir, "decisions", `${c.file}.json`), "utf8")) as { exchanges: Exchange[] }
  const live = await runCase(c, { apiKey: key }, "compare run")
  const recordedBody = JSON.parse(fixture.exchanges[0]!.response!.body) as unknown
  const liveBody = JSON.parse(live.exchanges[0]?.response?.body ?? "null") as unknown
  const diffs = diffShape(shape(recordedBody), shape(liveBody))
  if (diffs.length === 0) {
    console.log("compare: structure identical (keys and value types).")
  } else {
    console.log("compare: structural differences:")
    diffs.forEach((d) => console.log("  " + d))
    process.exit(1)
  }
} else {
  console.error("Usage: pnpm record:openrouter decisions [file] | errors | refusal | --compare")
  process.exit(2)
}
