import fs from "node:fs"
import path from "node:path"
import { generateText } from "ai"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { EscalatedDecisionOutputSchema, WriterOutputSchema } from "@/lib/schemas"
import { loadFixture, replayFetch } from "../../helpers/replay-fetch"
import { imagesDir, llmDir, policyText, readRecording, stubEnv } from "./helpers"

vi.mock("server-only", () => ({}))

describe("replay: generateText with recorded gpt-6-luna responses", () => {
  let createProvider: typeof import("@/server/ai/provider").createProvider
  let buildEscalationCall: typeof import("@/server/ai/calls/escalation").buildEscalationCall
  let buildWriterCall: typeof import("@/server/ai/calls/writer").buildWriterCall
  let prepareForModel: typeof import("@/server/image").prepareForModel

  beforeAll(async () => {
    stubEnv()
    ;({ createProvider } = await import("@/server/ai/provider"))
    ;({ buildEscalationCall } = await import("@/server/ai/calls/escalation"))
    ;({ buildWriterCall } = await import("@/server/ai/calls/writer"))
    ;({ prepareForModel } = await import("@/server/image"))
  })

  const model = (name: string) =>
    createProvider({ fetch: replayFetch(loadFixture(path.join(llmDir, `${name}.json`))) }).chat("openai/gpt-6-luna")

  it.each([
    ["escalated-return-laptop-2", "return", "laptop-2.webp"],
    ["escalated-complaint-phone-1", "complaint", "phone-1.jpg"],
  ] as const)("%s: the escalation call parses into EscalatedDecisionOutput", async (name, caseType, photo) => {
    const request = readRecording(name).meta.request as { category: never; model: string; purchaseDate: string; reason: string; days: number }
    const img = await prepareForModel(fs.readFileSync(path.join(imagesDir, photo)))
    const call = buildEscalationCall({
      caseInput: { caseType, category: request.category, model: request.model, purchaseDate: request.purchaseDate, reason: request.reason },
      days: request.days, signals: null, image: { buffer: img.buffer, mediaType: img.mediaType },
      policy: policyText(caseType), reasoningEffort: "high", model: model(name),
    })
    const result = await generateText(call)
    expect(EscalatedDecisionOutputSchema.safeParse(result.output).success).toBe(true)
    expect(result.output).toEqual(readRecording(name).sdkResult.output)
  })

  it.each([
    ["writer-rule-return-r4", "return", "escalated-return-laptop-2", "R-4"],
    ["writer-rule-complaint-c2", "complaint", "escalated-complaint-phone-1", "C-2"],
  ] as const)("%s: the writer call parses into WriterOutput", async (name, caseType, source, rule) => {
    const request = readRecording(name).meta.request as { category: never; model: string; purchaseDate: string; reason: string; days: number }
    const findings = readRecording(source).sdkResult.output!.imageFindings as never
    const call = buildWriterCall({
      caseInput: { caseType, category: request.category, model: request.model, purchaseDate: request.purchaseDate, reason: request.reason },
      days: request.days, decision: "Odrzucenie", ruleRefs: [rule], imageFindings: findings, signalsSummary: null,
      policy: policyText(caseType), reasoningEffort: "low", model: model(name),
    })
    const result = await generateText(call)
    expect(WriterOutputSchema.safeParse(result.output).success).toBe(true)
  })
})
