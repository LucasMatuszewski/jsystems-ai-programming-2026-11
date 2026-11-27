import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { replayAppResponse } from "../../helpers/replay-app"

// T24: proves the recorded /api/chat exchanges (tests/fixtures/app/chat) replay and parse as SSE (used by T25).
const dir = path.resolve(__dirname, "../../fixtures/app/chat")

describe("recorded /api/chat responses", () => {
  it("replays plain-return.sse as a parseable UI message stream", async () => {
    const res = replayAppResponse(path.join(dir, "plain-return.sse.json"), { chunkSizes: [64] })
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/event-stream")
    const chunks = (await res.text())
      .split("\n\n")
      .map((b) => b.replace(/^data: /, "").trim())
      .filter((d) => d && d !== "[DONE]")
      .map((d) => JSON.parse(d) as { type: string })
    expect(chunks.at(0)?.type).toBe("start")
    expect(chunks.some((c) => c.type === "text-delta")).toBe(true)
    expect(chunks.some((c) => c.type.startsWith("reasoning"))).toBe(false)
    expect(fs.existsSync(path.join(dir, "validation-400.json"))).toBe(true)
  })
})
