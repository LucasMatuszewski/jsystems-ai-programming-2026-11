import path from "node:path"
import { fileURLToPath } from "node:url"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { getDecisionSignals, type SignalCaseInput } from "@/server/ai/signals/get-signals"
import { replayFetch } from "../../helpers/replay-fetch"

// ADR-006 3.1: the endpoint double replays real recordings only. Each test
// builds a fresh replay so the single recorded exchange is served once.

const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.resolve(here, "../../fixtures/openrouter/errors")

const CASE: SignalCaseInput = {
  caseType: "return",
  category: "laptop",
  model: "Lenovo ThinkPad E14",
  reason: "",
}
const IMAGE = { buffer: Buffer.from("synthetic-image-bytes"), mediaType: "image/webp" }
const REASON_CODES = ["auth", "network", "upstream", "refusal", "invalid_answer", "timeout"]

function setup(fixture: string) {
  const provider = createOpenRouter({
    fetch: replayFetch(path.join(FIXTURES, fixture)),
    apiKey: "test",
  })
  const lines: string[] = []
  const call = () =>
    getDecisionSignals(CASE, IMAGE, {
      provider,
      modelId: "openai/gpt-6-luna-decisions",
      requestId: "req-test-1",
      callLogSink: (line) => lines.push(line),
    })
  return { call, lines }
}

describe("getDecisionSignals on recorded failures (fail-closed)", () => {
  it("HTTP 401 recording -> unavailable/auth, one signals error line", async () => {
    const { call, lines } = setup("decisions-401.json")
    const out = await call()
    expect(out.status).toBe("unavailable")
    expect(out.reason).toBe("auth")
    expect(out.answers).toEqual({})
    expect(out.refusals).toEqual([])
    expect(out.cost).toBeNull()
    expect(out.durationMs).toBeGreaterThanOrEqual(0)
    expect(lines).toHaveLength(1)
    const line = JSON.parse(lines[0]!)
    expect(line).toMatchObject({
      type: "upstream",
      requestId: "req-test-1",
      stage: "signals",
      modelId: "openai/gpt-6-luna-decisions",
      outcome: "error",
      status: 401,
    })
  })

  it("connection failure recording -> unavailable/network, one signals error line", async () => {
    const { call, lines } = setup("decisions-connection-failure.json")
    const out = await call()
    expect(out.status).toBe("unavailable")
    expect(out.reason).toBe("network")
    expect(out.answers).toEqual({})
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0]!)).toMatchObject({ stage: "signals", outcome: "error" })
  })

  it("upstream account_deactivated recording -> unavailable/auth (HTTP 401), one signals error line", async () => {
    // Documented choice: the recording is HTTP 401 with origin `client`, so the
    // status-based rule maps it to `auth`, not `upstream`.
    const { call, lines } = setup("decisions-upstream-account-deactivated-1.json")
    const out = await call()
    expect(out.status).toBe("unavailable")
    expect(out.reason).toBe("auth")
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0]!)).toMatchObject({ stage: "signals", outcome: "error", status: 401 })
  })

  it.each([
    "decisions-401.json",
    "decisions-connection-failure.json",
    "decisions-upstream-account-deactivated-1.json",
  ])("%s: reason is a fixed code and never carries provider text", async (fixture) => {
    const { call } = setup(fixture)
    const out = await call()
    expect(REASON_CODES).toContain(out.reason)
    expect(JSON.stringify(out)).not.toMatch(/deactivated|account|fetch failed|Unauthorized|Cannot connect/i)
  })
})

describe("getDecisionSignals success path", () => {
  // TODO(ADR-001 A1): no successful decisions recording exists yet. Record one with
  // `pnpm record:openrouter decisions` once the endpoint works, then replace this todo.
  it.todo("success: missing fixture tests/fixtures/openrouter/decisions/*-success.json (no success recording, ADR-001 A1)")
})
