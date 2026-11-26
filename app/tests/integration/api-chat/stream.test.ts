import { beforeAll, describe, expect, it, vi } from "vitest"
import { loadFixture, replayFetch } from "../../helpers/replay-fetch"
import {
  bodyFor, errorsDir, fixturePath, jsonRequest, llmDir, NOW, PLAIN, readChunks, stubEnv, TOOL, withToolInput,
} from "./helpers"

vi.mock("server-only", () => ({}))

describe("POST /api/chat handler: streams built from recorded OpenRouter responses", () => {
  let handleChatRequest: typeof import("@/server/ai/chat/handle-chat").handleChatRequest
  let createProvider: typeof import("@/server/ai/provider").createProvider
  let getEnv: typeof import("@/server/env").getEnv

  beforeAll(async () => {
    stubEnv()
    ;({ handleChatRequest } = await import("@/server/ai/chat/handle-chat"))
    ;({ createProvider } = await import("@/server/ai/provider"))
    ;({ getEnv } = await import("@/server/env"))
  })

  async function run(fetchSource: Parameters<typeof replayFetch>[0], body: unknown) {
    const lines: string[] = []
    const response = await handleChatRequest(jsonRequest(body), {
      provider: createProvider({ fetch: replayFetch(fetchSource) }),
      env: getEnv({ OPENROUTER_API_KEY: "test" }),
      now: () => NOW,
      requestId: "req-1",
      callLogSink: (line) => void lines.push(line),
    })
    const chunks = response.status === 200 ? await readChunks(response) : []
    const stepLines = lines.map((l) => JSON.parse(l) as { type: string; stage?: string; outcome?: string }).filter((l) => l.type === "upstream")
    return { response, chunks, lines, stepLines }
  }

  const toolBody = () => bodyFor(TOOL.source, TOOL.type, TOOL.text)
  const toolFixture = fixturePath(llmDir, "chat-tool-update")

  it("chat-plain: text deltas, no reasoning chunks, one chat-step line", async () => {
    const { response, chunks, stepLines } = await run(fixturePath(llmDir, "chat-plain"), bodyFor(PLAIN.source, PLAIN.type, PLAIN.text))
    expect(response.status).toBe(200)
    expect(chunks.filter((c) => c.type === "text-delta").map((c) => String(c.delta)).join("")).toContain("Lenovo ThinkPad E14")
    expect(chunks.some((c) => c.type.startsWith("reasoning"))).toBe(false)
    expect(chunks.some((c) => c.type.startsWith("tool-"))).toBe(false)
    expect(stepLines).toHaveLength(1)
    expect(stepLines[0]).toMatchObject({ stage: "chat-step", outcome: "ok" })
  })

  it("chat-tool-update: tool output with previous/new decision, then text, two chat-step lines", async () => {
    const { chunks, stepLines } = await run(toolFixture, toolBody())
    const outputIdx = chunks.findIndex((c) => c.type === "tool-output-available")
    expect(outputIdx).toBeGreaterThan(-1)
    expect(chunks[outputIdx]!.output).toMatchObject({
      previousDecision: "Odrzucenie",
      newDecision: "Weryfikacja ręczna",
      updatedAt: NOW.toISOString(),
    })
    expect(chunks.slice(outputIdx).some((c) => c.type === "text-delta")).toBe(true)
    expect(chunks.some((c) => c.type.startsWith("reasoning"))).toBe(false)
    expect(stepLines.map((l) => l.stage)).toEqual(["chat-step", "chat-step"])
  })

  it("guard (derived from chat-tool-update, ruleRefs [R-99]): tool part ends in output-error", async () => {
    const variant = withToolInput(toolFixture, { decision: "Weryfikacja ręczna", reason: "Nowy fakt.", ruleRefs: ["R-99"] })
    const { chunks } = await run(variant, toolBody())
    expect(chunks.some((c) => c.type === "tool-output-error")).toBe(true)
    expect(chunks.some((c) => c.type === "tool-output-available")).toBe(false)
  })

  it("R-2.4 (derived from chat-tool-update, return <= 14 days, Odrzucenie): output is Weryfikacja ręczna", async () => {
    const variant = withToolInput(toolFixture, { decision: "Odrzucenie", reason: "Klient nie podał nowych faktów.", ruleRefs: ["R-2"] })
    const body = bodyFor(PLAIN.source, PLAIN.type, "Chcę dodać fakt: komplet jest w pudełku.")
    expect(body.caseContext.daysSincePurchase).toBeLessThanOrEqual(14)
    const { chunks } = await run(variant, body)
    const output = chunks.find((c) => c.type === "tool-output-available")?.output as { newDecision: string; previousDecision: string }
    expect(output.newDecision).toBe("Weryfikacja ręczna")
    expect(output.previousDecision).toBe(body.caseContext.currentDecision.decision)
  })

  it("chat-401: error chunk carries only chat_failed, no provider text", async () => {
    const { response, chunks, stepLines } = await run(loadFixture(fixturePath(errorsDir, "chat-401")), toolBody())
    expect(response.status).toBe(200)
    const error = chunks.find((c) => c.type === "error")
    expect(error?.errorText).toBe("chat_failed")
    const raw = JSON.stringify(chunks)
    expect(raw).not.toContain("User not found")
    expect(stepLines).toHaveLength(1)
    expect(stepLines[0]).toMatchObject({ stage: "chat-step", outcome: "error", status: 401 })
  })
})
