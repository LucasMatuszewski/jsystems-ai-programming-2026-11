# Brief T27 — E2E green at 1440 and 360 px

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`, commit 01c950b. Read:
- `app/AGENTS.md`;
- `app/tests/AGENTS.md`;
- `.claude/rules/long-running-processes.md` (mandatory);
- the T27 row in `docs/plans/decision-copilot-poc-implementation-plan.md`;
- ADR-000 §10;
- PRD AC-41, AC-44–AC-46;
- `app/tests/e2e/COVERAGE.md`.

## Goal
The full `pnpm test:e2e` passes on the `desktop` (1440) and `mobile` (360) projects with real OpenRouter, and no `test.fail()` is left anywhere.

## Known items
1. `responsive-a11y.spec.ts`: a stale `test.fail()` on "form page at viewport width has no horizontal scroll" (it now passes, so it counts as failed). The form axe test still has `test.fail()`: make it pass by fixing the serious/critical axe issues in the owning component (report each one), or justify a narrower rule set from the PRD. Never disable rules just to pass.
2. AC-41, invalid key: add a Playwright project or a spec that runs against a second server on port 3001, started by you with `OPENROUTER_API_KEY=sk-or-v1-invalid` in its environment (`baseURL` per project). Expect the analysis error banner with data kept, and "Spróbuj ponownie" sends exactly 1 more POST. For chat, a failed reply shows the error row.
3. Gaps listed in `COVERAGE.md`: close them, or mark them "manual only (G4)" with a reason.
4. Timing-sensitive unit tests under parallel CPU load:
   - `tests/unit/client-utils/ndjson.test.ts` "handles chunks of 1 bytes";
   - `tests/component/chat/conversation/conversation.test.tsx` scroll (AC-37);
   - `tests/component/case-summary/new-case-dialog.test.tsx`.

   Make them robust: deterministic waits, no wall-clock assumptions. Do not raise timeouts blindly; explain the cause.
5. `playwright.config.ts`:
   - Replace the reused `webServer` with an explicit server that you start yourself, or set `reuseExistingServer: false` with stdout piped to a log.
   - Add `globalTimeout`.
   - Document the run commands in `app/AGENTS.md` (commands section, ≤ 5 lines).

## Run
- One spec per invocation:
  `timeout 15m pnpm exec playwright test --project=<p> <spec> --global-timeout=900000 > ../docs/qa/T27/e2e-<p>-<spec>.log 2>&1`
- Server output goes to `docs/qa/T27/server.log`.
- Then run the full suite once per project (`timeout 40m`). It must pass.
- Real submissions are limited: reuse a created case where the spec structure allows it. Report the counts.
- Run `pnpm openrouter:status` before and after, and append a row to `docs/qa/spend.md`.

## Editable files
`app/tests/**`, `app/playwright.config.ts`, components only for axe fixes (name each one), `app/AGENTS.md` (commands section), `docs/qa/T27/**`, `docs/qa/spend.md`.
Another worker is writing `app/scripts/eval-decisions.ts` and `docs/qa/T26/**` at the same time. Don't touch them.

## Forbidden
No commits or `git add`, no dependency changes, never read `.env*`, no mocks in E2E, no weakened assertions.

## Verification
- `pnpm typecheck`;
- `pnpm lint`;
- full `pnpm test`, run 3 times, alone, all green;
- `pnpm build` (0 warnings);
- full E2E on both projects.

## Time limits
- Whole task: 120 min.
- Per spec: 15 min.
- Full suite: 40 min.
- Report overruns; never wait on a process by matching its command line.
- Stop every server you start.

## Report (≤ 35 lines)
- Per spec × project: passed/failed/skipped.
- The axe findings and fixes.
- AC-41 result.
- The unit-test robustness fixes, with their causes.
- Config change.
- Submissions count.
- Spend.
- Remaining gaps.
