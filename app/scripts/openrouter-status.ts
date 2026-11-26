import "./load-env"

// Provider limit pre-check (ADR-006 §3.4). Never prints the key.
const BASE = "https://openrouter.ai/api/v1"
const key = process.env.OPENROUTER_API_KEY

if (!key) {
  console.error("OPENROUTER_API_KEY is not set (root .env or app/.env.local).")
  process.exit(1)
}

type KeyData = {
  label?: string
  limit: number | null
  limit_remaining: number | null
  limit_reset: string | null
  usage: number
  usage_daily: number
  is_free_tier: boolean
  rate_limit?: { requests: number; interval: string }
  effective_budget?: { remaining_usd: number; limit_usd: number } | null
  free_model_daily_requests?: { used: number; limit: number; remaining: number }
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!response.ok) {
    throw new Error(`GET ${path} failed: HTTP ${response.status}`)
  }
  return (await response.json()) as T
}

const usd = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "unlimited"
    : `USD ${value.toFixed(4)}`

const { data } = await get<{ data: KeyData }>("/key")
console.log("OpenRouter key status")
console.log(`  label            : ${data.label ? "(set)" : "(none)"}`)
console.log(`  credit limit     : ${usd(data.limit)}`)
console.log(`  usage (all time) : ${usd(data.usage)}`)
console.log(`  usage (today)    : ${usd(data.usage_daily)}`)
console.log(`  remaining credit : ${usd(data.limit_remaining)}`)
console.log(`  limit reset      : ${data.limit_reset ?? "never"}`)
console.log(`  free-tier flag   : ${data.is_free_tier}`)
if (data.effective_budget) {
  console.log(
    `  effective budget : ${usd(data.effective_budget.remaining_usd)} left of ${usd(data.effective_budget.limit_usd)}`
  )
}
if (data.free_model_daily_requests) {
  const f = data.free_model_daily_requests
  console.log(`  free-model reqs  : ${f.used}/${f.limit} today`)
}
console.log(
  `  rate limit       : ${
    data.rate_limit
      ? data.rate_limit.requests < 0
        ? `no request cap (deprecated field, interval ${data.rate_limit.interval})`
        : `${data.rate_limit.requests} requests / ${data.rate_limit.interval} (deprecated field)`
      : "not reported by the key endpoint"
  }`
)

const { data: models } = await get<{ data: { id: string }[] }>("/models")
const ids = new Set(models.map((model) => model.id))
const wanted = [
  ["LLM_MODEL", process.env.LLM_MODEL ?? "openai/gpt-6-luna"],
  [
    "DECISION_MODEL",
    process.env.DECISION_MODEL ?? "openai/gpt-6-luna-decisions",
  ],
] as const
console.log(`Models (${ids.size} listed by OpenRouter)`)
for (const [name, id] of wanted) {
  let state = ids.has(id) ? "listed in /models" : "NOT listed in /models"
  if (!ids.has(id)) {
    // Alpha/Decisions models may be absent from /models; check their endpoints.
    try {
      const { data: model } = await get<{
        data: { endpoints?: { status?: number }[] }
      }>(`/models/${id}/endpoints`)
      const count = model.endpoints?.length ?? 0
      state += count > 0 ? `, ${count} endpoint(s) available` : ", no endpoints"
    } catch (error) {
      state += `, endpoint lookup failed (${(error as Error).message})`
    }
  }
  console.log(`  ${name.padEnd(15)}: ${id} -> ${state}`)
}
