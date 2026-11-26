import path from "node:path"
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { EnvError, getEnv } from "@/server/env"

const KEY = "sk-or-v1-synthetic-test-key-0001"
const base = { OPENROUTER_API_KEY: KEY }

describe("getEnv defaults (ADR-000 section 7)", () => {
  it("applies every documented default", () => {
    const env = getEnv({ ...base })
    expect(env.openrouterApiKey).toBe(KEY)
    expect(env.llmModel).toBe("openai/gpt-6-luna")
    expect(env.decisionModel).toBe("openai/gpt-6-luna-decisions")
    expect(env.fastPathEnabled).toBe(false)
    expect(env.fastPathThreshold).toBe(0.8)
    expect(env.reasoning).toEqual({ decision: "high", writer: "low", chat: "medium" })
    expect(env.policiesDir).toBe(path.resolve(process.cwd(), "../docs/policies"))
    expect(env.decisionLogPath).toBe(".data/decision-log.jsonl")
    expect(env.appUrl).toBe("http://localhost:3000")
    expect(env.appTitle).toBe("Hardware Service Decision Copilot")
  })

  it("treats FAST_PATH_ENABLED=true as enabled and any other value as disabled", () => {
    expect(getEnv({ ...base, FAST_PATH_ENABLED: "true" }).fastPathEnabled).toBe(true)
    expect(getEnv({ ...base, FAST_PATH_ENABLED: "false" }).fastPathEnabled).toBe(false)
  })

  it("treats empty optional values as unset", () => {
    const env = getEnv({ ...base, FAST_PATH_THRESHOLD: "", LLM_REASONING_CHAT: "" })
    expect(env.fastPathThreshold).toBe(0.8)
    expect(env.reasoning.chat).toBe("medium")
  })

  it("accepts values from the environment source", () => {
    const env = getEnv({
      ...base,
      LLM_MODEL: "openai/synthetic-chat-model",
      FAST_PATH_THRESHOLD: "0.65",
      LLM_REASONING_DECISION: "low",
      APP_TITLE: "Synthetic Title",
    })
    expect(env.llmModel).toBe("openai/synthetic-chat-model")
    expect(env.fastPathThreshold).toBe(0.65)
    expect(env.reasoning.decision).toBe("low")
    expect(env.appTitle).toBe("Synthetic Title")
  })
})

describe("getEnv validation", () => {
  it("throws EnvError naming OPENROUTER_API_KEY when it is missing, without echoing other values", () => {
    const secretLike = "openai/synthetic-model-marker-7731"
    let caught: unknown
    try {
      getEnv({ LLM_MODEL: secretLike })
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(EnvError)
    const message = (caught as Error).message
    expect(message).toContain("OPENROUTER_API_KEY")
    expect(message).not.toContain(secretLike)
  })

  it("throws EnvError when OPENROUTER_API_KEY is empty", () => {
    expect(() => getEnv({ OPENROUTER_API_KEY: "" })).toThrow(EnvError)
  })

  it("rejects an out-of-range FAST_PATH_THRESHOLD and names the variable without echoing it", () => {
    let caught: unknown
    try {
      getEnv({ ...base, FAST_PATH_THRESHOLD: "1.5" })
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(EnvError)
    expect((caught as Error).message).toContain("FAST_PATH_THRESHOLD")
    expect((caught as Error).message).not.toContain("1.5")
    expect((caught as Error).message).not.toContain(KEY)
  })

  it("rejects a non-numeric FAST_PATH_THRESHOLD", () => {
    expect(() => getEnv({ ...base, FAST_PATH_THRESHOLD: "high" })).toThrow(/FAST_PATH_THRESHOLD/)
  })

  it("rejects an unknown reasoning effort", () => {
    expect(() => getEnv({ ...base, LLM_REASONING_WRITER: "extreme" })).toThrow(/LLM_REASONING_WRITER/)
  })

  it("empty DECISION_LOG_PATH disables the decision log", () => {
    expect(getEnv({ ...base, DECISION_LOG_PATH: "" }).decisionLogPath).toBe("")
  })
})
