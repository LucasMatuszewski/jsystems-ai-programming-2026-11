import { beforeAll, describe, expect, it, vi } from "vitest"
import { bodyFor, fixturePath, hangingFetch, jsonRequest, llmDir, NOW, PLAIN, readChunks, stallingFetchAfter, stubEnv } from "./helpers"

vi.mock("server-only", () => ({}))

// AC-42 / AC-43 (T28 F1): a chat timeout or a mid-stream abort ends the stream with the masked
// `chat_failed` error chunk, never with an `abort` chunk and never with TimeoutError text.
// Doubles: a stalled upstream (no body) and a DERIVED variant of the chat-plain recording whose
// connection stalls after its first 5 SSE events.

describe("POST /api/chat handler: timeout and abort end with the masked error chunk", () => {
  let handleChatRequest: typeof import("@/server/ai/chat/handle-chat").handleChatRequest
  let createProvider: typeof import("@/server/ai/provider").createProvider
  let getEnv: typeof import("@/server/env").getEnv

  beforeAll(async () => {
    stubEnv()
    ;({ handleChatRequest } = await import("@/server/ai/chat/handle-chat"))
    ;({ createProvider } = await import("@/server/ai/provider"))
    ;({ getEnv } = await import("@/server/env"))
  })

  async function run(fetchImpl: typeof fetch, abortSignal: AbortSignal) {
    const response = await handleChatRequest(jsonRequest(bodyFor(PLAIN.source, PLAIN.type, PLAIN.text)), {
      provider: createProvider({ fetch: fetchImpl }),
      env: getEnv({ OPENROUTER_API_KEY: "test" }),
      now: () => NOW,
      requestId: "req-1",
      callLogSink: () => {},
      abortSignal,
    })
    expect(response.status).toBe(200)
    return readChunks(response)
  }

  function expectMaskedError(chunks: Array<{ type: string; [k: string]: unknown }>) {
    expect(chunks.filter((c) => c.type === "error")).toEqual([{ type: "error", errorText: "chat_failed" }])
    expect(chunks.some((c) => c.type === "abort")).toBe(false)
    expect(JSON.stringify(chunks)).not.toMatch(/TimeoutError|AbortError|aborted|timeout/i)
  }

  it("timeout before the first chunk (stalled upstream): error chunk chat_failed", async () => {
    expectMaskedError(await run(hangingFetch, AbortSignal.timeout(150)))
  })

  it("abort mid-stream (derived from chat-plain, stalls after 5 events): partial text, then error chunk chat_failed", async () => {
    const chunks = await run(stallingFetchAfter(fixturePath(llmDir, "chat-plain"), 5), AbortSignal.timeout(150))
    expect(chunks.some((c) => c.type === "text-delta")).toBe(true)
    expectMaskedError(chunks)
    expect(chunks.at(-1)).toEqual({ type: "error", errorText: "chat_failed" })
  })
})
