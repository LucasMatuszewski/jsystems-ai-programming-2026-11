import { beforeAll, describe, expect, it, vi } from "vitest"
import { bodyFor, jsonRequest, NOW, PLAIN, stubEnv } from "./helpers"

vi.mock("server-only", () => ({}))

describe("POST /api/chat handler: request validation (no upstream call)", () => {
  let handleChatRequest: typeof import("@/server/ai/chat/handle-chat").handleChatRequest
  let createProvider: typeof import("@/server/ai/provider").createProvider
  let getEnv: typeof import("@/server/env").getEnv

  beforeAll(async () => {
    stubEnv()
    ;({ handleChatRequest } = await import("@/server/ai/chat/handle-chat"))
    ;({ createProvider } = await import("@/server/ai/provider"))
    ;({ getEnv } = await import("@/server/env"))
  })

  const base = () => bodyFor(PLAIN.source, PLAIN.type, PLAIN.text)
  const user = (text: string) => ({ id: "u", role: "user", parts: [{ type: "text", text }] })

  async function call(request: Request, env = getEnv({ OPENROUTER_API_KEY: "test" })) {
    const upstream = vi.fn(async () => new Response("{}"))
    const response = await handleChatRequest(request, {
      provider: createProvider({ fetch: upstream as unknown as typeof fetch }),
      env, now: () => NOW, requestId: "req-1", callLogSink: () => {},
    })
    return { response, upstream }
  }

  it.each([
    ["61 messages", () => ({ ...base(), messages: Array.from({ length: 61 }, (_, i) => (i % 2 === 0 ? user("a") : { ...user("b"), role: "assistant" })) })],
    ["2001 characters", () => ({ ...base(), messages: [user("x".repeat(2001))] })],
    ["empty last message", () => ({ ...base(), messages: [user("   ")] })],
    ["unknown data part", () => ({ ...base(), messages: [{ id: "a", role: "assistant", parts: [{ type: "data-unknown", data: {} }] }, user("Cześć")] })],
    ["last message from the assistant", () => ({ ...base(), messages: [{ id: "a", role: "assistant", parts: [{ type: "text", text: "Hej" }] }] })],
    ["invalid decision payload", () => ({ ...base(), messages: [{ id: "a", role: "assistant", parts: [{ type: "data-decision", data: { decision: "X" } }] }, user("Cześć")] })],
  ])("%s gives 400 validation_failed and no upstream call", async (_name, make) => {
    const { response, upstream } = await call(jsonRequest(make()))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ code: "validation_failed" })
    expect(upstream).not.toHaveBeenCalled()
  })

  it("invalid JSON gives 400", async () => {
    const { response, upstream } = await call(jsonRequest("{nope"))
    expect(response.status).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
  })

  it("a body over 512 KB gives 413 file_too_large", async () => {
    const { response, upstream } = await call(jsonRequest({ ...base(), padding: "x".repeat(513 * 1024) }))
    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ code: "file_too_large" })
    expect(upstream).not.toHaveBeenCalled()
  })

  it("a missing API key gives 500 server_misconfigured", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "")
    vi.resetModules() // env is cached per module instance
    try {
      const { handleChatRequest } = await import("@/server/ai/chat/handle-chat")
      const response = await handleChatRequest(jsonRequest(base()), { now: () => NOW, callLogSink: () => {} })
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ code: "server_misconfigured" })
    } finally {
      stubEnv()
    }
  })
})
