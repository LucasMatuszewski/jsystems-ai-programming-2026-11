import "./load-env"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

// ADR-006 3.1: records REAL HTTP exchanges with the running app (/api/cases).
//   pnpm record:app cases [name...]
//   pnpm record:app chat [name...]   (POST /api/chat, SSE; case context from a recorded T18 case)
// Env: APP_URL (default http://localhost:3000), APP_LOG (server stdout log file),
//      APP_URL_INVALID (default http://localhost:3001) + APP_LOG_INVALID for the
//      instance started with OPENROUTER_API_KEY=sk-or-v1-invalid.
// The upstream call count comes from the "[hsdc]" lines the server appended to its
// log file while the request ran (requests are sent one at a time).

const here = path.dirname(fileURLToPath(import.meta.url))
const appDir = path.resolve(here, "..")
const imagesDir = path.resolve(appDir, "..", "assets", "example-images")
const outDir = path.join(appDir, "tests", "fixtures", "app", "cases")

type Spec = {
  name: string
  instance?: "invalid"
  fields: Record<string, string>
  daysAgo?: number
  photo: string
  photoDir?: string
  mime: string
  notes: string
}

const REASON_C = "Ekran zaczął migać i pojawiły się kolorowe pasy, telefon nigdy nie upadł."
const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", svg: "image/svg+xml" }
const mime = (f: string) => MIME[f.split(".").pop() ?? ""] ?? "application/octet-stream"

const SPECS: Spec[] = [
  { name: "escalated-return-laptop-2.ndjson", fields: { caseType: "return", category: "laptop", model: "Lenovo ThinkPad E14", reason: "", consent: "true" }, daysAgo: 10, photo: "laptop-2.webp", mime: mime("x.webp"), notes: "Return, 10 days, no reason." },
  { name: "escalated-complaint-phone-1.ndjson", fields: { caseType: "complaint", category: "smartphone", model: "Samsung Galaxy A55", reason: REASON_C, consent: "true" }, daysAgo: 400, photo: "phone-1.jpg", mime: mime("x.jpg"), notes: "Complaint, 400 days." },
  { name: "rule-return-45d.ndjson", fields: { caseType: "return", category: "laptop", model: "Lenovo ThinkPad E14", reason: "Laptop przestał się ładować po miesiącu.", consent: "true" }, daysAgo: 45, photo: "laptop-1.png", mime: mime("x.png"), notes: "Return, 45 days." },
  { name: "rule-complaint-800d.ndjson", fields: { caseType: "complaint", category: "tablet", model: "Samsung Galaxy Tab A9", reason: "Tablet przestał się włączać, bateria nie trzyma ładunku.", consent: "true" }, daysAgo: 800, photo: "phone-2.jpeg", mime: mime("x.jpeg"), notes: "Complaint, 800 days." },
  { name: "mismatch-tv-phone-3.ndjson", fields: { caseType: "return", category: "tv", model: "Samsung QE55Q60D", reason: "", consent: "true" }, daysAgo: 5, photo: "phone-3.jpeg", mime: mime("x.jpeg"), notes: "Category tv with a phone photo (AC-27); whatever the model decides." },
  { name: "validation-400", fields: { caseType: "return", category: "laptop", model: "A", reason: "", purchaseDate: "2026-11-01" }, photo: "laptop-1.png", mime: mime("x.png"), notes: "Server-side validation: model too short, consent missing (client validation bypassed)." },
  { name: "unsupported-415", fields: { caseType: "return", category: "laptop", model: "Lenovo ThinkPad E14", reason: "", consent: "true" }, daysAgo: 10, photo: "logo.svg", photoDir: path.resolve(imagesDir, ".."), mime: mime("x.svg"), notes: "assets/logo.svg as the image." },
  { name: "upstream-failure.ndjson", instance: "invalid", fields: { caseType: "return", category: "laptop", model: "Lenovo ThinkPad E14", reason: "", consent: "true" }, daysAgo: 10, photo: "laptop-2.webp", mime: mime("x.webp"), notes: "Second server instance with OPENROUTER_API_KEY=sk-or-v1-invalid." },
]

function warsawDateMinus(days: number): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" })
  const d = new Date(Date.now() - days * 86_400_000)
  return fmt.format(d)
}

function pkgVersion(name: string): string {
  const p = path.join(appDir, "node_modules", ...name.split("/"), "package.json")
  return (JSON.parse(fs.readFileSync(p, "utf8")) as { version: string }).version
}

function logSize(file: string | undefined): number {
  return file && fs.existsSync(file) ? fs.statSync(file).size : 0
}

