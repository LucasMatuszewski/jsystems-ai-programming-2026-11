import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { createRequestId, logIncoming } from "@/server/ai/log/call-log"
import { withCallLog } from "@/server/ai/upstream"

const PROMPT_TEXT = "Klientka: zdjęcie pokazuje pęknięty ekran, proszę o wymianę na nowy model"
const UPSTREAM_ERROR_TEXT = "Upstream echoed: zdjęcie pęknięty ekran klientki"

function collect() {
  const lines: string[] = []
  const sink = (line: string) => {
    lines.push(line)
  }
  return { lines, sink }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("createRequestId", () => {
  it("returns distinct non-empty ids", () => {
    const a = createRequestId()
    const b = createRequestId()
    expect(a).toBeTruthy()
    expect(a).not.toBe(b)
  })
})

describe("logIncoming", () => {
  it("writes exactly one incoming line with requestId, route and status", () => {
    const { lines, sink } = collect()
    logIncoming({ requestId: "req-1", route: "/api/chat", status: 200, sink })
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0] as string)).toEqual({
      type: "incoming",
      requestId: "req-1",
      route: "/api/chat",
      status: 200,
    })
  })
})

describe("withCallLog", () => {
  it("logs exactly one ok line on success, returns the result and reports cost from extractCost", async () => {
    const { lines, sink } = collect()
    const result = await withCallLog(
      {
        requestId: "req-2",
        stage: "chat-step",
        modelId: "openai/gpt-6-luna",
        sink,
        extractCost: (r: { text: string; cost: number }) => r.cost,
      },
      async () => ({ text: PROMPT_TEXT, cost: 0.0042 }),
    )
    expect(result.text).toBe(PROMPT_TEXT)
    expect(lines).toHaveLength(1)
    const line = JSON.parse(lines[0] as string)
    expect(line).toMatchObject({
      type: "upstream",
      requestId: "req-2",
      stage: "chat-step",
      modelId: "openai/gpt-6-luna",
      outcome: "ok",
      costUsd: 0.0042,
    })
    expect(typeof line.latencyMs).toBe("number")
    expect(line.latencyMs).toBeGreaterThanOrEqual(0)
    expect(line).not.toHaveProperty("status")
    expect(lines[0]).not.toContain(PROMPT_TEXT)
  })

  it("omits costUsd when no cost is reported", async () => {
    const { lines, sink } = collect()
    await withCallLog(
      { requestId: "req-3", stage: "signals", modelId: "openai/gpt-6-luna-decisions", sink },
      async () => "ok",
    )
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0] as string)).not.toHaveProperty("costUsd")
  })

  it("logs exactly one error line with HTTP status, rethrows the same error and leaks no input text", async () => {
    const { lines, sink } = collect()
    const upstreamError = Object.assign(new Error(UPSTREAM_ERROR_TEXT), { statusCode: 502 })
    const call = withCallLog(
      { requestId: "req-4", stage: "escalated", modelId: "openai/gpt-6-luna", sink },
      async () => {
        throw upstreamError
      },
    )
    await expect(call).rejects.toBe(upstreamError)
    expect(lines).toHaveLength(1)
    const line = JSON.parse(lines[0] as string)
    expect(line).toMatchObject({
      type: "upstream",
      requestId: "req-4",
      stage: "escalated",
      outcome: "error",
      status: 502,
    })
    expect(typeof line.latencyMs).toBe("number")
    expect(lines[0]).not.toContain(UPSTREAM_ERROR_TEXT)
    expect(lines[0]).not.toContain("pęknięty")
  })

  it("logs an error line without status when the error carries none", async () => {
    const { lines, sink } = collect()
    await expect(
      withCallLog(
        { requestId: "req-5", stage: "writer", modelId: "openai/gpt-6-luna", sink },
        async () => {
          throw new Error("network down")
        },
      ),
    ).rejects.toThrow("network down")
    expect(lines).toHaveLength(1)
    const line = JSON.parse(lines[0] as string)
    expect(line.outcome).toBe("error")
    expect(line).not.toHaveProperty("status")
  })

  it("uses console.info with the [hsdc] prefix when no sink is injected", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {})
    await withCallLog(
      { requestId: "req-6", stage: "writer", modelId: "openai/gpt-6-luna" },
      async () => 1,
    )
    expect(infoSpy).toHaveBeenCalledTimes(1)
    const printed = String(infoSpy.mock.calls[0]?.[0])
    expect(printed.startsWith("[hsdc] ")).toBe(true)
    expect(printed).toContain('"type":"upstream"')
  })
})
