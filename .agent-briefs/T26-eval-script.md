# Brief T26 — Decision evaluation script

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read:
- `app/AGENTS.md` and `.claude/rules/long-running-processes.md` (mandatory);
- ADR-001 §3.4 (the fast-path threshold 0.8 is uncalibrated for Jev 1.14), §3.7, §10 A2;
- TAC-001-08.

## Goal
`pnpm eval:decisions` (script `app/scripts/eval-decisions.ts`, registered in `app/package.json` scripts) runs the REAL pipeline functions on 5 photos from `../assets/example-images/` × 2 case types (return 10 days, complaint 400 days with a fixed synthetic reason). For each run it prints:
- the normalized signals with confidences;
- the fast-path gate result and reasons;
- the escalated decision;
- the writer/fast decision where applicable;
- agreement (same decision yes/no);
- latency per call and cost.

Reuse `runCasePipeline` or its building blocks (`getSignals`, `evaluateFastPath`, the escalation call, the writer call) from `app/server/ai/**`. Do not duplicate logic. Load the key at runtime the way `scripts/load-env.ts` does (never read or print it).

Output:
- a Markdown table to stdout;
- a JSON file at `docs/qa/T26/eval-<timestamp>.json`.

At the end, print a short suggestion: the minimum signal confidence among the cases where the fast path and the escalation agreed on Akceptacja. This is input for the threshold; do not change the threshold.

## Run
- One real run: `timeout 15m pnpm eval:decisions > ../docs/qa/T26/run.log 2>&1`. At most 30 upstream calls.
- Run `pnpm openrouter:status` before and after, and append a row to `docs/qa/spend.md`.
- Write `docs/qa/T26/report.md` (≤ 25 lines): the table, the agreement rate, the threshold observation, and the cost.

## Editable files
`app/scripts/eval-decisions.ts`, the `app/package.json` "scripts" entry only (no dependency changes), `docs/qa/T26/**`, `docs/qa/spend.md`.
Another worker is running E2E tests and editing app/test files at the same time. Don't touch other files, and don't start or stop any server.

## Forbidden
No commits or `git add`, never read `.env*`, never describe the photos to the model.

## Verification
- `pnpm typecheck`;
- `pnpm lint`.

## Time limits
- Whole task: 40 min.
- Report an overrun; never wait on a process by matching its command line.

## Report (≤ 20 lines)
