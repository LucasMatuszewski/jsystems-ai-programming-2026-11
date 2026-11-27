import type { SignalAnswer } from "@/lib/schemas"

// ADR-001 3.3: normalize provider answers to { value, confidence, probabilities }.
// Pure module (no server-only import). Unexpected shapes throw InvalidAnswerError;
// the adapter maps that to the `invalid_answer` reason and never shows the detail.

export class InvalidAnswerError extends Error {
  override readonly name = "InvalidAnswerError"
}

export type RawAnswer =
  | { type: "boolean"; probability: number }
  | { type: "choice"; choice: string; probabilities?: Record<string, number> }
  | { type: "score"; score: number; probabilities?: Record<string, number> }

/** Confidence the provider reports for choice and score answers (ADR-001 A1). */
export type ProviderAnswerMeta = Record<string, { confidence?: number } | undefined>

function invalid(message: string): never {
  throw new InvalidAnswerError(message)
}

function assertProbability(p: unknown, where: string): number {
  if (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 1) {
    invalid(`${where}: probability out of range`)
  }
  return p
}

function assertDistribution(
  dist: Record<string, number> | undefined,
  where: string
): Record<string, number> | undefined {
  if (dist === undefined) return undefined
  for (const [option, p] of Object.entries(dist)) {
    assertProbability(p, `${where}.${option}`)
  }
  return dist
}

function topProbability(dist: Record<string, number> | undefined): number {
  if (!dist) return 0
  const values = Object.values(dist)
  return values.length === 0 ? 0 : Math.max(...values)
}

function providerConfidence(meta: ProviderAnswerMeta | undefined, key: string): number | undefined {
  const c = meta?.[key]?.confidence
  if (c === undefined) return undefined
  if (typeof c !== "number" || !Number.isFinite(c) || c < 0 || c > 1) {
    invalid(`${key}: confidence out of range`)
  }
  return c
}

function normalizeOne(raw: RawAnswer, key: string, meta: ProviderAnswerMeta | undefined): SignalAnswer {
  switch (raw.type) {
    case "boolean": {
      const p = assertProbability(raw.probability, key)
      return {
        value: p >= 0.5,
        confidence: Math.max(p, 1 - p),
        probabilities: { true: p, false: 1 - p },
      }
    }
    case "choice": {
      if (typeof raw.choice !== "string" || raw.choice.length === 0) {
        invalid(`${key}: empty choice`)
      }
      const probabilities = assertDistribution(raw.probabilities, key)
      const confidence = providerConfidence(meta, key) ?? topProbability(probabilities)
      return {
        value: raw.choice,
        confidence,
        probabilities: probabilities ?? { [raw.choice]: 1 },
      }
    }
    case "score": {
      if (typeof raw.score !== "number" || !Number.isFinite(raw.score) || raw.score < 0) {
        invalid(`${key}: score not a finite non-negative number`)
      }
      const dist = assertDistribution(raw.probabilities, key)
      // Distribution keys are zero-based level indices; the signal value is the
      // 1-based level number (CONDITION_LEVELS.level).
      const levelProbabilities: Record<string, number> = {}
      let topIndex: number
      if (dist) {
        let best = -1
        let bestP = -1
        for (const [index, p] of Object.entries(dist)) {
          const i = Number(index)
          if (!Number.isInteger(i) || i < 0) invalid(`${key}: bad level index`)
          levelProbabilities[String(i + 1)] = p
          if (p > bestP) {
            bestP = p
            best = i
          }
        }
        if (best < 0) invalid(`${key}: empty distribution`)
        topIndex = best
      } else {
        topIndex = Math.round(raw.score)
      }
      const confidence = providerConfidence(meta, key) ?? topProbability(dist)
      return {
        value: topIndex + 1,
        confidence,
        probabilities: dist ? levelProbabilities : { [String(topIndex + 1)]: 1 },
      }
    }
    default:
      invalid(`${key}: unknown answer type`)
  }
}

/**
 * Normalizes every answer. Confidence rules (ADR-001 3.3, A1):
 * boolean -> max(p, 1 - p); choice and score -> provider `confidence` when given,
 * else the top probability, else 0 (fail-closed: a value without any confidence
 * can never pass the fast-path threshold).
 */
export function normalizeDecisionAnswers(
  rawAnswers: Record<string, RawAnswer>,
  providerAnswerMeta?: ProviderAnswerMeta
): Record<string, SignalAnswer> {
  const out: Record<string, SignalAnswer> = {}
  for (const [key, raw] of Object.entries(rawAnswers)) {
    if (typeof raw !== "object" || raw === null) invalid(`${key}: missing answer`)
    out[key] = normalizeOne(raw, key, providerAnswerMeta)
  }
  return out
}
