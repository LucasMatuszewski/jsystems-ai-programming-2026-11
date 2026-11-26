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

export type Recorded = { name: string; chunkSizes?: number[]; gate?: Promise<void> }

/** A `fetch` that replays the given recordings one per request and records every request body. */
export function replayChatFetch(...recorded: Recorded[]) {
  const bodies: Array<Record<string, unknown>> = []
  const impl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
    const next = recorded[Math.min(bodies.length - 1, recorded.length - 1)]
    if (!next) throw new Error("no recording left")
    if (next.gate) await next.gate
    return replayAppResponse(chatFixture(next.name), { chunkSizes: next.chunkSizes ?? [37, 101, 7] })
  })
  return { fetch: impl as unknown as typeof fetch, calls: impl, bodies }
}

export const payload = loadPayload("escalated-return-laptop-2.ndjson.json")

export function storedSession(): StoredSession {
  return { version: 1, case: payload, messages: [payload.firstMessage] }
}

export function renderChat(fetchImpl: typeof fetch, session: StoredSession = storedSession()) {
  return render(<ChatSession session={session} fetch={fetchImpl} onNewCase={vi.fn()} />)
}

export const readStored = () => JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null") as StoredSession | null
