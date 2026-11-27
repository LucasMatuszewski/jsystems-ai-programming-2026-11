import fs from "node:fs"
import path from "node:path"
import { vi } from "vitest"
import type { CaseContext } from "@/lib/schemas"

export const llmDir = path.resolve(__dirname, "../../fixtures/openrouter/llm")
export const errorsDir = path.resolve(__dirname, "../../fixtures/openrouter/errors")
export const imagesDir = path.resolve(__dirname, "../../../../assets/example-images")

export function stubEnv() {
  vi.stubEnv("OPENROUTER_API_KEY", "sk-or-v1-replay-not-a-real-key")
}

export function policyText(type: "return" | "complaint"): string {
  return fs.readFileSync(path.resolve(__dirname, `../../../../docs/policies/${type}-policy.md`), "utf8")
}

type RecordedLlm = {
  meta: { request: Record<string, unknown> }
  sdkResult: { output?: Record<string, unknown> }
}

export function readRecording(name: string): RecordedLlm {
  return JSON.parse(fs.readFileSync(path.join(llmDir, `${name}.json`), "utf8")) as RecordedLlm
}

/** Case context rebuilt from the recorded escalated decision (same shape the recorder used). */
export function chatContext(sourceName: string, caseType: "return" | "complaint"): CaseContext {
  const out = readRecording(sourceName).sdkResult.output!
  const request = readRecording(sourceName).meta.request as { category: never; model: string; purchaseDate: string; reason: string; days: number }
  return {
    caseId: "00000000-0000-4000-8000-000000000001",
    form: { caseType, category: request.category, model: request.model, purchaseDate: request.purchaseDate, reason: request.reason, consent: true },
    daysSincePurchase: request.days,
    imageFindings: out.imageFindings as never,
    signalsSummary: {},
    currentDecision: { decision: out.decision as never, ruleRefs: out.ruleRefs as string[], source: "initial" },
  }
}
