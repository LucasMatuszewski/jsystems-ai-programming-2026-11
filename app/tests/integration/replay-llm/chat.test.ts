import path from "node:path"
import { streamText, tool, toUIMessageStream, type UIMessage } from "ai"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { loadFixture, replayFetch } from "../../helpers/replay-fetch"
import { chatContext, errorsDir, llmDir, policyText, readRecording, stubEnv } from "./helpers"

vi.mock("server-only", () => ({}))

describe("replay: streamText chat with recorded gpt-6-luna streams", () => {
  let createProvider: typeof import("@/server/ai/provider").createProvider
  let chat: typeof import("@/server/ai/calls/chat")

  beforeAll(async () => {
    stubEnv()
    ;({ createProvider } = await import("@/server/ai/provider"))
    chat = await import("@/server/ai/calls/chat")
  })

  const modelFor = (file: string) =>
    createProvider({ fetch: replayFetch(loadFixture(file)) }).chat("openai/gpt-6-luna")

  const history = (source: string, user: string): UIMessage[] => {
    const out = readRecording(source).sdkResult.output!
    const ctx = chatContext(source, source.includes("return") ? "return" : "complaint")
    return [
      {
        id: "first", role: "assistant",
        parts: [
          { type: "text", text: String(out.greeting) },
          { type: "data-decision", data: { decision: ctx.currentDecision.decision, ruleRefs: ctx.currentDecision.ruleRefs, kind: "initial", remedy: null } },
          { type: "text", text: String(out.bodyMarkdown) },
        ],
      },
      { id: "u1", role: "user", parts: [{ type: "text", text: user }] },
    ]
  }

  async function drain(stream: ReadableStream<{ type: string; [k: string]: unknown }>) {
    const chunks: { type: string; [k: string]: unknown }[] = []
    const reader = stream.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    return chunks
  }

  it("chat-plain yields the recorded text and no tool calls", async () => {
    const source = "escalated-return-laptop-2"
    const neverCalled = vi.fn(async (input: { decision: string }) => ({ echoed: input.decision }))
    const call = await chat.buildChatCall({
      caseContext: chatContext(source, "return"), messages: history(source, "Jaki model urządzenia zgłosiłem?"),
      policy: policyText("return"), model: modelFor(path.join(llmDir, "chat-plain.json")), reasoningEffort: "medium",
      tools: { update_recommendation: tool({ ...chat.updateRecommendationToolSchema, execute: neverCalled }) },
    })
    const result = streamText(call)
    const chunks = await drain(toUIMessageStream({ stream: result.stream, tools: call.tools, sendReasoning: false }) as never)
    const text = chunks.filter((c) => c.type === "text-delta").map((c) => String(c.delta)).join("")
    expect(text).toContain("Lenovo ThinkPad E14")
    expect(chunks.some((c) => c.type === "tool-input-available")).toBe(false)
    expect(neverCalled).not.toHaveBeenCalled()
    expect(chunks.some((c) => c.type.startsWith("reasoning"))).toBe(false) // production sets sendReasoning: false (the SDK default is true)
  })

  it("chat-tool-update executes the tool over two steps and explains the change", async () => {
    const source = "escalated-complaint-phone-1"
    const ctx = chatContext(source, "complaint")
    const call = await chat.buildChatCall({
      caseContext: ctx, messages: history(source, "Chcę dodać ważny fakt: telefon był w etui."),
      policy: policyText("complaint"), model: modelFor(path.join(llmDir, "chat-tool-update.json")), reasoningEffort: "medium",
      tools: {
        update_recommendation: tool({
          ...chat.updateRecommendationToolSchema,
          execute: async (input) => ({ previousDecision: ctx.currentDecision.decision, newDecision: input.decision, reason: input.reason, ruleRefs: input.ruleRefs, updatedAt: "2026-11-26T12:00:00.000Z" }),
        }),
      },
    })
    const result = streamText(call)
    const chunks = await drain(toUIMessageStream({ stream: result.stream, tools: call.tools, sendReasoning: false }) as never)
    const output = chunks.find((c) => c.type === "tool-output-available")?.output as { previousDecision: string; newDecision: string } | undefined
    expect(output?.previousDecision).toBe(ctx.currentDecision.decision)
    expect(output?.newDecision).toBe("Weryfikacja ręczna")
    expect(chunks.filter((c) => c.type === "finish-step")).toHaveLength(2)
    expect(chunks.filter((c) => c.type === "text-delta").length).toBeGreaterThan(0)
    expect(chunks.some((c) => c.type.startsWith("reasoning"))).toBe(false)
  })

  it("chat-401 surfaces the recorded upstream error", async () => {
    const source = "escalated-return-laptop-2"
    const call = await chat.buildChatCall({
      caseContext: chatContext(source, "return"), messages: history(source, "Cześć"),
      policy: policyText("return"), model: modelFor(path.join(errorsDir, "chat-401.json")), reasoningEffort: "medium", tools: {},
    })
    const errors: unknown[] = []
    const result = streamText({ ...call, onError: ({ error }) => void errors.push(error) })
    await drain(toUIMessageStream({ stream: result.stream, tools: call.tools, onError: () => "err" }) as never)
    expect(String((errors[0] as Error)?.message)).toContain("User not found")
  })
})
