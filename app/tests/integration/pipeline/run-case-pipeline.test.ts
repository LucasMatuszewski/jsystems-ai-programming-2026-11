import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import type { CaseDecision } from "@/lib/schemas"
import {
  caseFrom, deriveVariant, errorFixture, IMAGE, llmFixture, produced, recordedOutput, setup, SIGNALS_UNAVAILABLE,
} from "./helpers"

vi.mock("server-only", () => ({}))

// ADR-001 3.2 / 3.5 / 3.7, A1 and ADR-006 3.2 call budget. Endpoint doubles replay real recordings.

const RETURN_BASE = "escalated-return-laptop-2"
const COMPLAINT_BASE = "escalated-complaint-phone-1"

describe("runCasePipeline on recorded responses", () => {
  let runCasePipeline: typeof import("@/server/ai/pipeline/run-case-pipeline").runCasePipeline
  let PipelineError: typeof import("@/server/ai/pipeline/run-case-pipeline").PipelineError
  let getEnv: typeof import("@/server/env").getEnv
  const env = () => getEnv({ OPENROUTER_API_KEY: "test", DECISION_LOG_PATH: "" })
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
    const { result, calls, decisionLog, stages } = await run(base, [SIGNALS_UNAVAILABLE, llmFixture(base)])
    const out = recordedOutput(base)
    expect(result.route).toBe("escalated")
    expect(result.decision).toBe(out.decision)
    expect(result.ruleRefs.length).toBeGreaterThanOrEqual(1)
    expect(result.ruleRefs.every((r) => /^[RC]-\d+(\.\d+)?$/.test(r))).toBe(true)
    expect(result.escalationReasons).toEqual(["fast_path_disabled", "signals_unavailable"])
    expect(result.signalsSummary).toEqual({})
    expect(result.imageFindings).toEqual(out.imageFindings)
    expect(result.firstMessage).toEqual({ greeting: out.greeting, bodyMarkdown: out.bodyMarkdown })
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
    const { result, calls, decisionLog } = await run(name, [SIGNALS_UNAVAILABLE, llmFixture(name)])
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
    const variant = deriveVariant(llmFixture(RETURN_BASE), (o) => { o.decision = "Odrzucenie" })
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
