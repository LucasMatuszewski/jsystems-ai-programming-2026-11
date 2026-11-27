"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { clearSession } from "@/lib/session-store"
import { ChatSession } from "./chat-session"
import { useStoredSession } from "./use-stored-session"

/** `/chat`: reads the tab session and hands it to the conversation (PRD 4.3). */
export function ChatScreen() {
  const router = useRouter()
  const { checked, session, memoryOnly } = useStoredSession()

  // Navigation only, no requests: no session means back to the form.
  useEffect(() => {
    if (checked && !session) router.replace("/")
  }, [checked, session, router])

  if (!checked || !session) {
    return <main className="min-h-0 flex-1" aria-busy="true" />
  }

  const newCase = () => {
    clearSession()
    router.replace("/")
  }

  return <ChatSession session={session} onNewCase={newCase} storageUnavailable={memoryOnly} />
}
