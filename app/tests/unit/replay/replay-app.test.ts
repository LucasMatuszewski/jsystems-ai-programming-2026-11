import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { replayAppResponse } from "../../helpers/replay-app"

const file = path.resolve(__dirname, "../../fixtures/app/cases/rule-return-45d.ndjson.json")
const recorded = (JSON.parse(fs.readFileSync(file, "utf8")) as { response: { body: string } }).response.body

describe("replayAppResponse", () => {
  it("serves the recorded status, content type and body", async () => {
    const res = replayAppResponse(file)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("application/x-ndjson")
    expect(await res.text()).toBe(recorded)
  })

  it("splits the bytes into the requested chunks and keeps the content", async () => {
    const res = replayAppResponse(file, { chunkSizes: [7, 13] })
    const reader = res.body!.getReader()
    const chunks: Uint8Array[] = []
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    expect(chunks.length).toBeGreaterThan(2)
    expect(chunks.slice(0, 3).map((c) => c.length)).toEqual([7, 13, 7])
    const joined = new TextDecoder().decode(Buffer.concat(chunks))
    expect(joined).toBe(recorded)
    expect(joined.split("\n").filter(Boolean).map((l) => JSON.parse(l).type).at(-1)).toBe("result")
  })
})
