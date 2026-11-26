import { DecisionDataSchema, StoredSessionSchema, UpdateRecommendationOutputSchema } from "@/lib/schemas"
import type { Decision, StoredSession } from "@/lib/schemas"

/** ADR-003 3.3: one versioned key in sessionStorage (per tab, survives refresh). */
export const SESSION_KEY = "hsdc.session.v1"

const SESSION_VERSION = 1

export type SessionStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

export type WriteSessionResult = { ok: true } | { ok: false; reason: "quota" }

export type CurrentDecision = {
  decision: Decision
  ruleRefs: string[]
  source: "initial" | "update"
}

function safeClear(storage: SessionStorageLike): void {
  try {
    storage.removeItem(SESSION_KEY)
  } catch {
    // storage unavailable: nothing to clear
  }
}

/** Returns the stored session, or null. Invalid, wrong-version or malformed data is cleared. */
export function readSession(storage: SessionStorageLike = sessionStorage): StoredSession | null {
  let raw: string | null
  try {
    raw = storage.getItem(SESSION_KEY)
  } catch {
    return null
  }
  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    safeClear(storage)
    return null
  }
  if (typeof parsed !== "object" || parsed === null || (parsed as { version?: unknown }).version !== SESSION_VERSION) {
    safeClear(storage)
    return null
  }
  const result = StoredSessionSchema.safeParse(parsed)
  if (!result.success) {
    safeClear(storage)
    return null
  }
  return result.data
}

/** Writes the session; a full storage quota is reported, not thrown (ADR-003 3.3). */
export function writeSession(
  session: StoredSession,
  storage: SessionStorageLike = sessionStorage,
): WriteSessionResult {
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(session))
    return { ok: true }
  } catch (error) {
    if (error instanceof Error || error instanceof DOMException) {
      if (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED") {
        return { ok: false, reason: "quota" }
      }
    }
    throw error
  }
}

export function clearSession(storage: SessionStorageLike = sessionStorage): void {
  safeClear(storage)
}

/**
 * The current decision is derived, not stored (ADR-003 3.3): the latest of the
 * initial `data-decision` part and any successful `tool-update_recommendation` output.
 */
export function deriveCurrentDecision(session: StoredSession): CurrentDecision | null {
  const messages = session.messages
  for (let m = messages.length - 1; m >= 0; m--) {
    const parts = messages[m]?.parts ?? []
    for (let p = parts.length - 1; p >= 0; p--) {
      const part = parts[p] as { type: string; data?: unknown; state?: unknown; output?: unknown }
      if (part.type === "tool-update_recommendation" && part.state === "output-available") {
        const output = UpdateRecommendationOutputSchema.safeParse(part.output)
        if (output.success) {
          return { decision: output.data.newDecision, ruleRefs: output.data.ruleRefs, source: "update" }
        }
      }
      if (part.type === "data-decision") {
        const initial = DecisionDataSchema.safeParse(part.data)
        if (initial.success) {
          return { decision: initial.data.decision, ruleRefs: initial.data.ruleRefs, source: "initial" }
        }
      }
    }
  }
  return null
}
