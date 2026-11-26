# Brief T11 — Env validation, decision log, upstream call log

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read `app/AGENTS.md`. Contracts in `app/lib/schemas/**`.

## Goal
1. `app/server/env.ts`: `getEnv()` validates (zod) and caches all ADR-000 §7 variables with defaults (`LLM_MODEL` openai/gpt-6-luna, `DECISION_MODEL` openai/gpt-6-luna-decisions, `FAST_PATH_ENABLED` false (ADR-001 amendment A1; env value "true" enables it), `FAST_PATH_THRESHOLD` 0.8, reasoning efforts high/low/medium, `POLICIES_DIR` `../docs/policies` resolved from `process.cwd()`, `DECISION_LOG_PATH` `.data/decision-log.jsonl` (empty string = disabled), `APP_URL`, `APP_TITLE`). Missing `OPENROUTER_API_KEY` throws `EnvError` with a clear message naming the variable (never its value). Accept an optional `source` object for tests.
2. `app/server/ai/log/decision-log.ts`: `appendDecisionLog(entry, path?)` appends one JSON line (creates the dir), swallows and console-logs write errors. `toDecisionLogEntry(...)` builds the entry from pipeline data with ONLY: timestamp, caseType, category, daysSincePurchase, signals (key → value, confidence, probabilities), route, escalationReasons, decision, guardsApplied, promptVersions, modelIds, durations, cost. It must not include reason, model name, image data or message text (TAC-001-06).
3. `app/server/ai/log/call-log.ts` + `app/server/ai/upstream.ts`: `createRequestId()`, `logIncoming({requestId, route, status})` (one line per incoming request), and `withCallLog({ requestId, stage, modelId, sink? }, fn)`: runs `fn`, measures latency, logs exactly one line `{"type":"upstream","requestId","stage","modelId","outcome":"ok"|"error","status"?,"latencyMs","costUsd"?}` and rethrows errors. `stage` ∈ signals | escalated | writer | chat-step. Cost comes from what `fn` returns (an optional `extractCost(result)`). No prompts, customer text or image data. The default sink is `console.info` with prefix `[hsdc]`; tests inject a sink.
4. `server-only` at the top of each file.

Sources: `docs/ADR/001-ai-decision-pipeline.md` §3.7, §5; `docs/ADR/006-real-endpoint-verification.md` §3.2; `docs/ADR/000-main-architecture.md` §7; ADR-002 TAC-002-04.

## Tests (first, red, then green)
`app/tests/unit/env/env.test.ts`, `app/tests/unit/log/decision-log.test.ts`, `app/tests/unit/log/call-log.test.ts`:
- env: defaults applied; missing key → EnvError naming the variable and not echoing other values; invalid threshold → error; empty `DECISION_LOG_PATH` → disabled.
- decision log: the written line parses as JSON; a scan of the line contains neither the reason, nor the model name, nor `data:image`/base64 fragments (use realistic Polish synthetic strings); a write failure (unwritable path, e.g. a directory path) does not throw. Use a temp dir under `os.tmpdir()`.
- call log: one line per call on success and on error (error rethrown); line has no input text.

## Editable files
`app/server/env.ts`, `app/server/ai/log/**`, `app/server/ai/upstream.ts`, `app/tests/unit/env/**`, `app/tests/unit/log/**`. Nothing else.

## Forbidden
No commits/`git add`, no dependency changes, never read `.env*`, no network.

## Commands (in `app/`)
`pnpm test -- tests/unit/env tests/unit/log` · `pnpm typecheck` · `pnpm lint`

## Report (≤ 25 lines)
Files · exported signatures · red summary · green counts · typecheck/lint.

## Extra (G1 defect D3)
5. Wire the call log into the existing template route `app/app/api/chat/route.ts`: create a `requestId`, call `logIncoming` once per request (route `/api/chat`, final status), and wrap the upstream `streamText` call so that exactly one `upstream` line with stage `chat-step` is logged per model step. Use `onFinish`/`onStepFinish` (or `onEnd` per AI SDK 7, check Context7 `/vercel/ai/ai_7.0.0`) for completion and `onError` for failures, and include `costUsd` from `providerMetadata.openrouter.usage.cost` when present. Add `app/app/api/chat/route.ts` to the editable files. Do not send real requests; verify with typecheck/lint/build.
