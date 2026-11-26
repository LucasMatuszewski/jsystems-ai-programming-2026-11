# Luna Decisions recordings: status

No successful recording exists. Two real calls with the project key (2026-11-26, `openai/gpt-6-luna-decisions`, return/laptop-2) both returned HTTP 401 from OpenRouter, upstream message "The OpenAI account associated with this API key has been deactivated" (`code: account_deactivated`, header `x-openrouter-error-origin: client`). Recorded verbatim in `../errors/decisions-upstream-account-deactivated-1.json` and `-2.json`. `pnpm openrouter:status` shows the model has 1 endpoint listed. Recording is blocked until the account/key routing is fixed.

## Facts confirmed from the installed SDK source (not yet from a success capture)
- The AI SDK 7.0.118 API is `experimental_evaluate` with `provider.evaluationModel(id)`, not `experimental_decide` / `decisionModel` as ADR-001 states.
- Boolean questions are sent as OpenRouter type `noul` (answer `{type:"noul", noul: p}`); AI SDK `choice` and `score` keep their names. `confidence` is a field on choice and score answers only; the SDK exposes it in `providerMetadata.openrouter.answers[key].confidence`.
- Images go in the top-level `state` array as `{type:"image_url", image_url:{url:"data:image/jpeg;base64,..."}}` next to plain-string text. The request body in the 401 recordings shows this shape (image replaced by a placeholder).
- Cost: `usage.cost` in the response, surfaced as `providerMetadata.openrouter.usage.cost`.
- Latency of the failed call: about 0.6 s.
- Normalized-value table and normalizer: not produced (needs a successful capture).
