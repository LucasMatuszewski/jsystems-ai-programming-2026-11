import path from "node:path"
import { vi } from "vitest"
import type { UIMessage } from "ai"
import { loadFixture, type Fixture } from "../../helpers/replay-fetch"
import { chatContext, errorsDir, llmDir, readRecording } from "../replay-llm/helpers"

export { chatContext, errorsDir, llmDir }

export const NOW = new Date("2026-11-26T12:00:00.000Z")

export function stubEnv() {
  vi.stubEnv("OPENROUTER_API_KEY", "sk-or-v1-replay-not-a-real-key")
}

export const fixturePath = (dir: string, name: string) => path.join(dir, `${name}.json`)

type Sse = { choices?: { delta?: { tool_calls?: { function?: { arguments?: string } }[] } }[] }

/**
 * DERIVED variant of a real recording (never a hand-written stream): the tool-call
 * argument chunks of exchange 1 are replaced by `input` serialised as JSON; everything
 * else (ids, text step, usage, headers) is kept verbatim.
 */
export function withToolInput(base: string, input: unknown): Fixture {
  const fixture = loadFixture(base)
  const first = fixture.exchanges[0]!
  const json = JSON.stringify(input)
  let placed = false
  const body = first.response!.body.replace(/^data: (\{.*\})$/gm, (line, payload: string) => {
    const parsed = JSON.parse(payload) as Sse
    const call = parsed.choices?.[0]?.delta?.tool_calls?.[0]?.function
    if (call?.arguments === undefined || call.arguments === "") return line
    call.arguments = placed ? "" : json
    placed = true
    return `data: ${JSON.stringify(parsed)}`
  })
  if (!placed) throw new Error("withToolInput: no tool-call argument chunk found")
  return { ...fixture, exchanges: [{ ...first, response: { ...first.response!, body } }, ...fixture.exchanges.slice(1)] }
}

/** Request body exactly as the recording's meta describes (case context + messages). */
export function bodyFor(source: string, caseType: "return" | "complaint", userMessage: string, over: Record<string, unknown> = {}) {
  const ctx = chatContext(source, caseType)
  const out = readRecording(source).sdkResult.output!
  const messages: UIMessage[] = [
    {
      id: "first",
      role: "assistant",
      parts: [
        { type: "text", text: String(out.greeting) },
        { type: "data-decision", data: { decision: ctx.currentDecision.decision, ruleRefs: ctx.currentDecision.ruleRefs, kind: "initial", remedy: null } },
        { type: "text", text: String(out.bodyMarkdown) },
      ],
    },
    { id: "u1", role: "user", parts: [{ type: "text", text: userMessage }] },
  ]
  return { id: "chat-1", messages, caseContext: ctx, ...over }
}

export const PLAIN = { source: "escalated-return-laptop-2", type: "return", text: "Jaki model urządzenia zgłosiłem?" } as const
export const TOOL = {
  source: "escalated-complaint-phone-1",
  type: "complaint",
  text: "Chcę dodać ważny fakt: telefon był w etui i nigdy nie miał kontaktu z wodą, a pasy pojawiły się po aktualizacji systemu.",
} as const

export async function readChunks(response: Response) {
  const text = await response.text()
  return text
    .split("\n\n")
    .map((block) => block.replace(/^data: /, "").trim())
    .filter((data) => data && data !== "[DONE]")
    .map((data) => JSON.parse(data) as { type: string; [k: string]: unknown })
}

export const jsonRequest = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
