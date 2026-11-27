import path from "node:path"
import { replayAppResponse } from "@/tests/helpers/replay-app"

const encoder = new TextEncoder()

/**
 * A recorded /api/cases response that releases one NDJSON line per `step()` call,
 * so tests can assert the progress text between events (ADR-006 3.1: recorded bytes only).
 */
export async function steppedRecording(fixtureName: string) {
  const file = path.resolve(process.cwd(), "tests/fixtures/app/cases", fixtureName)
  const template = replayAppResponse(file)
  const lines = (await template.text()).split(/(?<=\n)/).filter((line) => line.length > 0)

  let index = 0
  const releases: Array<() => void> = []
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      return new Promise<void>((resolve) => {
        releases.push(() => {
          const line = lines[index++]
          if (line === undefined) controller.close()
          else controller.enqueue(encoder.encode(line))
          resolve()
        })
      })
    },
  })

  const response = new Response(stream, { status: template.status, headers: template.headers })
  return {
    response,
    /** Releases the next line of the recording. */
    step: async () => {
      while (releases.length === 0) await new Promise((resolve) => setTimeout(resolve, 0))
      releases.shift()?.()
    },
  }
}