function logSince(file: string | undefined, offset: number): string[] {
  if (!file || !fs.existsSync(file)) return []
  const buf = fs.readFileSync(file)
  return buf.subarray(offset).toString("utf8").split("\n").filter((l) => l.includes("[hsdc]")).map((l) => l.slice(l.indexOf("[hsdc]") + 7))
}

async function record(spec: Spec) {
  const url = (spec.instance === "invalid" ? process.env.APP_URL_INVALID ?? "http://localhost:3001" : process.env.APP_URL ?? "http://localhost:3000") + "/api/cases"
  const log = spec.instance === "invalid" ? process.env.APP_LOG_INVALID : process.env.APP_LOG
  const fields = { ...spec.fields }
  if (spec.daysAgo !== undefined) fields.purchaseDate = warsawDateMinus(spec.daysAgo)
  const photoPath = path.join(spec.photoDir ?? imagesDir, spec.photo)
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.append(k, v)
  form.append("image", new Blob([fs.readFileSync(photoPath)], { type: spec.mime }), spec.photo)

  const offset = logSize(log)
  const started = Date.now()
  const res = await fetch(url, { method: "POST", body: form, signal: AbortSignal.timeout(120_000) })
  const body = await res.text()
  const durationMs = Date.now() - started
  await new Promise((r) => setTimeout(r, 500))
  const lines = logSince(log, offset)
  const upstream = lines.filter((l) => l.includes('"type":"upstream"'))
  const events = spec.name.includes(".ndjson")
    ? body.split("\n").filter(Boolean).map((l) => JSON.parse(l) as { type: string })
    : []
  const fixture = {
    meta: {
      capturedAt: new Date(started).toISOString(),
      target: "/api/cases",
      request: { method: "POST", contentType: "multipart/form-data", fields, photo: spec.photo, photoMime: spec.mime },
      appCommit: execSync("git rev-parse --short HEAD", { cwd: appDir }).toString().trim(),
      versions: { next: pkgVersion("next"), ai: pkgVersion("ai"), "@openrouter/ai-sdk-provider": pkgVersion("@openrouter/ai-sdk-provider") },
      durationMs,
      upstreamCalls: upstream.length,
      logLines: lines,
      script: "record-app.ts",
      notes: spec.notes,
    },
    response: { status: res.status, contentType: res.headers.get("content-type"), body },
  }
  fs.mkdirSync(outDir, { recursive: true })
  const file = spec.name.endsWith(".json") ? spec.name : `${spec.name}.json`
  fs.writeFileSync(path.join(outDir, file), JSON.stringify(fixture, null, 2) + "\n")
  const terminal = events.at(-1) as { type: string; code?: string; case?: { decision?: unknown } } | undefined
  console.log(JSON.stringify({ file, status: res.status, terminal: terminal?.type, code: terminal?.code, decision: terminal?.case?.decision, durationMs, upstreamCalls: upstream.length }))
}

const chatOutDir = path.join(appDir, "tests", "fixtures", "app", "chat")
const casesDir = path.join(appDir, "tests", "fixtures", "app", "cases")

type ChatSpec = {
  name: string
  instance?: "invalid"
  source: string
  userMessage: string
  expect: string
  notes: string
}

const LAPTOP = "escalated-return-laptop-2.ndjson"
const PHONE = "escalated-complaint-phone-1.ndjson"

const CHAT_SPECS: ChatSpec[] = [
  { name: "plain-return.sse", source: LAPTOP, userMessage: "Jak mam zapakować laptopa?", expect: "text, no tool, 1 chat-step", notes: "Clarifying question; expected no tool call." },
  { name: "update-return.sse", source: LAPTOP, userMessage: "Chcę dodać ważny fakt: laptop nigdy nie był używany, mam oryginalne opakowanie i wszystkie folie ochronne są na swoim miejscu. Smugi na płytce dotykowej to tylko odciski palców ze sklepu.", expect: "tool-update_recommendation output, then text, 2 chat-steps", notes: "New relevant fact; expected update_recommendation." },
  { name: "insist-complaint.sse", source: PHONE, userMessage: "Nie zgadzam się z tą oceną. Proszę o uznanie reklamacji, to moja ostateczna prośba.", expect: "no tool call", notes: "Insistence without new facts; expected no tool call (whatever happens is recorded)." },
  { name: "upstream-failure.sse", instance: "invalid", source: LAPTOP, userMessage: "Jak mam zapakować laptopa?", expect: "error chunk chat_failed, no provider text", notes: "Second server instance with OPENROUTER_API_KEY=sk-or-v1-invalid, request 1." },
  { name: "validation-400", source: LAPTOP, userMessage: "", expect: "400, 0 upstream lines", notes: "Empty last user message (client validation bypassed)." },
]

