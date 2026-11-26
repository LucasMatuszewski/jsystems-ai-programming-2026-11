import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { readNdjson } from "@/lib/ndjson"
import { replayAppResponse } from "@/tests/helpers/replay-app"

const fixture = fileURLToPath(
  new URL("../../fixtures/app/cases/escalated-return-laptop-2.ndjson.json", import.meta.url),
)

async function recordedBody(): Promise<string> {
  return replayAppResponse(fixture).text()
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<unknown[]> {
  const events: unknown[] = []
  for await (const event of readNdjson(stream)) events.push(event)
  return events
}

function lineByLine(body: string): unknown[] {
  return body
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown)
}

describe("readNdjson", () => {
  it("parses the recorded /api/cases body in one chunk", async () => {
    const body = await recordedBody()
    const events = await collect(replayAppResponse(fixture).body!)
    expect(events).toEqual(lineByLine(body))
    expect(events).toHaveLength(3)
  })

  it.each([1, 2, 3, 5, 7, 13, 64, 1000])("handles chunks of %i bytes", async (size) => {
    const body = await recordedBody()
    const events = await collect(replayAppResponse(fixture, { chunkSizes: [size] }).body!)
    expect(events).toEqual(lineByLine(body))
  })

  it("splits lines right after the lead byte of multi-byte Polish characters", async () => {
    const body = await recordedBody()
    const bytes = new TextEncoder().encode(body)
    const leadOffsets: number[] = []
    for (let i = 0; i < bytes.length && leadOffsets.length < 25; i++) {
      if ((bytes[i] as number) >= 0xc0) leadOffsets.push(i)
    }
    expect(leadOffsets.length).toBeGreaterThan(0)
    for (const offset of leadOffsets) {
      // one chunk ends inside the multi-byte sequence, the rest follows
      const events = await collect(
        replayAppResponse(fixture, { chunkSizes: [offset + 1, bytes.length] }).body!,
      )
      expect(events).toEqual(lineByLine(body))
    }
  })

  it("ignores blank lines between events", async () => {
    const body = await recordedBody()
    const spaced = body.replace(/\n/g, "\n\n")
    const stream = new Response(spaced).body!
    expect(await collect(stream)).toEqual(lineByLine(body))
  })

  it("parses a last event that has no trailing newline", async () => {
    const body = await recordedBody()
    const stream = new Response(body.trimEnd()).body!
    expect(await collect(stream)).toEqual(lineByLine(body))
  })

  it("throws on a line that is not JSON", async () => {
    const stream = new Response("not-json\n").body!
    await expect(collect(stream)).rejects.toThrow(SyntaxError)
  })
})
