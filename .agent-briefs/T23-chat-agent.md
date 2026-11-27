# Brief T23 — Chat agent with update_recommendation + /api/chat

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read `app/AGENTS.md`. Targeted tests: `pnpm exec vitest run <paths>`.

## Goal
Replace the template chat route with the case chat agent.
- `app/server/ai/chat/build-chat-stream.ts`: `buildChatStream(body: ChatRequest, deps?: { provider?, env?, now?, requestId?, callLogSink?, abortSignal? }): Promise<Response>`:
  - Load the policy for `caseContext.form.caseType` (`loadPolicy` in `app/server/ai/logic/policy.ts`, never from the client).
  - Use `buildChatCall` from `app/server/ai/calls/chat.ts` (T13; reuse it unchanged so the recordings match) with effort `env.reasoning.chat` and the `update_recommendation` tool. The tool is server-executed: its input schema is `updateRecommendationToolSchema` from `calls/chat.ts`. Its execute applies `applyGuards` (enum, rule IDs exist in the case-type policy, R-2.4 with `caseContext.daysSincePurchase`) and returns `UpdateRecommendationOutput` `{ previousDecision: caseContext.currentDecision.decision, newDecision, reason, ruleRefs, updatedAt: now().toISOString() }`. On a guard violation it throws, so the tool part ends in `output-error`, which the UI ignores (no card).
  - At most 1 tool call per turn: `stopWhen` 2 steps, as set in `buildChatCall`.
  - Return `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream, sendReasoning: false, onError: () => "chat_failed" }) })`. Verify the exact AI SDK 7.0.118 API in `node_modules/ai` (T13 found that `sendReasoning` defaults to TRUE, so set it to false explicitly). TAC-001-07: no reasoning parts reach the client.
  - Call log: one `upstream` line per model step with stage `chat-step` (reuse `createStepCallLogger` from `app/server/ai/upstream.ts`).
- `app/app/api/chat/route.ts`: `maxDuration = 90`, `runtime = "nodejs"`. Steps:
  1. `logIncoming`.
  2. Body size > 512 KB returns 413 `{code:"file_too_large"}`.
  3. JSON parse, then `ChatRequestSchema` (≤ 60 messages, last message from the user with 1–2000 chars), then `validateUIMessages` with the data schema for `decision` and the tool schema. Any failure returns 400 `{code:"validation_failed"}`.
  4. A missing env key returns 500 `{code:"server_misconfigured"}`.
  5. Combine the abort signals: `AbortSignal.any([request.signal, AbortSignal.timeout(60_000)])`.
  The route never accepts policy text or prompts from the client.
- Fix the `app/AGENTS.md` cheat-sheet line about reasoning: it must say that `sendReasoning` defaults to true in ai 7.0.118, so we pass `false`.

Sources: ADR-001 §3.5, §3.8, §4.6, TAC-001-04/07; ADR-002 §5 `/api/chat`, §8; PRD Chat AC-32–AC-35, AC-42–AC-43; ADR-006 §3.2.

## Tests (first, red, then green) `app/tests/integration/api-chat/*.test.ts`
Use the REAL recordings in `app/tests/fixtures/openrouter/llm/chat-plain.json`, `chat-tool-update.json` and `errors/chat-401.json`, via `replayFetch` (`app/tests/helpers/replay-fetch.ts`) in `createOpenRouter({ apiKey:"test", fetch })`. Build the request bodies exactly as the recordings' `meta` describes (case context + messages). Assert:
- plain: SSE with text deltas, no `reasoning*` chunks, 1 chat-step log line;
- tool: a `tool-update_recommendation` output-available chunk with previous/new decisions, then text, and 2 chat-step lines;
- guard: a derived variant of `chat-tool-update` where the tool input has ruleRefs ["R-99"] (name the base) gives a tool output-error and no output-available;
- R-2.4: a derived variant for a return of ≤ 14 days with newDecision Odrzucenie gives Weryfikacja ręczna in the output (TAC-001-04);
- 401: the stream carries an error chunk with the text `chat_failed` and no "User not found" or provider text;
- validation: 61 messages, 2001 chars, an empty last message, an unknown data part, and a last message from the assistant all give 400 with 0 upstream calls; a body > 512 KB gives 413.

## Editable files
`app/server/ai/chat/**`, `app/app/api/chat/route.ts`, `app/tests/integration/api-chat/**`, `app/AGENTS.md` (the reasoning line only). Nothing else. Another worker is editing `app/server/env.ts`, `app/server/ai/signals/**`, `app/tests/{unit,integration}/signals/**`, `app/tests/integration/pipeline/**` and `app/scripts/record-openrouter.ts` right now. Do not touch them.

## Forbidden
No commits/`git add`, no dependency changes, never read `.env*`, no real network, no hand-written stream bodies (derived variants only, named).

## Verification
Targeted tests, `pnpm typecheck`, `pnpm lint`. Run `pnpm build` once at the end; if it fails only because of the other worker's in-progress files, retry later and report.

## Report (≤ 25 lines)
Files · test matrix · red→green counts · checks · deviations.
