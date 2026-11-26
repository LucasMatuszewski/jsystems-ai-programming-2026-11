import path from "node:path"
import { describe, expect, it } from "vitest"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { experimental_evaluate } from "ai"
import { loadFixture, replayFetch } from "../../helpers/replay-fetch"
import {
  buildSignalQuestions,
  buildSignalStateText,
} from "@/server/ai/signals/questions"

const dir = path.resolve(__dirname, "../../fixtures/openrouter/errors")
const f401 = path.join(dir, "decisions-401.json")
const fConn = path.join(dir, "decisions-connection-failure.json")

describe("replayFetch", () => {
  it("serves the recorded status, headers and body", async () => {
    const fx = loadFixture(f401)
    const res = await replayFetch(fx)("https://openrouter.ai/api/alpha/decisions")
    expect(res.status).toBe(401)
    expect(res.headers.get("content-type")).toContain("application/json")
    expect(await res.text()).toBe(fx.exchanges[0]!.response!.body)
  })

  it("fails when more requests arrive than were recorded", async () => {
    const f = replayFetch(f401)
    await f("https://openrouter.ai/api/alpha/decisions")
    await expect(f("https://openrouter.ai/api/alpha/decisions")).rejects.toThrow(
      /unexpected request #2/
    )
  })

  it("throws the recorded network error", async () => {
    const f = replayFetch(fConn)
    await expect(f("http://127.0.0.1:9/api/alpha/decisions")).rejects.toThrow()
  })

  it("drives the real SDK through experimental_evaluate (401 recording)", async () => {
    const provider = createOpenRouter({ apiKey: "replay", fetch: replayFetch(f401) })
    const questions = buildSignalQuestions("return", false)
    await expect(
      experimental_evaluate({
        model: provider.evaluationModel("openai/gpt-6-luna-decisions"),
        state: [
          buildSignalStateText({ caseType: "return", category: "laptop", model: "x", reason: "" }),
        ],
        questions,
        maxRetries: 0,
      })
    ).rejects.toMatchObject({ name: "AI_APICallError", statusCode: 401 })
  })
})
