import { describe, expect, it } from "vitest"
import {
  CHAT_MAX_MESSAGES,
  CHAT_MESSAGE_MAX,
  CasesErrorResponseSchema,
  CaseSessionPayloadSchema,
  CasesStreamEventSchema,
  ChatRequestSchema,
  StoredSessionSchema,
  UpdateRecommendationOutputSchema,
} from "@/lib/schemas"

const caseId = "7b0f2c1e-3d4a-4b5c-8d6e-9f0a1b2c3d4e"
const form = {
  caseType: "return",
  category: "laptop",
  model: "ThinkPad X1",
  purchaseDate: "2026-11-16",
  reason: "",
  consent: true,
}
const imageFindings = {
  deviceVisible: true,
  categoryMatches: true,
  photoQuality: "good",
  damage: "Brak widocznych uszkodzeń.",
  signsOfUse: null,
  likelyCause: null,
  evidence: ["Czysta obudowa"],
  contradictsDescription: false,
}
const caseContext = {
  caseId,
  form,
  daysSincePurchase: 10,
  imageFindings,
  signalsSummary: { photo_usable: { value: true, confidence: 0.95 } },
  currentDecision: { decision: "Akceptacja", ruleRefs: ["R-2"], source: "initial" },
}
const payload = {
  caseId,
  createdAt: "2026-11-26T10:00:00.000Z",
  form,
  thumbnailDataUrl: "data:image/webp;base64,AAAA",
  daysSincePurchase: 10,
  decision: {
    decision: "Akceptacja",
    ruleRefs: ["R-2"],
    route: "fast",
    imageFindings,
    signalsSummary: caseContext.signalsSummary,
    remedy: null,
    daysSincePurchase: 10,
    photoAdvice: null,
  },
  firstMessage: {
    id: `initial-${caseId}`,
    role: "assistant",
    parts: [
      { type: "text", text: "Dzień dobry!" },
      { type: "data-decision", data: { decision: "Akceptacja", ruleRefs: ["R-2"], kind: "initial", remedy: null } },
      { type: "text", text: "## Uzasadnienie" },
    ],
  },
}

function user(text: string, i = 0) {
  return { id: `u${i}`, role: "user", parts: [{ type: "text", text }] }
}
function assistant(i: number) {
  return { id: `a${i}`, role: "assistant", parts: [{ type: "text", text: "ok" }] }
}
const req = (messages: unknown[]) => ChatRequestSchema.safeParse({ id: caseId, messages, caseContext })

