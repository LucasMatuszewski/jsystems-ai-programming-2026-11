import fs from "node:fs"

// ADR-006 3.1: serves a recorded own-endpoint response (tests/fixtures/app/**) as a Response.
// `chunkSizes` splits the recorded UTF-8 bytes into chunks of those byte sizes (cycled
// when shorter than the body), so NDJSON readers can be tested with lines cut mid-way.

export type AppRecording = {
  meta: Record<string, unknown>
  response: { status: number; contentType: string | null; body: string }
}

export function replayAppResponse(fixturePath: string, options: { chunkSizes?: number[] } = {}): Response {
  const { response } = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as AppRecording
  const bytes = new TextEncoder().encode(response.body)
  const sizes = options.chunkSizes?.filter((n) => n > 0) ?? []
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (sizes.length === 0) {
        controller.enqueue(bytes)
      } else {
        let offset = 0
        for (let i = 0; offset < bytes.length; i++) {
          const size = sizes[i % sizes.length] as number
          controller.enqueue(bytes.slice(offset, offset + size))
          offset += size
        }
      }
      controller.close()
    },
  })
  return new Response(stream, {
    status: response.status,
    headers: response.contentType ? { "content-type": response.contentType } : {},
  })
}
