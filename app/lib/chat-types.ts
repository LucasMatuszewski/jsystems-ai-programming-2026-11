import type { UIMessage } from "ai"

// Temporary template chat has no tools, data parts or metadata (T23 replaces it).
export type ChatUIMessage = UIMessage
export type ChatMessagePart = ChatUIMessage["parts"][number]
export type TextMessagePart = Extract<ChatMessagePart, { type: "text" }>
