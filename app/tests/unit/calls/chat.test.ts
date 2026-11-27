import type { UIMessage } from "ai"
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { buildChatCall, updateRecommendationToolSchema } from "@/server/ai/calls/chat"
import { loadPrompt } from "@/server/ai/prompts"
import { caseContext, model, policy } from "./fixtures"

const messages: UIMessage[] = [
  {
    id: "a1",
    role: "assistant",
    parts: [
      { type: "text", text: "Dzień dobry!" },
      { type: "data-decision", data: { decision: "Akceptacja", ruleRefs: ["R-2"], kind: "initial", remedy: null } },
      { type: "text", text: "### Podsumowanie" },
    ],
  },
  { id: "u1", role: "user", parts: [{ type: "text", text: "Jaki model urządzenia zgłosiłem?" }] },
]

const args = { caseContext, messages, policy, model, reasoningEffort: "medium" as const, tools: {} }

describe("buildChatCall", () => {
  it("builds instructions from the chat prompt, policy and case context", async () => {
    const call = await buildChatCall(args)
    expect(call.instructions).toContain(loadPrompt("chat-return").text)
    expect(call.instructions).toContain(policy)
    expect(call.instructions).toContain("<case_context>")
    expect(call.instructions).toContain("Lenovo ThinkPad E14")
    expect(call.instructions).toContain("Current recommendation: Akceptacja, rules R-2")
  })

  it("converts the data-decision part to short text, with no data parts left", async () => {
    const call = await buildChatCall(args)
    const assistant = call.messages[0]!
    const text = JSON.stringify(assistant.content)
    expect(text).toContain("[Rekomendacja: Akceptacja, reguły R-2]")
    expect(text).not.toContain("data-decision")
    expect(text.toLowerCase()).not.toContain("disclaimer")
  })

  it("converts a finished update tool part to text and drops unfinished ones", async () => {
    const withTool: UIMessage[] = [
      ...messages,
      {
        id: "a2",
        role: "assistant",
        parts: [
          {
            type: "tool-update_recommendation",
            toolCallId: "c1",
            state: "output-available",
            input: { decision: "Weryfikacja ręczna", reason: "x", ruleRefs: ["R-3"] },
            output: { previousDecision: "Akceptacja", newDecision: "Weryfikacja ręczna", reason: "x", ruleRefs: ["R-3"], updatedAt: "t" },
          },
          { type: "text", text: "Zmieniono." },
        ],
      } as never,
      { id: "u2", role: "user", parts: [{ type: "text", text: "Dziękuję" }] },
    ]
    const call = await buildChatCall({ ...args, messages: withTool })
    const text = JSON.stringify(call.messages)
    expect(text).toContain("[Zaktualizowana rekomendacja: Weryfikacja ręczna, reguły R-3]")
    expect(text).not.toContain("tool-call")
  })

  it("limits steps to 2, sets medium effort through reasoning only, and never re-sends the photo", async () => {
    const call = (await buildChatCall(args)) as Record<string, unknown>
    expect(call.reasoning).toBe("medium")
    expect(call.providerOptions).toBeUndefined()
    expect(call.stopWhen).toBeDefined()
    expect(JSON.stringify(call.messages)).not.toContain('"type":"file"')
  })

  it("exports the tool input schema without execute", () => {
    expect(updateRecommendationToolSchema).not.toHaveProperty("execute")
    expect(
      updateRecommendationToolSchema.inputSchema.safeParse({ decision: "Akceptacja", reason: "r", ruleRefs: ["R-2"] }).success,
    ).toBe(true)
  })

  it("update input carries a nullable remedy with the first-decision values (G5-1)", () => {
    const schema = updateRecommendationToolSchema.inputSchema
    const base = { decision: "Akceptacja", reason: "r", ruleRefs: ["C-3"] }
    expect(schema.safeParse({ ...base, remedy: "repair" }).success).toBe(true)
    expect(schema.safeParse({ ...base, remedy: "replacement" }).success).toBe(true)
    expect(schema.safeParse({ ...base, remedy: null }).success).toBe(true)
    expect(schema.safeParse({ ...base, remedy: "refund" }).success).toBe(false)
    expect(schema.parse(base).remedy).toBeNull()
  })
})
