import "server-only"

import { appendFile, mkdir } from "node:fs/promises"
import path from "node:path"
import type { CaseDecision, DecisionSignals } from "@/lib/schemas"
import { getEnv } from "@/server/env"

// ADR-001 3.7 and TAC-001-06: one JSON line per completed case. The entry holds
// only scores and routing metadata. It never holds the customer's reason, device
// model name, image data or message text.

export interface DecisionLogInput {
  caseType: "return" | "complaint"
  category: string
  daysSincePurchase: number
  signals: Pick<DecisionSignals, "answers" | "cost" | "durationMs" | "refusals" | "status">
  decision: Pick<CaseDecision, "decision" | "route" | "escalationReasons" | "guardsApplied">
  promptVersions: Record<string, string>
  modelIds: Record<string, string>
  durations: Record<string, number>
  cost: number | null
}

export interface DecisionLogEntry {
  timestamp: string
  caseType: "return" | "complaint"
  category: string
  daysSincePurchase: number
  signals: Record<string, { value: boolean | string | number; confidence: number; probabilities: Record<string, number> }>
  route: CaseDecision["route"]
  escalationReasons: string[]
  decision: CaseDecision["decision"]
  guardsApplied: string[]
  promptVersions: Record<string, string>
  modelIds: Record<string, string>
  durations: Record<string, number>
  cost: number | null
}

export function toDecisionLogEntry(input: DecisionLogInput, now: Date = new Date()): DecisionLogEntry {
  const signals: DecisionLogEntry["signals"] = {}
  for (const [key, answer] of Object.entries(input.signals.answers)) {
    signals[key] = {
      value: answer.value,
      confidence: answer.confidence,
      probabilities: answer.probabilities,
    }
  }
  return {
    timestamp: now.toISOString(),
    caseType: input.caseType,
    category: input.category,
    daysSincePurchase: input.daysSincePurchase,
    signals,
    route: input.decision.route,
    escalationReasons: [...input.decision.escalationReasons],
    decision: input.decision.decision,
    guardsApplied: [...input.decision.guardsApplied],
    promptVersions: { ...input.promptVersions },
    modelIds: { ...input.modelIds },
    durations: { ...input.durations },
    cost: input.cost,
  }
}

/**
 * Appends one JSON line. `path` defaults to `DECISION_LOG_PATH`; an empty string
 * disables logging. Relative paths resolve from the app working directory.
 * Never throws: a failed write is logged to the console and the request continues.
 */
export async function appendDecisionLog(entry: DecisionLogEntry, filePath?: string): Promise<void> {
  try {
    const target = filePath ?? getEnv().decisionLogPath
    if (target === "") return
    const absolute = path.resolve(process.cwd(), target)
    await mkdir(path.dirname(absolute), { recursive: true })
    await appendFile(absolute, `${JSON.stringify(entry)}\n`, "utf8")
  } catch (error) {
    console.error("[hsdc] decision log write failed:", error instanceof Error ? error.message : "unknown error")
  }
}
