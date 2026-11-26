import "server-only"

import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { getEnv } from "@/server/env"

export interface CreateProviderOptions {
  /** Injected `fetch` (recording or replay doubles). */
  fetch?: typeof fetch
  /** Overrides the key from the environment (recording the invalid-key case only). */
  apiKey?: string
}

/** The only place that builds the OpenRouter provider (ADR-001 3.1). */
export function createProvider(options: CreateProviderOptions = {}) {
  const env = getEnv()
  return createOpenRouter({
    apiKey: options.apiKey ?? env.openrouterApiKey,
    ...(options.fetch ? { fetch: options.fetch } : {}),
    headers: {
      "HTTP-Referer": env.appUrl,
      "X-OpenRouter-Title": env.appTitle,
    },
  })
}
