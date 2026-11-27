import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import type { CaseDecision } from "@/lib/schemas"
import {
  caseFrom, deriveVariant, errorFixture, IMAGE, llmFixture, produced, recordedOutput, setup, SIGNALS_UNAVAILABLE, withDays,
} from "./helpers"
import { justificationWithDays } from "../../helpers/day-count-variant"

vi.mock("server-only", () => ({}))

// ADR-001 3.2 / 3.5 / 3.7, A1 and ADR-006 3.2 call budget. Endpoint doubles replay real recordings.

const RETURN_BASE = "escalated-return-laptop-2"
const COMPLAINT_BASE = "escalated-complaint-phone-1"

describe("runCasePipeline on recorded responses", () => {
  let runCasePipeline: typeof import("@/server/ai/pipeline/run-case-pipeline").runCasePipeline
  let PipelineError: typeof import("@/server/ai/pipeline/run-case-pipeline").PipelineError
  let getEnv: typeof import("@/server/env").getEnv
  const env = () => getEnv({ OPENROUTER_API_KEY: "test", DECISION_LOG_PATH: "", FAST_PATH_ENABLED: "false" })
  const signal = () => new AbortController().signal

  beforeAll(async () => {
    ;({ runCasePipeline, PipelineError } = await import("@/server/ai/pipeline/run-case-pipeline"))
    ;({ getEnv } = await import("@/server/env"))
  })

  async function run(caseName: string, sources: Parameters<typeof setup>[0], dir: "llm" | "errors" = "llm") {
    const ctx = setup(sources)
    const result = await runCasePipeline(caseFrom(caseName, dir), IMAGE, signal(), { ...ctx.deps, env: env() })
    produced.push(result)
    return { ...ctx, result }
  }

  function expectNoCustomerText(entries: unknown[], texts: string[]) {
    const serialized = JSON.stringify(entries)
    for (const text of texts.filter((t) => t.length > 0)) expect(serialized).not.toContain(text)
  }

  it.each([
    [RETURN_BASE, "return"],
    [COMPLAINT_BASE, "complaint"],
  ] as const)("escalated %s: decision from the recording, 2 call-log lines, 1 decision-log line", async (base, caseType) => {
    const { result, calls, decisionLog, stages } = await run(base, [SIGNALS_UNAVAILABLE, withDays(base)])
    const out = recordedOutput(base)
    expect(result.route).toBe("escalated")
    expect(result.decision).toBe(out.decision)
    expect(result.ruleRefs.length).toBeGreaterThanOrEqual(1)
    expect(result.ruleRefs.every((r) => /^[RC]-\d+(\.\d+)?$/.test(r))).toBe(true)
    expect(result.escalationReasons).toEqual(["fast_path_disabled", "signals_unavailable"])
    expect(result.signalsSummary).toEqual({})
    expect(result.imageFindings).toEqual(out.imageFindings)
    expect(result.firstMessage).toEqual({ greeting: out.greeting, bodyMarkdown: justificationWithDays(String(out.bodyMarkdown), caseType === "return" ? 10 : 400) })
    expect(result.daysSincePurchase).toBe(caseType === "return" ? 10 : 400)
    expect(stages).toEqual(["decision"])
    expect(calls().map((c) => [c.stage, c.outcome])).toEqual([["signals", "error"], ["escalated", "ok"]])
    expect(decisionLog).toHaveLength(1)
    const c = caseFrom(base)
    expectNoCustomerText(decisionLog, [c.reason, c.model, String(out.greeting), String(out.bodyMarkdown)])
    expect(decisionLog[0]).toMatchObject({ route: "escalated", caseType, decision: result.decision })
  })

  it.each([
    ["writer-rule-return-r4", "R-4"],
    ["writer-rule-complaint-c2", "C-2"],
  ] as const)("rule route %s: Odrzucenie %s, escalated model never called", async (name, rule) => {
    const { result, calls, decisionLog } = await run(name, [SIGNALS_UNAVAILABLE, name === "writer-rule-complaint-c2" ? withDays(name) : llmFixture(name)])
    expect(result.route).toBe("rule")
    expect(result.decision).toBe("Odrzucenie")
    expect(result.ruleRefs).toEqual([rule])
    expect(result.remedy).toBeNull()
    expect(result.imageFindings.photoQuality).toBe("limited")
    expect(result.imageFindings.evidence).toEqual(["Zdjęcie nie zostało ocenione automatycznie."])
    expect(result.escalationReasons).toEqual([])
    expect(calls().map((c) => c.stage)).toEqual(["signals", "writer"])
    expect(decisionLog).toHaveLength(1)
  })

  it("R-2.4 guard: variant of escalated-return-laptop-2 with decision Odrzucenie becomes Weryfikacja ręczna", async () => {
    const variant = deriveVariant(withDays(RETURN_BASE), (o) => { o.decision = "Odrzucenie" })
    const { result, decisionLog } = await run(RETURN_BASE, [SIGNALS_UNAVAILABLE, variant])
    expect(result.decision).toBe("Weryfikacja ręczna")
    expect(result.guardsApplied).toContain("R-2.4")
    expect(decisionLog[0]).toMatchObject({ guardsApplied: ["R-2.4"] })
  })

  it("invalid rule refs twice: retries once, then PipelineError invalid_model_output (3 call-log lines)", async () => {
    const variant = deriveVariant(llmFixture(RETURN_BASE), (o) => { o.ruleRefs = ["R-9"] })
    const ctx = setup([SIGNALS_UNAVAILABLE, variant, variant])
    const error = await runCasePipeline(caseFrom(RETURN_BASE), IMAGE, signal(), { ...ctx.deps, env: env() }).catch((e) => e)
    expect(error).toBeInstanceOf(PipelineError)
    expect(error.code).toBe("invalid_model_output")
    expect(ctx.calls().map((c) => [c.stage, c.outcome])).toEqual([["signals", "error"], ["escalated", "ok"], ["escalated", "ok"]])
    expect(ctx.decisionLog).toHaveLength(1)
    expect(ctx.decisionLog[0]).toMatchObject({ outcome: "error", errorCode: "invalid_model_output", route: "escalated", decision: null, escalationReasons: ["fast_path_disabled", "signals_unavailable"] })
    const c = caseFrom(RETURN_BASE)
    expect(JSON.stringify(ctx.decisionLog)).not.toContain(c.model)
  })

  it("invalid rule refs once: the retry succeeds with the recorded output", async () => {
    const bad = deriveVariant(llmFixture(RETURN_BASE), (o) => { o.ruleRefs = ["R-9"] })
    const { result, calls } = await run(RETURN_BASE, [SIGNALS_UNAVAILABLE, bad, llmFixture(RETURN_BASE)])
    expect(result.decision).toBe(recordedOutput(RETURN_BASE).decision)
    expect(calls().map((c) => c.stage)).toEqual(["signals", "escalated", "escalated"])
  })

  it("schema-invalid structured output counts as a violation (retry, then invalid_model_output)", async () => {
    const bad = deriveVariant(llmFixture(RETURN_BASE), (o) => { delete o.bodyMarkdown })
    const ctx = setup([SIGNALS_UNAVAILABLE, bad, bad])
    const error = await runCasePipeline(caseFrom(RETURN_BASE), IMAGE, signal(), { ...ctx.deps, env: env() }).catch((e) => e)
    expect(error).toBeInstanceOf(PipelineError)
    expect(error.code).toBe("invalid_model_output")
    expect(ctx.calls()).toHaveLength(3)
  })

  // AC-23 (T28 F4): the justification states the system day count and cites only policy rules.
  describe("body checks (AC-23)", () => {
    const WRITER_BASE = "writer-rule-return-r4" // 45 days, R-4
    const withBody = (base: string, edit: (body: string) => string) =>
      deriveVariant(llmFixture(base), (o) => { o.bodyMarkdown = edit(String(o.bodyMarkdown)) })
    const stripDays = (body: string) => body.replace(/\b\d+ dni\b/g, "wiele dni").replace(/upłynęło (wiele dni)/g, "upłynął długi czas").replace(/Dni od zakupu: \d+/, "Czas od zakupu: długi")

    it("a wrong day count (35 instead of 10) retries once; the retry with the recorded text is accepted", async () => {
      const wrong = deriveVariant(withDays(RETURN_BASE), (o) => { o.bodyMarkdown = String(o.bodyMarkdown).replace("minęło 10 dni", "minęło 35 dni") })
      const { result, calls } = await run(RETURN_BASE, [SIGNALS_UNAVAILABLE, wrong, withDays(RETURN_BASE)])
      expect(result.firstMessage.bodyMarkdown).toBe(justificationWithDays(String(recordedOutput(RETURN_BASE).bodyMarkdown), 10))
      expect(result.guardsApplied).not.toContain("day_count_inserted")
      expect(calls().map((c) => c.stage)).toEqual(["signals", "escalated", "escalated"])
    })

    it("a day count that stays missing after the retry is inserted by the server into the justification (escalated)", async () => {
      const missing = llmFixture(RETURN_BASE) // as recorded: the days are in Podsumowanie only (G4: not in Uzasadnienie)
      const { result, calls, decisionLog } = await run(RETURN_BASE, [SIGNALS_UNAVAILABLE, missing, missing])
      const body = result.firstMessage.bodyMarkdown
      expect(body).toContain("### Uzasadnienie\n\nOd zakupu minęło 10 dni.\n\n- Rekomendujemy")
      expect(result.guardsApplied).toContain("day_count_inserted")
      expect(decisionLog[0]).toMatchObject({ guardsApplied: expect.arrayContaining(["day_count_inserted"]) })
      expect(calls().map((c) => c.stage)).toEqual(["signals", "escalated", "escalated"]) // retry budget unchanged
    })

    it("a missing day count on the rule route (derived from writer-rule-return-r4) is inserted after the single retry", async () => {
      const missing = withBody(WRITER_BASE, stripDays)
      const { result, calls } = await run(WRITER_BASE, [SIGNALS_UNAVAILABLE, missing, missing])
      expect(result.route).toBe("rule")
      expect(result.firstMessage.bodyMarkdown).toContain("Od zakupu minęło 45 dni.")
      expect(result.ruleRefs).toEqual(["R-4"])
      expect(result.guardsApplied).toEqual(["day_count_inserted"])
      expect(calls().map((c) => c.stage)).toEqual(["signals", "writer", "writer"])
    })

    it("a rule ID outside the policy in the text (R-99) retries; twice gives invalid_model_output", async () => {
      const bad = deriveVariant(withDays(RETURN_BASE), (o) => { o.bodyMarkdown = `${String(o.bodyMarkdown)}\nZgodnie z R-99.` })
      const ctx = setup([SIGNALS_UNAVAILABLE, bad, bad])
      const error = await runCasePipeline(caseFrom(RETURN_BASE), IMAGE, signal(), { ...ctx.deps, env: env() }).catch((e) => e)
      expect(error).toBeInstanceOf(PipelineError)
      expect(error.code).toBe("invalid_model_output")
      expect(ctx.calls().map((c) => c.stage)).toEqual(["signals", "escalated", "escalated"])
    })

    it("a rule ID outside the policy once: the retry with the recorded text is accepted", async () => {
      const bad = withBody(WRITER_BASE, (b) => `${b}\nZgodnie z C-9.`)
      const { result, calls } = await run(WRITER_BASE, [SIGNALS_UNAVAILABLE, bad, llmFixture(WRITER_BASE)])
      expect(result.firstMessage.bodyMarkdown).toBe(recordedOutput(WRITER_BASE).bodyMarkdown)
      expect(calls().map((c) => c.stage)).toEqual(["signals", "writer", "writer"])
    })
  })

  it("F8: the pipeline abort signal reaches the signals call (aborted while signals run)", async () => {
    const controller = new AbortController()
    let sawSignal: AbortSignal | undefined
    const ctx = setup([SIGNALS_UNAVAILABLE, llmFixture(RETURN_BASE)])
    const hang = ((_input: RequestInfo | URL, init?: RequestInit) => {
      sawSignal = init?.signal ?? undefined
      return new Promise<Response>((_res, rej) => init?.signal?.addEventListener("abort", () => rej(init.signal!.reason), { once: true }))
    }) as typeof fetch
    const { createOpenRouter } = await import("@openrouter/ai-sdk-provider")
    const run1 = runCasePipeline(caseFrom(RETURN_BASE), IMAGE, controller.signal, { ...ctx.deps, provider: createOpenRouter({ apiKey: "test", fetch: hang }), env: env() }).catch((e) => e)
    await new Promise((r) => setTimeout(r, 50))
    controller.abort()
    const error = await run1
    expect(error).toBeInstanceOf(PipelineError)
    expect(error.code).toBe("timeout")
    expect(sawSignal?.aborted).toBe(true) // the request that was in flight was cancelled by the pipeline signal
  }, 8000)

  it("LLM failure (recorded HTTP 401): PipelineError model_unavailable without provider text", async () => {
    const ctx = setup([SIGNALS_UNAVAILABLE, errorFixture("chat-401")])
    const error = await runCasePipeline(caseFrom(RETURN_BASE), IMAGE, signal(), { ...ctx.deps, env: env() }).catch((e) => e)
    expect(error).toBeInstanceOf(PipelineError)
    expect(error.code).toBe("model_unavailable")
    expect(error.message).not.toMatch(/User not found|401|deactivated/i)
    expect(ctx.decisionLog).toHaveLength(1)
    expect(ctx.decisionLog[0]).toMatchObject({ outcome: "error", errorCode: "model_unavailable", route: "escalated" })
    expect(ctx.calls().map((c) => [c.stage, c.outcome, c.status])).toEqual([["signals", "error", 401], ["escalated", "error", 401]])
  })

  it("an already-aborted signal: PipelineError timeout", async () => {
    const ctx = setup([SIGNALS_UNAVAILABLE, llmFixture(RETURN_BASE)])
    const controller = new AbortController()
    controller.abort()
    const error = await runCasePipeline(caseFrom(RETURN_BASE), IMAGE, controller.signal, { ...ctx.deps, env: env() }).catch((e) => e)
    expect(error).toBeInstanceOf(PipelineError)
    expect(error.code).toBe("timeout")
    expect(ctx.decisionLog).toHaveLength(0) // aborted before any work: nothing logged
  })

  afterAll(() => {
    // TAC-001-03: no code path returns anything but Akceptacja with route fast.
    expect(produced.length).toBeGreaterThan(0)
    for (const r of produced as CaseDecision[]) {
      if (r.route === "fast") expect(r.decision).toBe("Akceptacja")
    }
  })
})
