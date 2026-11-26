import "server-only"

import path from "node:path"
import { z } from "zod"

// ADR-000 section 7: environment variables. Defaults apply when a variable is
// unset or empty. Error messages name variables only, never their values.

export class EnvError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EnvError"
  }
}

export type EnvSource = Record<string, string | undefined>
export type ReasoningEffort = "low" | "medium" | "high"

export interface AppEnv {
  openrouterApiKey: string
  llmModel: string
  decisionModel: string
  fastPathEnabled: boolean
  fastPathThreshold: number
  reasoning: { decision: ReasoningEffort; writer: ReasoningEffort; chat: ReasoningEffort }
  policiesDir: string
  decisionLogPath: string
  appUrl: string
  appTitle: string
}

const EFFORTS = ["low", "medium", "high"] as const

// Empty strings count as unset so `.env.example` placeholders fall back to defaults.
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema)

const EnvSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(1),
  LLM_MODEL: optional(z.string().min(1).default("openai/gpt-6-luna")),
  DECISION_MODEL: optional(z.string().min(1).default("openai/gpt-6-luna-decisions")),
  FAST_PATH_ENABLED: z.string().optional().transform((value) => value === undefined || value === "" || value === "true"),
  FAST_PATH_THRESHOLD: optional(z.coerce.number().min(0).max(1).default(0.8)),
  LLM_REASONING_DECISION: optional(z.enum(EFFORTS).default("high")),
  LLM_REASONING_WRITER: optional(z.enum(EFFORTS).default("low")),
  LLM_REASONING_CHAT: optional(z.enum(EFFORTS).default("medium")),
  POLICIES_DIR: optional(z.string().min(1).default("../docs/policies")),
  // Empty string is allowed on purpose: it disables the decision log.
  DECISION_LOG_PATH: z.string().default(".data/decision-log.jsonl"),
  APP_URL: optional(z.string().min(1).default("http://localhost:3000")),
  APP_TITLE: optional(z.string().min(1).default("Hardware Service Decision Copilot")),
})

let cached: AppEnv | undefined

function parse(source: EnvSource): AppEnv {
  const result = EnvSchema.safeParse(source)
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))]
    const hasKeyIssue = names.includes("OPENROUTER_API_KEY")
    const detail = hasKeyIssue
      ? "OPENROUTER_API_KEY is required (set it in the repository-root .env or app/.env.local)"
      : `invalid value for ${names.join(", ")}`
    throw new EnvError(`Environment validation failed: ${detail}.`)
  }
  const data = result.data
  return {
    openrouterApiKey: data.OPENROUTER_API_KEY,
    llmModel: data.LLM_MODEL as string,
    decisionModel: data.DECISION_MODEL as string,
    fastPathEnabled: data.FAST_PATH_ENABLED,
    fastPathThreshold: data.FAST_PATH_THRESHOLD as number,
    reasoning: {
      decision: data.LLM_REASONING_DECISION as ReasoningEffort,
      writer: data.LLM_REASONING_WRITER as ReasoningEffort,
      chat: data.LLM_REASONING_CHAT as ReasoningEffort,
    },
    // Resolved from the app working directory (the Next.js project root).
    policiesDir: path.resolve(process.cwd(), data.POLICIES_DIR as string),
    decisionLogPath: data.DECISION_LOG_PATH,
    appUrl: data.APP_URL as string,
    appTitle: data.APP_TITLE as string,
  }
}

/**
 * Validated environment. Without an argument it reads `process.env` once and
 * caches the result. Tests pass a `source` object and bypass the cache.
 */
export function getEnv(source?: EnvSource): AppEnv {
  if (source) return parse(source)
  cached ??= parse(process.env)
  return cached
}
