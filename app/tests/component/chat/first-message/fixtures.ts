import { readFileSync } from "node:fs"
import path from "node:path"
import type { Decision } from "@/lib/schemas/enums"
import type { CaseMessagePart, CaseUIMessage } from "@/lib/types/chat"

const fixtureFile = (rel: string) => path.resolve(process.cwd(), "tests/fixtures", rel)

/** `firstMessage` from the result event of a recorded /api/cases NDJSON body (ADR-006). */
export function recordedFirstMessage(name: string): CaseUIMessage {
  const raw = JSON.parse(readFileSync(fixtureFile(`app/cases/${name}.ndjson.json`), "utf8"))
  const events = (raw.response.body as string)
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as { type: string; case?: { firstMessage: CaseUIMessage } })
  const result = events.find((event) => event.type === "result")
  if (!result?.case) throw new Error(`no result event in recording ${name}`)
  return result.case.firstMessage
}

type RecordedToolUpdate = {
  toolCallId: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  reasoning: string
}

/** Real `update_recommendation` call and output, plus the recorded reasoning text (ADR-006). */
export function recordedToolUpdate(): RecordedToolUpdate {
  const raw = JSON.parse(readFileSync(fixtureFile("openrouter/llm/chat-tool-update.json"), "utf8"))
  const chunks = raw.sdkResult.uiMessageChunks as Array<Record<string, unknown>>
  const input = chunks.find((chunk) => chunk.type === "tool-input-available")
  const output = chunks.find((chunk) => chunk.type === "tool-output-available")
  if (!input || !output) throw new Error("tool chunks missing in chat-tool-update recording")
  const reasoning = chunks
    .filter((chunk) => chunk.type === "reasoning-delta")
    .map((chunk) => String(chunk.delta))
    .join("")
  return {
    toolCallId: String(output.toolCallId),
    input: input.input as Record<string, unknown>,
    output: output.output as Record<string, unknown>,
    reasoning,
  }
}

/** Replaces the decision of the `data-decision` part; everything else is taken from the base recording. */
export function initialVariant(base: CaseUIMessage, decision: Decision): CaseUIMessage {
  return {
    ...base,
    parts: base.parts.map((part) =>
      part.type === "data-decision" ? { ...part, data: { ...part.data, decision } } : part,
    ),
  }
}

/** Appends parts to a base recording (used for reasoning / unknown part checks). */
export function withExtraParts(base: CaseUIMessage, extra: unknown[]): CaseUIMessage {
  return { ...base, parts: [...base.parts, ...(extra as CaseMessagePart[])] }
}

export function updatePart(
  toolCallId: string,
  state: "input-streaming" | "input-available" | "output-available" | "output-error",
  input: Record<string, unknown>,
  output?: Record<string, unknown>,
): CaseMessagePart {
  return {
    type: "tool-update_recommendation",
    toolCallId,
    state,
    input,
    ...(state === "output-available" ? { output } : {}),
    ...(state === "output-error" ? { errorText: "boom" } : {}),
  } as unknown as CaseMessagePart
}

/** Derived update: the recorded tool output with `newDecision` replaced, previous set to another decision. */
export function updateMessage(base: CaseUIMessage, newDecision: Decision): CaseUIMessage {
  const recorded = recordedToolUpdate()
  const previousDecision: Decision = newDecision === "Odrzucenie" ? "Akceptacja" : "Odrzucenie"
  return {
    ...base,
    parts: [
      ...base.parts,
      updatePart(recorded.toolCallId, "output-available", recorded.input, {
        ...recorded.output,
        previousDecision,
        newDecision,
      }),
    ],
  }
}
