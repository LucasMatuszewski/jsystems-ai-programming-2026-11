import fs from "node:fs"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { evaluateFastPath } from "@/server/ai/logic/fast-path"
import { normalizeDecisionAnswers } from "@/server/ai/signals/normalize"
import { caseFrom, fixturesDir, IMAGE, produced, recordedOutput, setup, withDays } from "./helpers"

vi.mock("server-only", () => ({}))

// ADR-001 3.2 with a REAL successful signals recording (2026-11-26) replayed first,
// then the matching escalated recording. The gate escalates because the photo signals
// do not meet the fast-path profile; escalationReasons are the gate's own reasons.

describe("runCasePipeline: signals ok + escalated model", () => {
  let runCasePipeline: typeof import("@/server/ai/pipeline/run-case-pipeline").runCasePipeline
  let getEnv: typeof import("@/server/env").getEnv

  beforeAll(async () => {
    ;({ runCasePipeline } = await import("@/server/ai/pipeline/run-case-pipeline"))
    ;({ getEnv } = await import("@/server/env"))
  })
  afterAll(() => undefined)

  it("return-laptop-2 signals + escalated-return-laptop-2: route escalated, reasons from the gate", async () => {
    const signalsFile = path.join(fixturesDir, "decisions", "return-laptop-2.json")
    const base = "escalated-return-laptop-2"
    const ctx = setup([signalsFile, withDays(base)])
    const env = getEnv({ OPENROUTER_API_KEY: "test", DECISION_LOG_PATH: "" })
    expect(env.fastPathEnabled).toBe(true)

    const result = await runCasePipeline(caseFrom(base), IMAGE, new AbortController().signal, { ...ctx.deps, env })
    produced.push(result)

    const rec = JSON.parse(fs.readFileSync(signalsFile, "utf8")) as {
      sdkResult: { answers: never; providerMetadata: { openrouter: { answers: never } } }
    }
    const answers = normalizeDecisionAnswers(rec.sdkResult.answers, rec.sdkResult.providerMetadata.openrouter.answers)
    const gate = evaluateFastPath({
      caseType: "return",
      category: "laptop",
      days: 10,
      hasReason: false,
      signals: { status: "ok", answers, refusals: [], cost: 0, durationMs: 0 },
      enabled: true,
      threshold: env.fastPathThreshold,
    })
    expect(gate.eligible).toBe(false)

    const out = recordedOutput(base)
    expect(result.route).toBe("escalated")
    expect(result.decision).toBe(out.decision)
    expect(result.escalationReasons).toEqual(gate.eligible ? [] : gate.reasons)
    expect(result.escalationReasons).not.toContain("signals_unavailable")
    expect(result.escalationReasons).not.toContain("fast_path_disabled")
    expect(Object.keys(result.signalsSummary).length).toBeGreaterThan(0)
    expect(ctx.calls().map((c) => [c.stage, c.outcome])).toEqual([
      ["signals", "ok"],
      ["escalated", "ok"],
    ])
  })
})
