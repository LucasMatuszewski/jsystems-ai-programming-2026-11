"use client"

import { useMemo, useSyncExternalStore } from "react"

import type { StoredSession } from "@/lib/schemas"
import { readSession, SESSION_KEY } from "@/lib/session-store"

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
export function useStoredSession(): { checked: boolean; session: StoredSession | null } {
  const raw = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
  const session = useMemo(() => (raw === null ? null : readSession()), [raw])
  return { checked: raw !== null, session }
}
