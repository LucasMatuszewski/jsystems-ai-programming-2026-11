import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  validateUIMessages,
} from "ai"

import type { ChatUIMessage } from "@/lib/chat-types"

export const maxDuration = 30

const MAX_OUTPUT_TOKENS = 8192

// Temporary template chat (T23 replaces it with the case-aware chat agent).
// OpenRouter is the only model provider; there is no mock mode (ADR-006 §3.3).
export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  // Validate the shape of every message before trusting it.
  let messages: ChatUIMessage[]
  try {
    messages = await validateUIMessages<ChatUIMessage>({
      messages: (body as { messages?: unknown })?.messages,
    })
  } catch {
    return Response.json({ error: "Invalid messages." }, { status: 400 })
  }

  // The key is read from OPENROUTER_API_KEY when the request is sent.
  const openrouter = createOpenRouter({
    headers: {
      ...(process.env.APP_URL && { "HTTP-Referer": process.env.APP_URL }),
      ...(process.env.APP_TITLE && {
        "X-OpenRouter-Title": process.env.APP_TITLE,
      }),
    },
  })

  const result = streamText({
    model: openrouter(process.env.LLM_MODEL ?? "openai/gpt-6-luna"),
    messages: await convertToModelMessages(messages),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    abortSignal: req.signal,
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      sendReasoning: false,
      sendSources: false,
      onError: (error) => {
        // Server-side log only; the client gets a masked message.
        console.error("[api/chat] stream error:", error)
        return "Something went wrong. Please try again."
      },
    }),
  })
}
