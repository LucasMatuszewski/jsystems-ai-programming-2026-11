import "server-only"

import { randomUUID } from "node:crypto"

// ADR-006 3.2: one line per incoming request and per upstream call. Lines never
// contain prompts, customer text, image data or API keys.

export type LogSink = (line: string) => void

export const defaultSink: LogSink = (line) => {
  console.info(`[hsdc] ${line}`)
}

export function createRequestId(): string {
  return randomUUID()
}

export function logIncoming({
  requestId,
  route,
  status,
  sink = defaultSink,
}: {
  requestId: string
  route: string
  status: number
  sink?: LogSink
}): void {
  sink(JSON.stringify({ type: "incoming", requestId, route, status }))
}
