import fs from "node:fs"
import path from "node:path"
import { render } from "@testing-library/react"
import { vi } from "vitest"
import { ChatSession } from "@/components/case-flow/chat-session"
import { SESSION_KEY } from "@/lib/session-store"
import type { StoredSession } from "@/lib/schemas"
import { replayAppResponse } from "../../../helpers/replay-app"
import { loadPayload } from "../../case-summary/load-payload"

/** ADR-006: bodies come from the T24 recordings of /api/chat, cut into odd byte chunks. */
export const chatFixture = (name: string) => path.resolve(process.cwd(), "tests/fixtures/app/chat", `${name}.sse.json`)

export type Recorded = {
  name: string
  chunkSizes?: number[]
  gate?: Promise<void>
  /** DERIVED variant: maps the recorded SSE body to another body built from recorded bytes. */
  derive?: (recordedBody: string) => string
  /** DERIVED variant: the first part of the recorded body is delivered, then the connection fails. */
  dropAfter?: (recordedBody: string) => string
}

function recordedBody(name: string): { status: number; contentType: string | null; body: string } {
  return (JSON.parse(fs.readFileSync(chatFixture(name), "utf8")) as { response: { status: number; contentType: string | null; body: string } }).response
}

/** The `error` event of the recorded upstream-failure stream, exactly as recorded (`data: {...}\n\n`). */
export function chatErrorChunk(): string {
  const block = recordedBody("upstream-failure").body.split("\n\n").find((b) => b.includes('"type":"error"'))
  if (!block) throw new Error("no error chunk in the upstream-failure recording")
  return `${block}\n\n`
}

function derivedResponse(recorded: Recorded): Response | null {
  const { status, contentType, body } = recordedBody(recorded.name)
  const headers = contentType ? { "content-type": contentType } : undefined
  if (recorded.derive) return new Response(recorded.derive(body), { status, ...(headers && { headers }) })
  if (recorded.dropAfter) {
    const head = new TextEncoder().encode(recorded.dropAfter(body))
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(head)
      },
      pull(controller) {
        controller.error(new TypeError("network error"))
      },
    })
    return new Response(stream, { status, ...(headers && { headers }) })
  }
  return null
}

/** A `fetch` that replays the given recordings one per request and records every request body. */
export function replayChatFetch(...recorded: Recorded[]) {
  const bodies: Array<Record<string, unknown>> = []
  const impl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
    const next = recorded[Math.min(bodies.length - 1, recorded.length - 1)]
    if (!next) throw new Error("no recording left")
    if (next.gate) await next.gate
    return derivedResponse(next) ?? replayAppResponse(chatFixture(next.name), { chunkSizes: next.chunkSizes ?? [37, 101, 7] })
  })
  return { fetch: impl as unknown as typeof fetch, calls: impl, bodies }
}

export const payload = loadPayload("escalated-return-laptop-2.ndjson.json")

export function storedSession(): StoredSession {
  return { version: 1, case: payload, messages: [payload.firstMessage] }
}

export function renderChat(fetchImpl: typeof fetch, session: StoredSession = storedSession(), extra: { storageUnavailable?: boolean } = {}) {
  return render(<ChatSession session={session} fetch={fetchImpl} onNewCase={vi.fn()} {...extra} />)
}

export const readStored = () => JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null") as StoredSession | null