type LoadedCase = {
  caseId: string
  form: { caseType: string }
  daysSincePurchase: number
  decision: { decision: string; ruleRefs: unknown; imageFindings: unknown; signalsSummary: unknown }
  firstMessage: unknown
}

/** Case context and first assistant message exactly as the UI keeps them (CaseSessionPayload -> CaseContext + UIMessage). */
function loadCase(source: string): LoadedCase {
  const raw = JSON.parse(fs.readFileSync(path.join(casesDir, `${source}.json`), "utf8")) as { response: { body: string } }
  const last = raw.response.body.split("\n").filter(Boolean).map((l) => JSON.parse(l) as { type: string; case?: LoadedCase }).at(-1)
  if (last?.type !== "result" || !last.case) throw new Error(`${source}: no result event`)
  return last.case
}

async function recordChat(spec: ChatSpec) {
  const url = (spec.instance === "invalid" ? process.env.APP_URL_INVALID ?? "http://localhost:3001" : process.env.APP_URL ?? "http://localhost:3000") + "/api/chat"
  const log = spec.instance === "invalid" ? process.env.APP_LOG_INVALID : process.env.APP_LOG
  const c = loadCase(spec.source)
  const caseContext = {
    caseId: c.caseId,
    form: c.form,
    daysSincePurchase: c.daysSincePurchase,
    imageFindings: c.decision.imageFindings,
    signalsSummary: c.decision.signalsSummary,
    currentDecision: { decision: c.decision.decision, ruleRefs: c.decision.ruleRefs, source: "initial" },
  }
  const messages = [c.firstMessage, { id: "user-1", role: "user", parts: [{ type: "text", text: spec.userMessage }] }]
  const payload = { id: c.caseId, messages, caseContext }

  const offset = logSize(log)
  const started = Date.now()
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(120_000) })
  const body = await res.text()
  const durationMs = Date.now() - started
  await new Promise((r) => setTimeout(r, 500))
  const lines = logSince(log, offset)
  const upstream = lines.filter((l) => l.includes('"type":"upstream"'))
  const fixture = {
    meta: {
      capturedAt: new Date(started).toISOString(),
      target: "/api/chat",
      request: {
        method: "POST",
        contentType: "application/json",
        caseSource: `${spec.source}.json`,
        caseType: c.form.caseType,
        currentDecision: caseContext.currentDecision.decision,
        messageCount: messages.length,
        lastUserMessage: spec.userMessage,
        expected: spec.expect,
      },
      appCommit: execSync("git rev-parse --short HEAD", { cwd: appDir }).toString().trim(),
      versions: { next: pkgVersion("next"), ai: pkgVersion("ai"), "@openrouter/ai-sdk-provider": pkgVersion("@openrouter/ai-sdk-provider") },
      durationMs,
      upstreamCalls: upstream.length,
      logLines: lines,
      script: "record-app.ts",
      notes: spec.notes,
    },
    response: { status: res.status, contentType: res.headers.get("content-type"), body },
  }
  fs.mkdirSync(chatOutDir, { recursive: true })
  const file = spec.name.endsWith(".json") ? spec.name : `${spec.name}.json`
  fs.writeFileSync(path.join(chatOutDir, file), JSON.stringify(fixture, null, 2) + "\n")
  const chunks = res.status === 200
    ? body.split("\n\n").map((b) => b.replace(/^data: /, "").trim()).filter((d) => d && d !== "[DONE]").map((d) => JSON.parse(d) as { type: string; output?: { newDecision?: string }; errorText?: string })
    : []
  const tool = chunks.find((x) => x.type === "tool-output-available")
  console.log(JSON.stringify({
    file, status: res.status, toolCalled: chunks.some((x) => x.type.startsWith("tool-")), newDecision: tool?.output?.newDecision,
    error: chunks.find((x) => x.type === "error")?.errorText, text: chunks.some((x) => x.type === "text-delta"), durationMs, upstreamCalls: upstream.length,
  }))
}

async function main() {
  const [cmd, ...names] = process.argv.slice(2)
  if (cmd === "chat") {
    const chosenChat = names.length ? CHAT_SPECS.filter((s) => names.some((n) => s.name.startsWith(n))) : CHAT_SPECS
    for (const spec of chosenChat) await recordChat(spec)
    return
  }
  if (cmd !== "cases") throw new Error("usage: record-app cases|chat [name...]")
  const chosen = names.length ? SPECS.filter((s) => names.some((n) => s.name.startsWith(n))) : SPECS
  for (const spec of chosen) await record(spec)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
