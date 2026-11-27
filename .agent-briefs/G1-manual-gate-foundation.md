# Brief G1 — Manual verification gate: foundation

You are the QA tester. Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read `app/AGENTS.md` and `docs/plans/decision-copilot-poc-implementation-plan.md` §4 (gate protocol). Also read `docs/ADR/006-real-endpoint-verification.md` §3.2–3.5.

## Goal
Prove that the foundation increment (template chat on OpenRouter `gpt-6-luna`) works against real endpoints by using it interactively, without unnecessary calls and within limits. Write evidence to `docs/qa/G1/`.

## Protocol (do it in this order)
1. **Limits:** `cd app && pnpm openrouter:status`. Save the output (no key is printed) to the report. Stop if remaining credit is below USD 1.
2. **Drift check:** `pnpm record:openrouter --compare` (created by T06). Luna Decisions is currently unavailable upstream (ADR-001 amendment A1: HTTP 401 `account_deactivated`), so the expected outcome is that same 401. Report what you see. Any other structural difference is a defect. This costs at most 1 call.
3. **Production run:** `pnpm build`, then start `pnpm start` in the background with stdout+stderr redirected to `docs/qa/G1/server-start.log`. Use `run_in_background` or `nohup … &` and note the PID.
4. **Interactive browser use with `playwright-cli`, one command at a time.** Run `playwright-cli --help` first. After each `snapshot` decide the next action from what you see. Not allowed: pre-written sequences, `run-code`, `eval`, `route`/`unroute`, replayed recordings, or the E2E suite as a substitute.
   - `open http://localhost:3000` → `snapshot` → `screenshot` (save as `docs/qa/G1/desktop-home.png` at 1440×900 via `resize 1440 900`).
   - Have at least **5 improvised chat turns** in Polish. Write each next message based on the previous answer (for example ask a follow-up about what the model just said). After each turn run `playwright-cli requests` (or `network`) and count `POST /api/chat`: expected exactly 1 per turn.
   - Reload the page once: expected 0 requests to `/api/chat` and 0 upstream calls.
   - `console`: expected no errors.
   - `resize 360 780` → screenshot `docs/qa/G1/mobile-home.png` → check there is no horizontal scroll (`snapshot`, or compare page width visually).
5. **Upstream call count:** the dedicated call-log wrapper arrives in T11, so in G1 count the OpenRouter calls from (a) the usage delta of `pnpm openrouter:status` before/after and (b) the server log. Expected: one upstream call per chat turn, none on load or reload. Document this method and its limitation.
6. **Dev run:** stop the production server (kill its PID). Start `pnpm dev` in the background (log to `docs/qa/G1/server-dev.log`). Open the page, send 1 chat turn, and check that exactly **1** `POST /api/chat` is sent (React Strict Mode must not duplicate requests). Stop the dev server.
7. **Limits after:** `pnpm openrouter:status` again; append a row to `docs/qa/spend.md` (activity "G1 gate").
8. Leave no server running. Close the browser (`playwright-cli close`).

## Brand check
Do it on the screenshots, even though T14 (branding) comes later. Compare with `assets/homepage-desktop.png` and `assets/homepage-mobile.png`, and state that branding is not yet applied (expected at G1). Record any layout problems.

## Report `docs/qa/G1/report.md`
Date, commit (`git rev-parse --short HEAD`), environment, the steps you performed with results, a table of measured vs expected calls per action, usage before/after, console result, the screenshots list (embedded with relative links), defects found (with severity), and a verdict: PASS or FAIL with reasons. Keep the chat transcript excerpt short (first 200 chars per answer).

## Editable files
`docs/qa/G1/**`, `docs/qa/spend.md`. Nothing else. Do not fix app code: report defects instead.

## Forbidden
No commits, no `git add`, never read `.env*`, no more than 8 real chat turns in total.

## Final message (≤ 30 lines)
Verdict, measured/expected call table, spend delta, defects, paths of evidence files.
