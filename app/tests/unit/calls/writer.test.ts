import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { buildWriterCall } from "@/server/ai/calls/writer"
import { loadPrompt } from "@/server/ai/prompts"
import { findings, model, policy, returnInput } from "./fixtures"

const args = {
  caseInput: { ...returnInput, reason: "Laptop przestał się ładować" },
  days: 45,
  decision: "Odrzucenie" as const,
  ruleRefs: ["R-4"],
  imageFindings: findings,
  signalsSummary: null,
  policy,
  reasoningEffort: "low" as const,
  model,
}

describe("buildWriterCall", () => {
  it("uses the writer prompt and policy, low effort, no provider options", () => {
    const call = buildWriterCall(args) as Record<string, unknown>
    expect(call.instructions).toContain(loadPrompt("writer").text)
    expect(call.instructions).toContain(policy)
    expect(call.reasoning).toBe("low")
    expect(call.providerOptions).toBeUndefined()
  })

  it("passes the locked decision, rules and findings as text and never an image", () => {
    const content = buildWriterCall(args).messages[0]!.content
    expect(content.every((p) => p.type === "text")).toBe(true)
    const text = (content[0] as { text: string }).text
    expect(text).toContain("LOCKED decision: Odrzucenie")
    expect(text).toContain("Rule references: R-4")
    expect(text).toContain("daysSincePurchase (given by the system): 45")
    expect(text).toContain("<customer_reason>Laptop przestał się ładować</customer_reason>")
    expect(text).toContain("Laptop widoczny w całości")
    expect(text).toContain("Signals summary: unavailable")
  })

  it("gives the Polish category label and a dd.mm.yyyy date, never the raw enum or the ISO date (G4 D2)", () => {
    const text = (buildWriterCall({ ...args, caseInput: { ...args.caseInput, category: "tv", purchaseDate: "2026-11-21" } }).messages[0]!.content[0] as { text: string }).text
    expect(text).toContain("Category: Telewizor")
    expect(text).toContain("Purchase date: 21.11.2026")
    expect(text).not.toMatch(/Category: tv\b|2026-11-21/)
  })
})
