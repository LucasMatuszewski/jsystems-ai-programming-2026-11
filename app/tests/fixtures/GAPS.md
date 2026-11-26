# Uncaptured cases (ADR-006 3.1)

Not provoked, so there is no recording. They are covered only through the generic error path exercised by the real 401 and connection-failure recordings.

| Case | Reason |
|---|---|
| OpenRouter 402 (insufficient credit) | not provoked per ADR-006 §3.1 |
| OpenRouter 429 (rate limit) | not provoked per ADR-006 §3.1 |
| OpenRouter 503 / upstream outage | not provoked per ADR-006 §3.1 |
| Mid-stream errors | not provoked per ADR-006 §3.1 |
| Own endpoint 413 (file > 10 MB) | no real photo exceeds 10 MB and generated files are forbidden |
| Successful Luna Decisions answers (4 cases) | CAPTURED 2026-11-26 (endpoint recovered after the temporary 401), see `openrouter/decisions/NOTES.md` |
| Decisions refusal (`type: "refusal"`) | attempted once (harmless personal-name question), the model answered normally; not provoked further per ADR-006 §3.1 |
| Fast-route writer recording (`writer-fast-*`) | not needed: none of the 4 real signal recordings is fast-path eligible, so no fast acceptance was produced |

## LLM recordings (T13)

| Case | Status |
|---|---|
| Reasoning chunks in the stream (TAC-001-07) | CAPTURED, not a gap: `llm/chat-tool-update.json` has 298 `reasoning-delta` UI chunks (recorded with `sendReasoning: true`) and the HTTP SSE carries reasoning deltas. `toUIMessageStream` in `ai` 7.0.118 defaults `sendReasoning` to **true** (contradicts the AGENTS.md cheat-sheet), so the chat route (T23) must pass `sendReasoning: false` explicitly. The replay test asserts no `reasoning*` chunks with it off. `chat-plain.json` (plain answer) has no reasoning chunks. |
| Escalated/writer reasoning | `escalated-return-laptop-2.json` has `reasoningText` (about 1000 chars) in `sdkResult`; the others returned none. Not streamed to clients. |
| `update_recommendation` tool call | OBTAINED on the first message (no retry needed): `chat-tool-update.json`, 2 steps. |
| Provider-reported cost | OpenRouter returned `"cost": 0` in `usage` for all LLM calls (all-time key usage still moved by about USD 0.0003 for 8 calls), so `meta.costUsd` is 0 and not reliable; use the key usage delta from `pnpm openrouter:status`. |
| Writer with `signalsSummary` present | not recorded: the escalated/writer recordings were made before the decisions endpoint recovered, so the writer got "Signals summary: unavailable". |
| Chat turn with an assistant message that already has a tool part (second user turn) | not recorded; the converter is covered by a unit test only (text conversion of a synthetic tool part). |
| Chat 401 | `errors/chat-401.json` records the HTTP 401 `User not found` and the SDK stream error. |
