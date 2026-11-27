# Brief T10 — Luna Decisions signals adapter (fail-closed)

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read `app/AGENTS.md`. Targeted tests: `pnpm exec vitest run <paths>` in `app/`.

## Goal
`app/server/ai/signals/get-signals.ts` exporting `getDecisionSignals(caseInput, image: { buffer, mediaType }, deps?: { provider?, modelId?, requestId?, callLogSink?, now? }): Promise<DecisionSignals>` (`DecisionSignals` from `@/lib/schemas`). It:
- builds questions/state with the existing `buildSignalQuestions` / `buildSignalStateText` in `app/server/ai/signals/questions.ts` (used for the T06 recordings, do not change their output);
- calls `experimental_evaluate` from `ai` with `provider.evaluationModel(modelId)` (installed API, see ADR-001 §9 amendment A1 at the end of `docs/ADR/001-ai-decision-pipeline.md`, and `app/tests/fixtures/openrouter/decisions/NOTES.md`), the image as a base64 data URL in `state`, inside `withCallLog({ stage: "signals", … })` from `@/server/ai/upstream`;
- normalizes answers per ADR-001 §3.3 into `{ value, confidence, probabilities }`. Write `app/server/ai/signals/normalize.ts` (`normalizeDecisionAnswers(rawAnswers, providerAnswerMeta?)`): boolean → value `p ≥ 0.5`, confidence `max(p, 1 − p)`; choice → top option, confidence from provider metadata `confidence` if present, else top probability; score → top level, same confidence rule;
- **never throws**: any error (network, 4xx/5xx, refusal, missing or unexpected answer) returns `{ status: "unavailable", reason: <short code>, answers: {}, refusals: [], cost: null, durationMs }`. The reason codes are `auth`, `network`, `upstream`, `refusal`, `invalid_answer` and `timeout`, and they never contain provider text;
- `server-only` at the top.
Default provider: `createProvider()` from `@/server/ai/provider`; default model `getEnv().decisionModel`.

## Tests (first, red, then green)
- `app/tests/unit/signals/normalize.test.ts`: pure; inputs built over the internal types (no success recording exists, per A1): boolean p=0.1/0.5/0.93 → confidence 0.9/0.5/0.93; choice with and without provider confidence; score.
- `app/tests/integration/signals/get-signals.test.ts`: replay ONLY the real recordings via `replayFetch` from `app/tests/helpers/replay-fetch.ts` passed as `createProvider({ fetch })` / or `createOpenRouter({ fetch, apiKey: "test" })`:
  `tests/fixtures/openrouter/errors/decisions-401.json` → unavailable/auth; `errors/decisions-connection-failure.json` → unavailable/network; `errors/decisions-upstream-account-deactivated-1.json` → unavailable (auth or upstream, document which). Assert exactly one call-log line with stage `signals` and outcome `error` per call (inject a sink), no throw, no provider text in `reason`.
- Success path: no success recording exists (A1). Do NOT invent one. Add a `it.todo` naming the missing fixture, and list it in your report.

## Editable files
`app/server/ai/signals/get-signals.ts`, `app/server/ai/signals/normalize.ts`, `app/tests/unit/signals/**`, `app/tests/integration/signals/**`. Nothing else (do not modify `questions.ts`).

## Forbidden
No commits/`git add`, no dependency changes, never read `.env*`, no real network calls, no hand-written response bodies.

## Report (≤ 20 lines)
Files · signatures · reason-code mapping per recording · red→green counts · typecheck/lint.