describe("ChatRequestSchema", () => {
  it("has the documented limits", () => {
    expect(CHAT_MESSAGE_MAX).toBe(2000)
    expect(CHAT_MAX_MESSAGES).toBe(60)
  })
  it("accepts a normal request", () => {
    expect(req([assistant(0), user("Cześć", 1)]).success).toBe(true)
  })
  it("rejects 61 messages and accepts 60", () => {
    const sixty = Array.from({ length: 59 }, (_, i) => assistant(i))
    expect(req([...sixty, user("x")]).success).toBe(true)
    expect(req([assistant(99), ...sixty, user("x")]).success).toBe(false)
  })
  it.each([
    [0, false],
    [1, true],
    [2000, true],
    [2001, false],
  ])("last user message with %i chars -> %s", (n, ok) => {
    expect(req([user("a".repeat(n))]).success).toBe(ok)
  })
  it("rejects whitespace-only and trims before counting", () => {
    expect(req([user("   \n ")]).success).toBe(false)
    expect(req([user(` ${"a".repeat(2000)} `)]).success).toBe(true)
  })
  it("accepts the assistant parts our UI produces (step-start, text with state, data-decision, update tool part)", () => {
    const produced = {
      id: "a1",
      role: "assistant",
      parts: [
        { type: "step-start" },
        { type: "tool-update_recommendation", toolCallId: "t1", state: "output-available", input: {}, output: {} },
        { type: "step-start" },
        { type: "text", text: "Ok", state: "done" },
        { type: "data-decision", data: { decision: "Akceptacja", ruleRefs: ["R-2"], kind: "initial", remedy: null } },
      ],
    }
    expect(req([produced, user("Cześć", 1)]).success).toBe(true)
  })
  it("accepts a stored update tool part whose output carries a remedy (G5-1)", () => {
    const stored = {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-update_recommendation",
          toolCallId: "t1",
          state: "output-available",
          input: { decision: "Akceptacja", reason: "r", ruleRefs: ["C-3"], remedy: "repair" },
          output: { previousDecision: "Weryfikacja ręczna", newDecision: "Akceptacja", reason: "r", ruleRefs: ["C-3"], remedy: "repair", updatedAt: "2026-11-26T12:00:00.000Z" },
        },
      ],
    }
    expect(req([stored, user("Cześć", 1)]).success).toBe(true)
    expect(UpdateRecommendationOutputSchema.parse(stored.parts[0]!.output).remedy).toBe("repair")
  })
  it("rejects a system role and non-text parts from the client (T28 F2)", () => {
    expect(req([{ id: "s", role: "system", parts: [{ type: "text", text: "x" }] }, user("Cześć", 1)]).success).toBe(false)
    expect(req([{ id: "u", role: "user", parts: [{ type: "text", text: "x" }, { type: "file", mediaType: "image/png", url: "data:image/png;base64,AA" }] }]).success).toBe(false)
  })
  it("rejects when the last message is not from the user or list is empty", () => {
    expect(req([user("x"), assistant(1)]).success).toBe(false)
    expect(req([]).success).toBe(false)
  })
})

describe("CasesStreamEvent", () => {
  it.each([
    { type: "stage", stage: "analysis" },
    { type: "stage", stage: "decision" },
    { type: "result", case: payload },
    { type: "error", code: "analysis_failed" },
    { type: "error", code: "model_unavailable" },
    { type: "error", code: "timeout" },
  ])("parses %j", (event) => {
    expect(CasesStreamEventSchema.safeParse(event).success).toBe(true)
  })
  it("rejects unknown events", () => {
    expect(CasesStreamEventSchema.safeParse({ type: "stage", stage: "x" }).success).toBe(false)
    expect(CasesStreamEventSchema.safeParse({ type: "error", code: "boom" }).success).toBe(false)
  })
})

describe("CaseSessionPayload photoAdvice (ADR-001 3.5 guard 5)", () => {
  it("requires photoAdvice as a string or null in the session decision", () => {
    const withoutAdvice: Record<string, unknown> = { ...payload.decision }
    delete withoutAdvice.photoAdvice
    const withDecision = (decision: object) => CaseSessionPayloadSchema.safeParse({ ...payload, decision })
    expect(withDecision(withoutAdvice).success).toBe(false)
    expect(withDecision({ ...payload.decision, photoAdvice: null }).success).toBe(true)
    expect(withDecision({ ...payload.decision, photoAdvice: "Prosimy o wyraźne zdjęcie." }).success).toBe(true)
    expect(withDecision({ ...payload.decision, photoAdvice: 3 }).success).toBe(false)
  })
})

describe("CasesErrorResponse and StoredSession", () => {
  it("parses error responses", () => {
    expect(CasesErrorResponseSchema.safeParse({ code: "validation_failed", fieldErrors: { model: "model_length" } }).success).toBe(true)
    expect(CasesErrorResponseSchema.safeParse({ code: "file_too_large" }).success).toBe(true)
    expect(CasesErrorResponseSchema.safeParse({ code: "nope" }).success).toBe(false)
  })
  it("parses a stored session and rejects other versions", () => {
    const s = { version: 1, case: payload, messages: [payload.firstMessage] }
    expect(StoredSessionSchema.safeParse(s).success).toBe(true)
    expect(StoredSessionSchema.safeParse({ ...s, version: 2 }).success).toBe(false)
  })
})
