import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { useStoredSession } from "@/components/case-flow/use-stored-session"
import { clearSession, rememberSessionInMemory, SESSION_KEY } from "@/lib/session-store"
import { storedSession } from "../chat/conversation/harness"

// T28 F6: a session that could not be written to sessionStorage is still served from memory.

beforeEach(() => {
  sessionStorage.clear()
  clearSession()
})

describe("useStoredSession", () => {
  it("returns null when nothing is stored", () => {
    const { result } = renderHook(() => useStoredSession())
    expect(result.current).toEqual({ checked: true, session: null, memoryOnly: false })
  })

  it("returns the stored session and is not memory-only", () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(storedSession()))
    const { result } = renderHook(() => useStoredSession())
    expect(result.current.session).toEqual(storedSession())
    expect(result.current.memoryOnly).toBe(false)
  })

  it("falls back to the in-memory session when storage has none, and marks it memory-only", () => {
    rememberSessionInMemory(storedSession())
    const { result } = renderHook(() => useStoredSession())
    expect(result.current.session).toEqual(storedSession())
    expect(result.current.memoryOnly).toBe(true)
  })
})
