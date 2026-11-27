import fs from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import type { DecisionSignals } from "@/lib/schemas"
import { evaluateFastPath, type FastPathInput } from "@/server/ai/logic/fast-path"
import { normalizeDecisionAnswers, type ProviderAnswerMeta, type RawAnswer } from "@/server/ai/signals/normalize"

vi.mock("server-only", () => ({}))

// Fast-path gate (ADR-001 3.4) on signals normalized from the real recordings.
// Invariants only: a fast outcome is never anything but Akceptacja (TAC-001-03),
// so a case is either eligible (acceptance candidate) or has at least one reason.

const dir = path.resolve(__dirname, "../../fixtures/openrouter/decisions")
type Rec = {
  meta: { request: { caseType: "return" | "complaint"; category: FastPathInput["category"]; reason: string } }
  sdkResult: { answers: Record<string, RawAnswer>; providerMetadata: { openrouter: { answers: ProviderAnswerMeta } } }
}
const NAMES = ["return-laptop-2", "return-phone-1", "complaint-laptop-1", "complaint-phone-3"] as const

function signalsOf(name: string): { rec: Rec; signals: DecisionSignals } {
  const rec = JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), "utf8")) as Rec
  const answers = normalizeDecisionAnswers(rec.sdkResult.answers, rec.sdkResult.providerMetadata.openrouter.answers)
  return { rec, signals: { status: "ok", answers, refusals: [], cost: 0, durationMs: 1 } }
}

function gate(name: string, over: Partial<FastPathInput> = {}, mutate?: (s: DecisionSignals) => void) {
  const { rec, signals } = signalsOf(name)
  mutate?.(signals)
  return evaluateFastPath({
    caseType: rec.meta.request.caseType,
    category: rec.meta.request.category,
    days: rec.meta.request.caseType === "return" ? 10 : 400,
    hasReason: rec.meta.request.reason.trim().length > 0,
    signals,
    enabled: true,
    threshold: 0.8,
    ...over,
  })
}

describe("evaluateFastPath on recording-derived signals", () => {
  it.each(NAMES)("%s: eligible or carries at least one reason; nothing escapes the gate silently", (name) => {
    const result = gate(name)
    if (!result.eligible) expect(result.reasons.length).toBeGreaterThanOrEqual(1)
    // The eligibility report: with the 2026-11-26 Jev 1.14 recordings none is eligible.
    expect(result.eligible).toBe(false)
  })

  it.each(NAMES)("%s: disabling the fast path always escalates with fast_path_disabled", (name) => {
    const result = gate(name, { enabled: false })
    expect(result).toMatchObject({ eligible: false })
    if (!result.eligible) expect(result.reasons).toContain("fast_path_disabled")
  })

  it("return-laptop-2 is blocked by condition (4 of 5, low confidence) and signs_of_use, not by photo or category", () => {
    const result = gate("return-laptop-2")
    expect(result.eligible).toBe(false)
    if (!result.eligible) {
      expect(result.reasons).toEqual(expect.arrayContaining(["condition", "signs_of_use"]))
      expect(result.reasons).not.toContain("photo_usable")
      expect(result.reasons).not.toContain("category_match")
    }
  })

  it("complaint-phone-3 is not eligible: photo not usable, low confidence on cause", () => {
    const result = gate("complaint-phone-3")
    expect(result.eligible).toBe(false)
    if (!result.eligible) expect(result.reasons).toEqual(expect.arrayContaining(["photo_usable", "damage_cause"]))
  })

  it("boundary 0.79 / 0.8 derived from return-laptop-2: only a clean acceptance profile passes at 0.8", () => {
    const clean = (confidence: number) => (s: DecisionSignals) => {
      const a = s.answers
      a.photo_usable = { value: true, confidence: 0.87, probabilities: {} }
      a.device_visible = { value: true, confidence: 1, probabilities: {} }
      a.category_match = { value: true, confidence: 0.98, probabilities: {} }
      a.damage_visible = { value: false, confidence: 0.97, probabilities: {} }
      a.signs_of_use = { value: false, confidence: 0.95, probabilities: {} }
      a.condition = { value: 5, confidence, probabilities: {} }
    }
    // Base values (photo_usable 0.87, device_visible 1, category_match 0.98, damage_visible 0.97)
    // come from the recording; only the fields it contradicted are set to the acceptance profile.
    expect(gate("return-laptop-2", {}, clean(0.8)).eligible).toBe(true)
    const below = gate("return-laptop-2", {}, clean(0.79))
    expect(below).toEqual({ eligible: false, reasons: ["condition"] })
    expect(gate("return-laptop-2", { threshold: 0.79 }, clean(0.79)).eligible).toBe(true)
  })

  it("signals not ok never pass, regardless of recorded answers", () => {
    const result = gate("return-laptop-2", {}, (s) => {
      s.status = "unavailable"
    })
    expect(result.eligible).toBe(false)
    if (!result.eligible) expect(result.reasons).toContain("signals_unavailable")
  })
})
