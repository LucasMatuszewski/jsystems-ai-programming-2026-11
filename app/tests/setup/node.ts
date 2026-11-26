// TAC-02: unit and integration tests never reach OpenRouter. Endpoint doubles
// are replays of recorded real responses (ADR-006), installed per test.
const realFetch = globalThis.fetch

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  if (new URL(url, "http://localhost").hostname.endsWith("openrouter.ai")) {
    throw new Error(
      `Network call to OpenRouter blocked in unit/integration tests: ${url}`
    )
  }
  return realFetch(input, init)
}) as typeof fetch
