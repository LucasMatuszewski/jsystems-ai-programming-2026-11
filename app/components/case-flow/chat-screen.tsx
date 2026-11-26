"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { CaseSummaryPanel } from "@/components/case-summary/case-summary-panel"
import { MessageParts } from "@/components/chat/message-parts"
import { clearSession, deriveCurrentDecision } from "@/lib/session-store"
import type { CaseUIMessage } from "@/lib/types/chat"
import { useStoredSession } from "./use-stored-session"
import { cn } from "@/lib/utils"

/** `/chat`: summary + conversation. The input and streaming arrive in T25. */
export function ChatScreen() {
  const router = useRouter()
  const { checked, session } = useStoredSession()

  // Navigation only, no requests: no session means back to the form.
  useEffect(() => {
    if (checked && !session) router.replace("/")
  }, [checked, session, router])

  if (!checked || !session) {
    return <main className="min-h-0 flex-1" aria-busy="true" />
  }

  const current = deriveCurrentDecision(session)
  const newCase = () => {
    clearSession()
    router.replace("/")
  }

  const panel = current
    ? (variant: "desktop" | "mobile") => (
        <CaseSummaryPanel
          payload={session.case}
          currentDecision={current}
          onNewCase={newCase}
          variant={variant}
        />
      )
    : null

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 p-4 md:grid md:grid-cols-[18rem_1fr] md:items-start md:gap-6 md:overflow-hidden md:p-6">
      {panel ? <div className="hidden md:block md:max-h-full md:overflow-y-auto">{panel("desktop")}</div> : null}
      {panel ? <div className="md:hidden">{panel("mobile")}</div> : null}
      <section
        role="log"
        aria-label="Rozmowa"
        className="flex min-h-0 flex-col gap-4 overflow-y-auto md:max-h-full"
      >
        {session.messages.map((message) => (
          <Bubble key={message.id} message={message as CaseUIMessage} />
        ))}
      </section>
    </main>
  )
}

function Bubble({ message }: { message: CaseUIMessage }) {
  const agent = message.role !== "user"
  return (
    <div className={cn("flex", agent ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "flex max-w-[90%] flex-col gap-3 border-[3px] border-hairline p-4 text-on-surface shadow-brand-sm",
          agent ? "rounded-bubble-agent bg-chat-agent" : "rounded-bubble-client bg-chat-client",
        )}
      >
        <MessageParts message={message} />
      </div>
    </div>
  )
}
