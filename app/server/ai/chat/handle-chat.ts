import "server-only"

import { validateUIMessages } from "ai"
import { todayInWarsaw } from "@/lib/dates"
import { makeChatRequestSchema, type ChatRequest, DecisionDataSchema, UpdateRecommendationInputSchema, UpdateRecommendationOutputSchema } from "@/lib/schemas"
import type { CaseUIMessage } from "@/lib/types/chat"
import { createRequestId, defaultSink, logIncoming, type LogSink } from "@/server/ai/log/call-log"
import { daysSincePurchase } from "@/server/ai/logic/days"
import { EnvError, getEnv, type AppEnv } from "@/server/env"
import { readBodyLimited } from "@/server/http/read-limited-body"
import { buildChatStream, type BuildChatStreamDeps } from "./build-chat-stream"

// ADR-002 5 `/api/chat`: pre-stream errors are JSON; the stream carries everything else.

const ROUTE = "/api/chat"
export const MAX_CHAT_BODY_BYTES = 512 * 1024
export const CHAT_TIMEOUT_MS = 60_000

export interface HandleChatDeps extends Omit<BuildChatStreamDeps, "env"> {
  env?: AppEnv
}

type ErrorCode = "validation_failed" | "file_too_large" | "server_misconfigured"

export async function handleChatRequest(request: Request, deps: HandleChatDeps = {}): Promise<Response> {
  const requestId = deps.requestId ?? createRequestId()
  const sink: LogSink = deps.callLogSink ?? defaultSink
  const respond = (status: number, code: ErrorCode): Response => {
    logIncoming({ requestId, route: ROUTE, status, sink })
    return Response.json({ code }, { status, headers: { "Cache-Control": "no-store" } })
  }

  const bytes = await readBodyLimited(request, MAX_CHAT_BODY_BYTES)
  if (bytes === null) return respond(413, "file_too_large")
  const clock = deps.now ?? (() => new Date())

  let parsed
  let messages: CaseUIMessage[]
  try {
    parsed = makeChatRequestSchema(todayInWarsaw(clock())).parse(JSON.parse(new TextDecoder().decode(bytes)))
    // The client value is advisory: guards and prompt use the count from the purchase date and the server clock (T28 F3).
    parsed.caseContext.daysSincePurchase = daysSincePurchase(parsed.caseContext.form.purchaseDate, clock())
    messages = await validateUIMessages<CaseUIMessage>({
      messages: parsed.messages,
      dataSchemas: { decision: DecisionDataSchema },
      tools: {
        update_recommendation: {
          inputSchema: UpdateRecommendationInputSchema,
          outputSchema: UpdateRecommendationOutputSchema,
        },
      },
    })
  } catch {
    return respond(400, "validation_failed")
  }

  let env: AppEnv
  try {
    env = deps.env ?? getEnv()
  } catch (error) {
    if (error instanceof EnvError) return respond(500, "server_misconfigured")
    throw error
  }

  const abortSignal = AbortSignal.any([request.signal, AbortSignal.timeout(CHAT_TIMEOUT_MS), ...(deps.abortSignal ? [deps.abortSignal] : [])])
  logIncoming({ requestId, route: ROUTE, status: 200, sink })
  return buildChatStream(
    { ...parsed, messages: messages as unknown as ChatRequest["messages"] },
    { ...deps, env, requestId, callLogSink: sink, abortSignal },
  )
}
