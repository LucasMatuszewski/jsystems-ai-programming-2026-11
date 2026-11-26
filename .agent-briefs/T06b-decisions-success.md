# Brief T06b — Complete T06: Luna Decisions success recordings (endpoint is back)

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read `app/AGENTS.md`, `.agent-briefs/T06-record-decisions.md` (the original brief: recordings 1–4, refusal, `--compare`), `docs/ADR/001-ai-decision-pipeline.md` §3.3–3.4 and §9 (amendment A1), `app/tests/fixtures/openrouter/decisions/NOTES.md`, `app/tests/fixtures/GAPS.md`. Targeted tests: `pnpm exec vitest run <paths>`.

## Context
On 2026-11-26 around 11:00 the decisions endpoint returned 401 `account_deactivated`. At about 12:15 the G1 re-check `--compare` got HTTP 200 with `answers/id/model/provider/usage`. A1 items 2–3 (outage, fast path off) are therefore obsolete; item 1 (API names `experimental_evaluate` / `evaluationModel`) stays.

## Tasks
1. `pnpm openrouter:status` (before). Then `pnpm record:openrouter decisions` to record the four success fixtures defined in the original T06 brief into `app/tests/fixtures/openrouter/decisions/` (same request data, photos, question sets via `buildSignalQuestions`/`buildSignalStateText`, HTTP-level recording format). Then `refusal` once (save only if a real refusal occurs). Then `--compare`, which must now use the success baseline (exit 0). At most 8 real calls.
2. Update `NOTES.md` with the confirmed answers (wire names, where `confidence` lives, cost, latency) and the normalized table per recording, computed by the existing `normalizeDecisionAnswers` in `app/server/ai/signals/normalize.ts`. If the real shape differs from what normalize/get-signals assume, fix those two files (tests first).
3. `app/tests/integration/signals/get-signals.test.ts`: replace the `it.todo` success test with real replays of the 4 recordings (status ok, all expected keys present, confidences in [0,1], one `signals` call-log line with outcome ok and cost).
4. `app/tests/unit/signals/normalize.test.ts`: add tests that feed the 4 recordings.
5. Fast-path gate tests with recording-derived inputs: in `app/tests/unit/ai-logic/fast-path-recordings.test.ts`, run `evaluateFastPath` on the normalized signals of each recording (both case types) and report which are eligible. Assert only invariants (never a non-Akceptacja fast outcome, TAC-001-03; boundary variants at 0.79/0.8 derived from a named recording).
6. Pipeline: in `app/tests/integration/pipeline/`, add one test replaying a success signals recording + the matching `llm/escalated-*` recording (escalated route with signals ok, escalationReasons = the gate's reasons). If any recording is fast-path eligible, it needs a writer recording for a fast acceptance. Record it with `pnpm record:openrouter llm`, adding a `writer-fast-<name>` entry to the llm command (max 1 extra call), and add a fast-route pipeline test (2 call-log lines: signals ok + writer ok).
7. Restore the accepted ADR default: `FAST_PATH_ENABLED` default `true` in `app/server/env.ts` (update its env test). Keep the `.env.example` files as they are (they already say `true`).
8. Rewrite ADR-001 §9 A1 to keep item 1 (API names, wire format, confidence location: confirm from the recordings) and to state that the 401 outage on 2026-11-26 morning was temporary and has been resolved, so the fast path stays ON per §3.4. Keep it short. Keep the status "Proposed".
9. `pnpm openrouter:status` (after); append a row to `docs/qa/spend.md`.

## Editable files
`app/tests/fixtures/openrouter/decisions/**`, `app/tests/fixtures/openrouter/llm/writer-fast-*.json`, `app/tests/fixtures/GAPS.md`, `app/scripts/record-openrouter.ts`, `app/server/ai/signals/normalize.ts`, `app/server/ai/signals/get-signals.ts`, `app/tests/unit/signals/**`, `app/tests/integration/signals/**`, `app/tests/unit/ai-logic/fast-path-recordings.test.ts`, `app/tests/integration/pipeline/**`, `app/server/env.ts`, `app/tests/unit/env/**`, `docs/ADR/001-ai-decision-pipeline.md` (§9 only), `docs/qa/spend.md`. Nothing else.

## Forbidden
No commits/`git add`, no dependency changes, never read `.env*`, no hand-written bodies, do not describe photos to the model.

## Verification
Full `pnpm test`, `pnpm typecheck`, `pnpm lint`.

## Report (≤ 35 lines)
Recordings (status, latency, cost, key answers) · normalized table summary · fast-path eligibility per recording · code fixes (if any) · tests counts · spend · A1 text change.
