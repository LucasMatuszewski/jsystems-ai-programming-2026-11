import { describe, expect, it, vi } from "vitest"
import { handleCasesRequest } from "@/server/cases/handle-cases"
import { CaseSessionPayloadSchema, CasesStreamEventSchema } from "@/lib/schemas"
import { PipelineError } from "@/server/ai/pipeline/run-case-pipeline"
import {
  buildRequest, COMPLAINT_FORM, EXAMPLES, fixture, harness, imageFile, NOW, readNdjson, RETURN_FORM, SIGNALS_UNAVAILABLE,
} from "./helpers"
import { withJustificationDays } from "../../helpers/day-count-variant"
import { loadFixture } from "../../helpers/replay-fetch"

vi.mock("server-only", () => ({}))

// ADR-002 4 (NDJSON events), 5 (contract), 6 (result payload), AC-21 (first message), AC-43 (no leakage),
// TAC-002-03 (exactly one terminal event). Pipeline runs for real on recorded OpenRouter replays.

const RETURN_ESCALATED = fixture("llm", "escalated-return-laptop-2")
const RETURN_RULE_45 = fixture("llm", "writer-rule-return-r4")
const CHAT_401 = fixture("errors", "chat-401")
const laptop = () => imageFile(`${EXAMPLES}/laptop-2.webp`, "image/webp")
const phone = () => imageFile(`${EXAMPLES}/phone-1.jpg`, "image/jpeg")

const terminal = (events: Array<Record<string, unknown>>) =>
  events.filter((e) => e.type === "result" || e.type === "error")

describe("POST /api/cases stream: success", () => {
  it("streams analysis, decision, then one result that validates against CaseSessionPayloadSchema", async () => {
    const h = harness([SIGNALS_UNAVAILABLE, withJustificationDays(RETURN_ESCALATED)])
    const res = await handleCasesRequest(buildRequest(RETURN_FORM, { image: laptop() }), h.deps)

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("application/x-ndjson")
    const events = await readNdjson(res)
    expect(events.map((e) => (e.type === "stage" ? `stage:${String(e.stage)}` : String(e.type)))).toEqual([
      "stage:analysis", "stage:decision", "result",
    ])
    events.forEach((e) => CasesStreamEventSchema.parse(e))

    const payload = CaseSessionPayloadSchema.parse(events[2]!.case)
    expect(payload.caseId).toMatch(/^[0-9a-f-]{36}$/)
    expect(payload.createdAt).toBe(NOW.toISOString())
    expect(payload.form).toEqual({
      caseType: "return", category: "laptop", model: "Lenovo ThinkPad E14", purchaseDate: "2026-11-16", reason: "", consent: true,
    })
    expect(payload.form).not.toHaveProperty("image")
    expect(payload.thumbnailDataUrl).toMatch(/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/)
    expect(payload.daysSincePurchase).toBe(10)
    expect(payload.decision).toHaveProperty("photoAdvice")
    expect(payload.decision).not.toHaveProperty("escalationReasons")
    expect(payload.decision).not.toHaveProperty("guardsApplied")
    expect(payload.decision).not.toHaveProperty("firstMessage")

    const recorded = loadFixture(RETURN_ESCALATED).sdkResult as { output: { decision: string } }
    expect(payload.decision.decision).toBe(recorded.output.decision)

    const { firstMessage } = payload
    expect(firstMessage.id).toBe(`initial-${payload.caseId}`)
    expect(firstMessage.role).toBe("assistant")
    expect(firstMessage.parts.map((p) => p.type)).toEqual(["text", "data-decision", "text"])
    expect(firstMessage.parts[1]).toEqual({
      type: "data-decision",
      data: { decision: payload.decision.decision, ruleRefs: payload.decision.ruleRefs, kind: "initial", remedy: payload.decision.remedy },
    })
  })

  it("logs one 200 incoming line and exactly two upstream calls (signals, escalated)", async () => {
    const h = harness([SIGNALS_UNAVAILABLE, withJustificationDays(RETURN_ESCALATED)])
    const res = await handleCasesRequest(buildRequest(RETURN_FORM, { image: laptop() }), h.deps)
    await res.text()
    expect(h.incomingLines()).toEqual([expect.objectContaining({ status: 200 })])
    expect(h.upstreamLines().map((l) => l.stage)).toEqual(["signals", "escalated"])
  })

  it("a 45-day return is decided by the date rule through the writer (rule route, R-4)", async () => {
    const h = harness([SIGNALS_UNAVAILABLE, RETURN_RULE_45])
    const res = await handleCasesRequest(
      buildRequest({ ...RETURN_FORM, purchaseDate: "2026-10-12", reason: "Laptop przestał się ładować po miesiącu." }, { image: laptop() }),
      h.deps,
    )
    const events = await readNdjson(res)
    expect(events.map((e) => e.type)).toEqual(["stage", "stage", "result"])
    const payload = CaseSessionPayloadSchema.parse(events[2]!.case)
    expect(payload.decision.route).toBe("rule")
    expect(payload.decision.decision).toBe("Odrzucenie")
    expect(payload.decision.ruleRefs).toEqual(["R-4"])
    expect(payload.daysSincePurchase).toBe(45)
  })
})

describe("POST /api/cases stream: errors", () => {
  it("LLM 401 becomes one model_unavailable error event with no provider text", async () => {
    const h = harness([SIGNALS_UNAVAILABLE, CHAT_401])
    const res = await handleCasesRequest(buildRequest(COMPLAINT_FORM, { image: phone() }), h.deps)
    expect(res.status).toBe(200)
    const raw = await res.text()
    const events = raw.split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>)
    expect(events.map((e) => e.type)).toEqual(["stage", "stage", "error"])
    expect(events[2]).toEqual({ type: "error", code: "model_unavailable" })
    expect(terminal(events)).toHaveLength(1)
    for (const leak of ["User not found", "401", "openrouter", "OpenRouter", "stack", "Error"]) {
      expect(raw).not.toContain(leak)
    }
  })

  it("an already-aborted request yields a timeout event and no upstream call", async () => {
    const controller = new AbortController()
    controller.abort()
    const h = harness([])
    const res = await handleCasesRequest(
      buildRequest(RETURN_FORM, { image: laptop(), signal: controller.signal }),
      h.deps,
    )
    const events = await readNdjson(res)
    expect(events).toEqual([{ type: "stage", stage: "analysis" }, { type: "error", code: "timeout" }])
    expect(h.fetchCalls()).toBe(0)
  })

  it.each([
    [new PipelineError("timeout"), "timeout"],
    [new PipelineError("model_unavailable"), "model_unavailable"],
    [new PipelineError("invalid_model_output"), "analysis_failed"],
    [new Error("Upstream 402 from Azure: insufficient credits"), "analysis_failed"],
  ])("maps %s to error %s with no message text", async (failure, code) => {
    const runPipeline = vi.fn(async () => {
      throw failure
    })
    const h = harness([])
    const res = await handleCasesRequest(buildRequest(RETURN_FORM, { image: laptop() }), { ...h.deps, runPipeline } as never)
    const raw = await res.text()
    const events = raw.split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>)
    expect(events).toEqual([{ type: "stage", stage: "analysis" }, { type: "error", code }])
    expect(runPipeline).toHaveBeenCalledTimes(1)
    for (const leak of ["402", "Azure", "credits", "PipelineError", "Upstream"]) expect(raw).not.toContain(leak)
  })
})
