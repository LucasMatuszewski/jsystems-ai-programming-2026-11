import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  validateUIMessages,
} from "ai"

import type { ChatUIMessage } from "@/lib/chat-types"
import { createRequestId, logIncoming } from "@/server/ai/log/call-log"
import { createStepCallLogger } from "@/server/ai/upstream"

export const maxDuration = 30

const MAX_OUTPUT_TOKENS = 8192
const ROUTE = "/api/chat"

// Temporary template chat (T23 replaces it with the case-aware chat agent).
// OpenRouter is the only model provider; there is no mock mode (ADR-006 §3.3).
export async function POST(req: Request) {
  const requestId = createRequestId()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    logIncoming({ requestId, route: ROUTE, status: 400 })
    return Response.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  // Validate the shape of every message before trusting it.
  let messages: ChatUIMessage[]
  try {
    messages = await validateUIMessages<ChatUIMessage>({
      messages: (body as { messages?: unknown })?.messages,
    })
  } catch {
    logIncoming({ requestId, route: ROUTE, status: 400 })
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

  const modelId = process.env.LLM_MODEL ?? "openai/gpt-6-luna"
  const upstreamLog = createStepCallLogger({
    requestId,
    stage: "chat-step",
    modelId,
  })

  const result = streamText({
    model: openrouter(modelId),
    messages: await convertToModelMessages(messages),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    abortSignal: req.signal,
    // One upstream log line per model step (ADR-006 3.2).
    onStepStart: () => upstreamLog.start(),
    onStepEnd: (step) => upstreamLog.end(step),
    onError: ({ error }) => upstreamLog.fail(error),
  })

  // The stream is already committed to 200 when it starts; mid-stream failures
  // are logged as upstream error lines above.
  logIncoming({ requestId, route: ROUTE, status: 200 })
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
