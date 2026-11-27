# Brief T16 — Case decision pipeline

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read `app/AGENTS.md`. Targeted tests: `pnpm exec vitest run <paths>` in `app/`.

## Goal
`app/server/ai/pipeline/run-case-pipeline.ts` exporting
`runCasePipeline(caseInput, image: { buffer, mediaType }, signal: AbortSignal, deps?: PipelineDeps): Promise<CaseDecision>` and `class PipelineError extends Error { code: "model_unavailable" | "invalid_model_output" | "timeout" }`.
`PipelineDeps` (all optional): `provider`, `env` (from `getEnv()`), `now: () => Date`, `onStage?: (stage: "decision") => void`, `requestId`, `callLogSink`, `decisionLogSink` (default `appendDecisionLog`).

Sources (read): `docs/ADR/001-ai-decision-pipeline.md` §3.2 (stages, strict order), §3.4, §3.5 (guards + one retry), §3.7 (decision log), §4.4 (imageFindings formatter for rule/fast routes), §4.5, §5, §7 routing diagram, §8, TAC-001-03/04/05, and **§9 amendment A1** (fast path off by default; signals currently always unavailable). ADR-006 §3.2 call budget. ADR-002 §5 error mapping.

## Use the existing modules (do not reimplement)
- facts/rules/gate/guards/policy: `app/server/ai/logic/{days,rules,fast-path,guards,policy}.ts`
- signals: `getDecisionSignals` in `app/server/ai/signals/get-signals.ts` (T10, being finished now; if it isn't there yet when you start, wait a few minutes and re-check, do not write your own)
- LLM calls: `buildEscalationCall`, `buildWriterCall` in `app/server/ai/calls/` + `generateText` from `ai`; provider via `createProvider` (`app/server/ai/provider.ts`)
- logs: `withCallLog` (`app/server/ai/upstream.ts`), `toDecisionLogEntry` / `appendDecisionLog` (`app/server/ai/log/decision-log.ts`)
- prompts versions via `loadPrompt`; env via `getEnv`.

## Behaviour
1. days = `daysSincePurchase(purchaseDate, now())`.
2. signals = `getDecisionSignals(...)` (always called).
3. date rule → route `rule`, decision locked → writer (effort `env.reasoning.writer`). imageFindings: if signals ok → formatter from signals (Polish labels); if unavailable → a neutral findings object (photoQuality "limited", evidence ["Zdjęcie nie zostało ocenione automatycznie."]) — the date rule doesn't depend on the photo (document this in a code comment referencing A1).
4. else fast path (`evaluateFastPath`, only when `env.fastPathEnabled`) → route `fast`, Akceptacja, writer.
5. else route `escalated`: `generateText(buildEscalationCall(...))` with effort `env.reasoning.decision`, `abortSignal`. escalationReasons = gate reasons, or ["fast_path_disabled"] / ["signals_unavailable"].
6. guards (`applyGuards`) on every route; on a violation → retry the model call ONCE (escalated or writer), second violation → `PipelineError("invalid_model_output")`. Schema-parse failure of the structured output counts as a violation.
7. `onStage("decision")` is called after signals finish and before stage 3–5 work.
8. decision log line (no customer text); then return `CaseDecision` with `firstMessage` `{greeting, bodyMarkdown}`, `signalsSummary` (key → value, confidence), `route`, `escalationReasons`, `guardsApplied`, `remedy`, `daysSincePurchase`, `imageFindings`, `ruleRefs`, `photoAdvice`.
9. Errors: abort (signal aborted / AbortError) → `timeout`; provider/network/auth errors from the LLM → `model_unavailable`. Never leak provider text.
Call budget (ADR-006 §3.2 + A1): escalated = 1 signals + 1 escalated (+1 on a logged retry); rule = 1 signals + 1 writer.

## Tests (first, red, then green) `app/tests/integration/pipeline/*.test.ts`
Replay ONLY real recordings with `replayFetch` (you may extend `app/tests/helpers/replay-fetch.ts` to serve several fixtures in sequence, e.g. `replayFetch([signalsFixture, llmFixture])`, keeping its existing API and tests green):
- escalated return: `errors/decisions-upstream-account-deactivated-1.json` (signals) + `llm/escalated-return-laptop-2.json` → route escalated, decision from the recording, ≥ 1 valid R-rule, exactly 2 call-log lines (signals error + escalated ok), 1 decision-log line without the reason/model text.
- escalated complaint: same with `llm/escalated-complaint-phone-1.json`.
- rule route: signals error fixture + `llm/writer-rule-return-r4.json` → Odrzucenie, ["R-4"], route rule, escalated never called; complaint + `writer-rule-complaint-c2.json` → C-2.
- R-2.4 guard: derived variant of the escalated-return recording with the decision changed to "Odrzucenie" (name the base recording, change only that value) → Weryfikacja ręczna + guardsApplied R-2.4.
- invalid rule refs twice: derived variant with ruleRefs ["R-9"] served twice → PipelineError invalid_model_output after exactly 1 retry (3 call-log lines).
- LLM failure: signals error + `errors/chat-401.json` exchange used for the LLM call (or a connection-failure fixture) → PipelineError model_unavailable, no provider text in message.
- abort: an already-aborted signal → PipelineError timeout.
- TAC-001-03: assert no result has route fast with a decision other than Akceptacja (across all tests).
Fixed clock: `now = () => new Date("2026-11-26T10:00:00+01:00")`; purchase dates computed from it.

## Editable files
`app/server/ai/pipeline/**`, `app/tests/integration/pipeline/**`, `app/tests/helpers/replay-fetch.ts` (extend only), `app/tests/unit/replay/**` (only if you extend the helper). Nothing else.

## Forbidden
No commits/`git add`, no dependency changes, never read `.env*`, no real network calls, no hand-written response bodies (derived variants only, named).

## Report (≤ 30 lines)
Files · signatures · route/test matrix with call-log counts · red→green counts · typecheck/lint · open issues.
