# Brief T29 — Fix the accepted review findings

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read:
- `app/AGENTS.md`;
- `app/tests/AGENTS.md`;
- `.claude/rules/long-running-processes.md` (mandatory);
- `docs/qa/T28/review.md` (findings F1–F8);
- the ADR/PRD sections the findings cite.

Targeted tests: `timeout 5m pnpm exec vitest run <paths>`.

## IMPORTANT: two phases
A QA tester (G4) is running a production server from the current `.next` build right now.
- **Phase 1 (now):** source and unit/integration tests only. Do NOT run `pnpm build`, `pnpm start`, Playwright or any server, and do not touch `.next/`. At the end of phase 1, report "phase 1 done" with your results and STOP.
- **Phase 2:** only after the orchestrator messages you "G4 done, start phase 2". Then run the build, a short manual check and the E2E tests.

## Accepted findings and the decision for each (tests first, red, then green)
- **F1 (med):** the chat timeout or a mid-stream abort must end the stream with the masked error chunk `chat_failed`, never `TimeoutError` text (AC-42/43). The client must show the error row with "Ponów". Cover the server side with an integration test (abort/timeout on a replayed recording, derived variant named). Cover the client side with a component test on an aborted or errored stream.
- **F2 (med):** `/api/chat` accepts only `user` and `assistant` messages from the client. User messages may contain only text parts. Assistant messages may contain only the parts our UI produces (text, `data-decision`, `tool-update_recommendation`). Reject anything else with 400 `validation_failed`, with 0 upstream calls. Add tests.
- **F3 (med):** derive `CaseFormValuesSchema` from `makeCaseFormFieldsSchema`, so the chat `caseContext.form` has the same limits and formats as the form. Add limits for the other `caseContext` strings (summary text, findings). On the server, **recompute `daysSincePurchase` from `form.purchaseDate` and the server clock**, and ignore the client value for the guards and the prompt. A mismatch is not an error; the server value wins. Add tests: oversized `reason` → 400; `purchaseDate: "banana"` → 400; a forged `daysSincePurchase` does not change the R-2.4 / R-4 / C-2 guard results.
- **F4 (med, AC-23):** in `run-case-pipeline.ts`, next to the existing guards in the `attempt` closures:
  - Check that `bodyMarkdown` states the system day count (the number together with dni/dzień/dnia) and cites only rule IDs from the policy. A violation is an `OutputViolation`, which uses the existing single retry.
  - If the day count is still missing after the retry, the server inserts one deterministic sentence into the justification section: "Od zakupu minęło N dni." (correct Polish plural: 1 dzień, otherwise dni). This is better than failing the case.
  - Unit test the check and the fallback with recorded outputs (derived variants, named).
  - Update the writer and escalation prompts to require the day count in the justification, with a version bump.
  - Watch the call budget: a retry is already counted as "+1 only for a logged retry".
- **F5 (med):** enforce the 11 MB (`/api/cases`) and 512 KB (`/api/chat`) limits while reading the body stream, even without `Content-Length` → 413 `file_too_large`. Test with a stream body without that header.
- **F6 (low):** if `writeSession` fails after a successful analysis, show a clear Polish notice and keep the user on the form with their data (or render the result in memory). Do not lose it silently. Report a non-quota storage error as its own code, not as `analysis_failed`. Add a component test.
- **F7 (low):** enforce at most one `update_recommendation` per turn in code: after the first tool call, the tool is no longer offered (check the AI SDK 7.0.118 `prepareStep`/`activeTools` or the `stopWhen` API in `node_modules/ai`), or a second call throws. Add a test with a derived variant.
- **F8 (low):** pass the pipeline/request abort signal into the signals call.
- **Simplifications (do them):** merge the two `NEUTRAL_FINDINGS` constants and the duplicated `httpStatusOf`/`statusOf`.

## Phase 1 verification
- `pnpm typecheck`;
- `pnpm lint`;
- full `timeout 5m pnpm test`, run 2× alone, all green.

## Phase 2 (after the go message)
1. Run `timeout 5m pnpm build` (0 warnings).
2. Short manual check, with your own server, `playwright-cli`, and logs in `docs/qa/T29/`:
   - a return case: the justification states the day count (AC-23);
   - 2 chat turns;
   - the screenshots;
   - `console` (0 errors);
   - the call counts.
3. Run the full E2E per project: `timeout 40m pnpm test:e2e --project=desktop --project=failure` and `--project=mobile`. Both must be green.
4. Run `pnpm openrouter:status` before and after, and append a row to `docs/qa/spend.md`. Write `docs/qa/T29/report.md`.

## Editable files
`app/server/**`, `app/app/api/**`, `app/lib/**`, `app/components/case-flow/**`, `app/components/case-submission/**`, `app/components/chat/**`, `app/server/ai/prompts/**`, `app/tests/**` (except E2E assertions, which must not be weakened), `docs/qa/T29/**`, `docs/qa/spend.md`.

## Forbidden
No commits or `git add`, no dependency changes, never read `.env*`, no hand-written response bodies (named derived variants only).

## Time limits
- Phase 1: 90 min.
- Phase 2: 75 min.
- Report overruns. Never wait on a process by matching its command line.

## Report (each phase ≤ 30 lines)
- Per finding: change, tests red→green, files.
- Then the checks.
