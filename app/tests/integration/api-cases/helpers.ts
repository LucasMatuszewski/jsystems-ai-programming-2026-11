import fs from "node:fs"
import path from "node:path"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { getEnv } from "@/server/env"
import { replayFetch, type Fixture } from "../../helpers/replay-fetch"

// Real example photos and the logo (ADR-002 8, AGENTS: upload tests use only real files).
export const EXAMPLES = path.resolve(__dirname, "../../../../assets/example-images")
export const LOGO_SVG = path.resolve(__dirname, "../../../../assets/logo.svg")
export const FIXTURES = path.resolve(__dirname, "../../fixtures/openrouter")
export const fixture = (dir: "llm" | "errors", name: string) => path.join(FIXTURES, dir, `${name}.json`)

/** Real recording: signals endpoint answered 401 account_deactivated (ADR-001 A1). */
export const SIGNALS_UNAVAILABLE = fixture("errors", "decisions-upstream-account-deactivated-1")

export const NOW = new Date("2026-11-26T10:00:00+01:00")
export const now = () => NOW

export const RETURN_FORM = {
  caseType: "return",
  category: "laptop",
  model: "Lenovo ThinkPad E14",
  purchaseDate: "2026-11-16",
  reason: "",
  consent: "true",
}

export const COMPLAINT_FORM = {
  caseType: "complaint",
  category: "smartphone",
  model: "Samsung Galaxy A55",
  purchaseDate: "2025-10-22",
  reason: "Ekran zaczął migać i pojawiły się kolorowe pasy, telefon nigdy nie upadł.",
  consent: "true",
}

export type FormFields = Record<string, string>

export function imageFile(filePath: string, type: string): File {
  return new File([fs.readFileSync(filePath)], path.basename(filePath), { type })
}

export function buildRequest(
  fields: FormFields,
  options: { image?: File | null; headers?: Record<string, string>; signal?: AbortSignal } = {},
): Request {
  const body = new FormData()
  for (const [name, value] of Object.entries(fields)) body.append(name, value)
  if (options.image) body.append("image", options.image)
  return new Request("http://localhost:3000/api/cases", {
    method: "POST",
    body,
    ...(options.headers ? { headers: options.headers } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  })
}

export async function readNdjson(response: Response): Promise<Array<Record<string, unknown>>> {
  const text = await response.text()
  return text
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>)
}

export function harness(sources: Array<string | Fixture> = []) {
  let fetchCalls = 0
  const replay = replayFetch(sources)
  const countingFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls += 1
    return replay(input, init)
  }) as typeof fetch
  const provider = createOpenRouter({ apiKey: "test", fetch: countingFetch })
  const logLines: string[] = []
  const decisionLog: unknown[] = []
  const pipelineDeps = {
    env: getEnv({ OPENROUTER_API_KEY: "test", DECISION_LOG_PATH: "" }),
    provider,
    now,
    decisionLogSink: async (entry: unknown) => {
      decisionLog.push(entry)
    },
  }
  const parsed = () => logLines.map((line) => JSON.parse(line) as Record<string, unknown>)
  return {
    deps: {
      now,
      requestId: "req-cases-1",
      callLogSink: (line: string) => logLines.push(line),
      pipelineDeps,
    },
    decisionLog,
    fetchCalls: () => fetchCalls,
    upstreamLines: () => parsed().filter((line) => line.type === "upstream"),
    incomingLines: () => parsed().filter((line) => line.type === "incoming"),
  }
}
