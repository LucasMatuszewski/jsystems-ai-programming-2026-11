"use client"

import { useMemo, useSyncExternalStore } from "react"

import type { StoredSession } from "@/lib/schemas"
import { readMemorySession, readSession, SESSION_KEY } from "@/lib/session-store"

const subscribe = () => () => {}
const clientSnapshot = () => {
  try {
    return sessionStorage.getItem(SESSION_KEY) ?? ""
  } catch {
    return ""
  }
}
const serverSnapshot = () => null

/**
 * Reads the tab session without a hydration mismatch. `checked` is false on the server and during
 * hydration (render a neutral shell); afterwards `session` is the stored session or null.
 */
export function useStoredSession(): { checked: boolean; session: StoredSession | null; memoryOnly: boolean } {
  const raw = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
  const stored = useMemo(() => (raw === null ? null : readSession()), [raw])
  // Storage failed after the analysis: the result is served from memory (T28 F6).
  const memory = stored === null && raw !== null ? readMemorySession() : null
  return { checked: raw !== null, session: stored ?? memory, memoryOnly: memory !== null }
}
