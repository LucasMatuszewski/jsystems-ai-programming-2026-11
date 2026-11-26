"use client"

import { useEffect, useRef, useState } from "react"
import { Chat, useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"

import { CaseSummaryPanel } from "@/components/case-summary/case-summary-panel"
import { ChatErrorRow } from "@/components/chat/error/chat-error-row"
import { ChatInput } from "@/components/chat/input/chat-input"
import { MessageParts } from "@/components/chat/message-parts"
import { pl } from "@/lib/i18n/pl"
import type { CaseContext, StoredSession } from "@/lib/schemas"
import { deriveCurrentDecision, writeSession } from "@/lib/session-store"
import type { CaseUIMessage } from "@/lib/types/chat"
import { cn } from "@/lib/utils"

type ChatSessionProps = {
  session: StoredSession
  onNewCase: () => void
  /** The case could not be written to sessionStorage and lives in memory only (T28 F6). */
  storageUnavailable?: boolean
  /** Tests inject a replay of the recorded /api/chat responses (ADR-006). */
  fetch?: typeof fetch
}

const asSession = (session: StoredSession, messages: CaseUIMessage[]): StoredSession => ({
  ...session,
  messages: messages as unknown as StoredSession["messages"],
})

/** Case context sent with every request; the policy and prompts stay on the server (ADR-002 5). */
function buildCaseContext(session: StoredSession, messages: CaseUIMessage[]): CaseContext {
  const { case: payload } = session
  const current = deriveCurrentDecision(asSession(session, messages))
  return {
    caseId: payload.caseId,
    form: payload.form,
    daysSincePurchase: payload.daysSincePurchase,
    imageFindings: payload.decision.imageFindings,
    signalsSummary: payload.decision.signalsSummary,
    currentDecision: {
      decision: current?.decision ?? payload.decision.decision,
      ruleRefs: current?.ruleRefs ?? payload.decision.ruleRefs,
      source: current?.source ?? "initial",
    },
  }
}

const hasVisibleParts = (message: CaseUIMessage) =>
  message.parts.some((part) => part.type !== "step-start" && !(part.type === "text" && !part.text.trim()))

/** Summary panel plus the live conversation. A request is only ever sent from a user action (ADR-006 3.2). */
export function ChatSession({ session, onNewCase, storageUnavailable = false, fetch: fetchImpl }: ChatSessionProps) {
  const [initial] = useState(session)
  const [storageFailed, setStorageFailed] = useState(false)
  const noticeText = storageUnavailable ? pl.chat.storageUnavailable : pl.chat.storageFailed

  const [chat] = useState(() => {
    const persist = () => {
      const result = writeSession(asSession(initial, instance.messages))
      setStorageFailed(!result.ok)
    }
    const instance: Chat<CaseUIMessage> = new Chat<CaseUIMessage>({
      id: initial.case.caseId,
      messages: initial.messages as CaseUIMessage[],
      transport: new DefaultChatTransport<CaseUIMessage>({
        api: "/api/chat",
        fetch: fetchImpl,
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: { id, messages, caseContext: buildCaseContext(initial, messages) },
        }),
      }),
      onFinish: persist,
      onError: persist,
    })
    return instance
  })

  const { messages, status, error, sendMessage, regenerate } = useChat<CaseUIMessage>({ chat })

  const logRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, status])

  const current = deriveCurrentDecision(asSession(initial, messages))
  const busy = status === "submitted" || status === "streaming"
  const showError = status === "error" || (error !== undefined && !busy)

  const panel = current
    ? (variant: "desktop" | "mobile") => (
        <CaseSummaryPanel
          payload={initial.case}
          currentDecision={current}
          onNewCase={onNewCase}
          variant={variant}
        />
      )
    : null

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 p-4 md:grid md:grid-cols-[18rem_1fr] md:items-start md:gap-6 md:overflow-hidden md:p-6">
      {panel ? <div className="hidden md:block md:max-h-full md:overflow-y-auto">{panel("desktop")}</div> : null}
      {panel ? <div className="md:hidden">{panel("mobile")}</div> : null}
      <div className="flex min-h-0 flex-1 flex-col gap-3 md:max-h-full md:self-stretch">
        <section
          ref={logRef}
          role="log"
          aria-label="Rozmowa"
          // Scrollable region must be keyboard reachable (axe scrollable-region-focusable, AC-46).
          tabIndex={0}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          {messages.filter(hasVisibleParts).map((message) => (
            <Bubble key={message.id} message={message} />
          ))}
          {showError ? <ChatErrorRow onRetry={() => void regenerate()} /> : null}
        </section>
        {storageFailed || storageUnavailable ? (
          <p role="status" className="text-sm text-muted-foreground">
            {noticeText}
          </p>
        ) : null}
        <ChatInput disabled={busy} onSend={(text) => void sendMessage({ text })} />
      </div>
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
