import { beforeAll, describe, expect, it, vi } from "vitest"
import { loadFixture, replayFetch } from "../../helpers/replay-fetch"
import {
  bodyFor, errorsDir, fixturePath, jsonRequest, llmDir, NOW, PLAIN, readChunks, stubEnv, TOOL, withRepeatedToolCall, withToolInput,
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

  // G5-1 / AC-28: remedy on the update to Akceptacja. Base: chat-tool-update.json (complaint phone-1, current Odrzucenie).
  describe("remedy on update (derived from chat-tool-update)", () => {
    const accept = { decision: "Akceptacja", reason: "Serwis potwierdził wadę fabryczną.", ruleRefs: ["C-3", "C-4"] }

    it("complaint to Akceptacja with remedy: output-available carries the remedy", async () => {
      const { chunks } = await run(withToolInput(toolFixture, { ...accept, remedy: "repair" }), toolBody())
      const output = chunks.find((c) => c.type === "tool-output-available")?.output as { newDecision: string; remedy: string }
      expect(output).toMatchObject({ newDecision: "Akceptacja", remedy: "repair" })
    })

    it.each([{ remedy: null }, {}])("complaint to Akceptacja without a remedy (%j): output-error and no card", async (extra) => {
      const { chunks } = await run(withToolInput(toolFixture, { ...accept, ...extra }), toolBody())
      expect(chunks.some((c) => c.type === "tool-output-error")).toBe(true)
      expect(chunks.some((c) => c.type === "tool-output-available")).toBe(false)
    })

    it("return to Akceptacja with a remedy: the remedy is null in the output", async () => {
      const body = bodyFor(PLAIN.source, PLAIN.type, "Chcę dodać fakt: komplet jest w pudełku.")
      body.caseContext.currentDecision = { ...body.caseContext.currentDecision, decision: "Weryfikacja ręczna" }
      const variant = withToolInput(toolFixture, { decision: "Akceptacja", reason: "Nowy fakt.", ruleRefs: ["R-2"], remedy: "repair" })
      const { chunks } = await run(variant, body)
      const output = chunks.find((c) => c.type === "tool-output-available")?.output as { newDecision: string; remedy: unknown }
      expect(output.newDecision).toBe("Akceptacja")
      expect(output.remedy).toBeNull()
    })

    it("complaint to Weryfikacja ręczna with a remedy: the remedy is null in the output", async () => {
      const { chunks } = await run(withToolInput(toolFixture, { decision: "Weryfikacja ręczna", reason: "Nowy fakt.", ruleRefs: ["C-5"], remedy: "replacement" }), toolBody())
      const output = chunks.find((c) => c.type === "tool-output-available")?.output as { remedy: unknown }
      expect(output.remedy).toBeNull()
    })
  })

  it("R-2.4 (derived from chat-tool-update, return <= 14 days, Odrzucenie): output is Weryfikacja ręczna", async () => {
    const variant = withToolInput(toolFixture, { decision: "Odrzucenie", reason: "Klient nie podał nowych faktów.", ruleRefs: ["R-2"] })
    const body = bodyFor(PLAIN.source, PLAIN.type, "Chcę dodać fakt: komplet jest w pudełku.")
    expect(body.caseContext.daysSincePurchase).toBeLessThanOrEqual(14)
    const { chunks } = await run(variant, body)
    const output = chunks.find((c) => c.type === "tool-output-available")?.output as { newDecision: string; previousDecision: string }
    expect(output.newDecision).toBe("Weryfikacja ręczna")
    expect(output.previousDecision).toBe(body.caseContext.currentDecision.decision)
    expect(output.previousDecision).not.toBe(output.newDecision)
  })

  it("D1 (derived from chat-tool-update, Odrzucenie/R-4 on a 10-day return, current Weryfikacja ręczna): guarded decision equals current, tool ends in output-error, 2 chat-step lines", async () => {
    const variant = withToolInput(toolFixture, { decision: "Odrzucenie", reason: "Laptop dostałem 40 dni temu.", ruleRefs: ["R-4"] })
    const body = bodyFor(PLAIN.source, PLAIN.type, "Muszę sprostować: Laptop dostałem 40 dni temu.")
    expect(body.caseContext.daysSincePurchase).toBeLessThanOrEqual(14)
    body.caseContext.currentDecision = { ...body.caseContext.currentDecision, decision: "Weryfikacja ręczna" } // the G3 case state
    const { chunks, stepLines } = await run(variant, body)
    expect(chunks.some((c) => c.type === "tool-output-error")).toBe(true)
    expect(chunks.some((c) => c.type === "tool-output-available")).toBe(false)
    expect(stepLines.map((l) => l.stage)).toEqual(["chat-step", "chat-step"])
  })

  // T28 F3: daysSincePurchase is recomputed from form.purchaseDate and the server clock; the client value is ignored.
  describe("a forged daysSincePurchase does not change the guards or the prompt", () => {
    const forged = (days: number, body = bodyFor(PLAIN.source, PLAIN.type, "Chcę dodać fakt: komplet jest w pudełku.")) => {
      body.caseContext.daysSincePurchase = days
      return body
    }

    it("R-2.4 (derived from chat-tool-update, 10-day return, forged days 40): still Weryfikacja ręczna", async () => {
      const variant = withToolInput(toolFixture, { decision: "Odrzucenie", reason: "Brak nowych faktów.", ruleRefs: ["R-2"] })
      const { chunks } = await run(variant, forged(40))
      const output = chunks.find((c) => c.type === "tool-output-available")?.output as { newDecision: string }
      expect(output.newDecision).toBe("Weryfikacja ręczna")
    })

    it("R-4 (derived from chat-tool-update, purchase 2026-10-12 = 45 days, forged days 5): Odrzucenie R-4 still forced", async () => {
      const variant = withToolInput(toolFixture, { decision: "Akceptacja", reason: "Klient nalega.", ruleRefs: ["R-2"] })
      const body = forged(5)
      body.caseContext.form.purchaseDate = "2026-10-12"
      const { chunks } = await run(variant, body)
      const output = chunks.find((c) => c.type === "tool-output-available")?.output as { newDecision: string; ruleRefs: string[] }
      expect(output.newDecision).toBe("Odrzucenie")
      expect(output.ruleRefs).toEqual(["R-4"])
    })

    it("C-2 (derived from chat-tool-update, complaint 400 days, forged days 800): the C-2 override is not applied", async () => {
      const variant = withToolInput(toolFixture, { decision: "Weryfikacja ręczna", reason: "Nowy fakt.", ruleRefs: ["C-5"] })
      const { chunks } = await run(variant, forged(800, toolBody()))
      const output = chunks.find((c) => c.type === "tool-output-available")?.output as { newDecision: string; ruleRefs: string[] }
      expect(output.newDecision).toBe("Weryfikacja ręczna")
      expect(output.ruleRefs).toEqual(["C-5"])
    })

    it("the system prompt carries the server value, not the forged one", async () => {
      const bodies: string[] = []
      const spy = ((input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(String(init?.body))
        return replayFetch(fixturePath(llmDir, "chat-plain"))(input, init)
      }) as typeof fetch
      const response = await handleChatRequest(jsonRequest(forged(40)), {
        provider: createProvider({ fetch: spy }),
        env: getEnv({ OPENROUTER_API_KEY: "test" }),
        now: () => NOW,
        requestId: "req-1",
        callLogSink: () => {},
      })
      await readChunks(response)
      expect(bodies).toHaveLength(1)
      expect(bodies[0]).toContain("daysSincePurchase (given by the system): 10")
      expect(bodies[0]).not.toContain("daysSincePurchase (given by the system): 40")
    })
  })

  // T28 F7: at most one update_recommendation per turn, enforced in code.
  it("F7 (derived from chat-tool-update, step 2 repeats the tool call): only one tool output reaches the client", async () => {
    const variant = withRepeatedToolCall(toolFixture, { decision: "Weryfikacja ręczna", reason: "Nowy fakt.", ruleRefs: ["C-5"] })
    const { chunks } = await run(variant, toolBody())
    expect(chunks.filter((c) => c.type === "tool-output-available")).toHaveLength(1)
    expect(chunks.filter((c) => c.type === "tool-input-available").length).toBeLessThanOrEqual(2)
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
