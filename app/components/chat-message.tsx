"use client"

import { type ChatUIMessage } from "@/lib/chat-types"
import { MessageActions } from "@/components/message-actions"
import { TextPart } from "@/components/parts/text-part"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageContent } from "@/components/ui/message"

export function ChatMessage({
  message,
  isStreaming = false,
  onRetry,
}: {
  message: ChatUIMessage
  isStreaming?: boolean
  onRetry?: () => void
}) {
  if (message.role === "user") {
    return (
      <Message align="end">
        <MessageContent>
          <Bubble align="end" variant="muted">
            <BubbleContent>
              {message.parts
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("")}
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    )
  }

  // Join streamed text parts back into one markdown document.
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")

  return (
    <Message align="start">
      <MessageContent>
        {text.trim() && <TextPart part={{ type: "text", text }} />}
        {!isStreaming && text.trim() && (
          <MessageActions text={text} onRetry={onRetry} />
        )}
      </MessageContent>
    </Message>
  )
}
