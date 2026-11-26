import "server-only"

import { defaultSink, type LogSink } from "@/server/ai/log/call-log"

// ADR-006 3.2: every outbound model call is wrapped so that exactly one
// `upstream` line is logged on completion, success or failure.

export type UpstreamStage = "signals" | "escalated" | "writer" | "chat-step"

export interface UpstreamLogLine {
  type: "upstream"
  requestId: string
  stage: UpstreamStage
  modelId: string
  outcome: "ok" | "error"
  status?: number
  latencyMs: number
  costUsd?: number
}

export function writeUpstreamLine(line: UpstreamLogLine, sink: LogSink = defaultSink): void {
  sink(JSON.stringify(line))
}

export interface WithCallLogOptions<T> {
  requestId: string
  stage: UpstreamStage
  modelId: string
  sink?: LogSink
  extractCost?: (result: T) => number | undefined
}

function httpStatusOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined
  const candidate = error as { statusCode?: unknown; status?: unknown }
  if (typeof candidate.statusCode === "number") return candidate.statusCode
  if (typeof candidate.status === "number") return candidate.status
  return undefined
}

export async function withCallLog<T>(
  options: WithCallLogOptions<T>,
  fn: () => Promise<T>,
): Promise<T> {
  const { requestId, stage, modelId, sink, extractCost } = options
  const startedAt = performance.now()
  const base = { type: "upstream" as const, requestId, stage, modelId }

  let result: T
  try {
    result = await fn()
  } catch (error) {
    const status = httpStatusOf(error)
    writeUpstreamLine(
      {
        ...base,
        outcome: "error",
        ...(status !== undefined && { status }),
        latencyMs: Math.round(performance.now() - startedAt),
      },
      sink,
    )
    throw error
  }

  const costUsd = extractCost?.(result)
  writeUpstreamLine(
    {
      ...base,
      outcome: "ok",
      latencyMs: Math.round(performance.now() - startedAt),
      ...(costUsd !== undefined && { costUsd }),
    },
    sink,
  )
  return result
}

/** OpenRouter cost reported in `providerMetadata.openrouter.usage.cost`, when present. */
export function openRouterCostOf(providerMetadata: unknown): number | undefined {
  const cost = (
    providerMetadata as { openrouter?: { usage?: { cost?: unknown } } } | undefined
  )?.openrouter?.usage?.cost
  return typeof cost === "number" ? cost : undefined
}

/**
 * Per-step logger for streamed calls, where `withCallLog` cannot wrap the whole
 * call. Logs at most one `upstream` line per model step: `end` on a finished
 * step, or `fail` on an error while a step is in flight.
 */
export function createStepCallLogger(options: {
  requestId: string
  stage: UpstreamStage
  modelId: string
  sink?: LogSink
}) {
  const { requestId, stage, modelId, sink } = options
  let pending = true // the first step is in flight before any onStepStart
  let startedAt = performance.now()
  const base = { type: "upstream" as const, requestId, stage, modelId }

  return {
    start(): void {
      pending = true
      startedAt = performance.now()
    },
    end(step: { providerMetadata?: unknown }): void {
      if (!pending) return
      pending = false
      const costUsd = openRouterCostOf(step.providerMetadata)
      writeUpstreamLine(
        {
          ...base,
          outcome: "ok",
          latencyMs: Math.round(performance.now() - startedAt),
          ...(costUsd !== undefined && { costUsd }),
        },
        sink,
      )
    },
    fail(error: unknown): void {
      if (!pending) return
      pending = false
      const status = httpStatusOf(error)
      writeUpstreamLine(
        {
          ...base,
          outcome: "error",
          ...(status !== undefined && { status }),
          latencyMs: Math.round(performance.now() - startedAt),
        },
        sink,
      )
    },
  }
}
