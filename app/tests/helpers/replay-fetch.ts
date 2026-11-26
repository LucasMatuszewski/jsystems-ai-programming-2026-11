import fs from "node:fs"

// ADR-006 3.1: serves recorded OpenRouter exchanges, in order, as a `fetch`.

export type RecordedExchange = {
  request: { method: string; url: string; bodySummary?: unknown }
  response?: {
    status: number
    headers: Record<string, string>
    body: string
  }
  networkError?: { name: string; message: string; cause?: string }
}

export type Fixture = {
  meta: Record<string, unknown>
  exchanges: RecordedExchange[]
  sdkResult?: unknown
  error?: { name: string; message: string }
}

export function loadFixture(path: string): Fixture {
  return JSON.parse(fs.readFileSync(path, "utf8")) as Fixture
}

/** Serves one fixture, or several fixtures' exchanges concatenated in the given order. */
export function replayFetch(source: string | Fixture | Array<string | Fixture>): typeof fetch {
  const fixture: Fixture = Array.isArray(source)
    ? {
        meta: {},
        exchanges: source.flatMap(
          (item) => (typeof item === "string" ? loadFixture(item) : item).exchanges
        ),
      }
    : typeof source === "string"
      ? loadFixture(source)
      : source
  let index = 0
  return (async (input: RequestInfo | URL) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    const exchange = fixture.exchanges[index]
    if (!exchange) {
      throw new Error(
        `replayFetch: unexpected request #${index + 1} to ${url}; only ${fixture.exchanges.length} recorded`
      )
    }
    index += 1
    if (exchange.networkError) {
      const err = new TypeError(exchange.networkError.message)
      err.name = exchange.networkError.name
      if (exchange.networkError.cause) {
        ;(err as { cause?: unknown }).cause = new Error(
          exchange.networkError.cause
        )
      }
      throw err
    }
    const r = exchange.response!
    return new Response(r.body, { status: r.status, headers: r.headers })
  }) as typeof fetch
}
