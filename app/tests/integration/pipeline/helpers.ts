import fs from "node:fs"
import path from "node:path"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import type { CaseFormValues, CaseDecision } from "@/lib/schemas"
import { withJustificationDays } from "../../helpers/day-count-variant"
import { loadFixture, replayFetch, type Fixture } from "../../helpers/replay-fetch"

export const fixturesDir = path.resolve(__dirname, "../../fixtures/openrouter")
export const llmFixture = (name: string) => path.join(fixturesDir, "llm", `${name}.json`)
export const errorFixture = (name: string) => path.join(fixturesDir, "errors", `${name}.json`)
/** Real recording: signals endpoint answered 401 account_deactivated (ADR-001 A1). */
export const SIGNALS_UNAVAILABLE = errorFixture("decisions-upstream-account-deactivated-1")

export const NOW = new Date("2026-11-26T10:00:00+01:00")
export const now = () => NOW
export const IMAGE = { buffer: Buffer.from("synthetic-image-bytes"), mediaType: "image/webp" }

type RecordedRequest = { caseType: "return" | "complaint"; category: CaseFormValues["category"]; model: string; purchaseDate: string; reason: string }

/** Case input exactly as it was recorded in the named LLM fixture. */
export function caseFrom(fixtureName: string, dir: "llm" | "errors" = "llm"): CaseFormValues {
  const f = loadFixture(path.join(fixturesDir, dir, `${fixtureName}.json`))
  const r = f.meta.request as RecordedRequest
  return { caseType: r.caseType, category: r.category, model: r.model, purchaseDate: r.purchaseDate, reason: r.reason, consent: true }
}

/**
 * Derived variant of a real recording: same exchange, one field of the model's JSON output changed.
 * Only the `mutate` callback changes data; everything else (headers, usage, ids) stays as recorded.
 */
export function deriveVariant(base: string | Fixture, mutate: (output: Record<string, unknown>) => void): Fixture {
  const fixture = typeof base === "string" ? loadFixture(base) : base
  const exchange = fixture.exchanges[0]!
  const body = JSON.parse(exchange.response!.body.trim()) as { choices: Array<{ message: { content: string } }> }
  const output = JSON.parse(body.choices[0]!.message.content) as Record<string, unknown>
  mutate(output)
  body.choices[0]!.message.content = JSON.stringify(output)
  return { ...fixture, exchanges: [{ ...exchange, response: { ...exchange.response!, body: JSON.stringify(body) } }] }
}

export function recordedOutput(name: string): Record<string, unknown> {
  return (JSON.parse(fs.readFileSync(llmFixture(name), "utf8")) as { sdkResult: { output: Record<string, unknown> } }).sdkResult.output
}

export function setup(sources: Array<string | Fixture>) {
  const provider = createOpenRouter({ apiKey: "test", fetch: replayFetch(sources) })
  const callLog: string[] = []
  const decisionLog: unknown[] = []
  const stages: string[] = []
  const deps = {
    provider,
    now,
    requestId: "req-pipeline-1",
    callLogSink: (line: string) => callLog.push(line),
    decisionLogSink: async (entry: unknown) => {
      decisionLog.push(entry)
    },
    onStage: (stage: "decision") => stages.push(stage),
  }
  return { deps, callLog, decisionLog, stages, calls: () => callLog.map((l) => JSON.parse(l) as { stage: string; outcome: string; status?: number }) }
}

/** TAC-001-03 registry: every decision produced anywhere in the suite. */
export const produced: CaseDecision[] = []

/** The recorded output with the day count added to the justification (AC-23); see `withJustificationDays`. */
export const withDays = (name: string) => withJustificationDays(llmFixture(name))
