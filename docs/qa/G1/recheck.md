# G1 re-check (D1, D3)

Date 2026-11-26, prod build (`pnpm build` OK, 1 warning: Turbopack "Dynamic filesystem access" at `server/env.ts:79` `path.resolve(process.cwd(), POLICIES_DIR)`, via `/api/cases`), `pnpm start`, playwright-cli single commands, desktop 1440x900.

## D1 drift check: RESOLVED (no crash), but real drift reported (exit 1)
Baseline `errors/decisions-upstream-account-deactivated-2.json` (401). Live result: status 200 (baseline 401), `.error` only in fixture, `.answers/.id/.model/.provider/.usage` only in live. Expected "identical structure, exit 0" not met: the upstream Luna Decisions endpoint no longer returns account_deactivated; fixtures for that error are stale. Not a tool defect; recordings of the decisions endpoint should be refreshed (T06 follow-up). Output: `recheck-drift.txt`.

## D3 upstream log: RESOLVED
| Action | Browser->app expected / measured | Incoming log lines | `upstream` chat-step lines (outcome ok) |
|---|---|---|---|
| Turn 1 (headphones, cracked band) | 1 / 1 | 1 | 1 (17481 ms) |
| Turn 2 (seller blames me) | 1 / 1 | 1 | 1 (14920 ms) |
| Turn 3 (complaint template) | 1 / 1 | 1 | 1 (4647 ms) |
| Reload | 0 / 0 | 0 | 0 |
Totals: 3 POST /api/chat, 3 incoming, 3 upstream; log has 6 `[hsdc]` lines. Console: 0 errors, 0 warnings. `costUsd` is 0 in every upstream line (cost field not populated, or below precision).

## Observations
- Snapshot after a finished answer still showed "Thinking" + "Stop generating" for a while (turns 1-3), while screenshot showed the full answer; possible stuck status indicator, verify at G2.
- Usage 0.0048 before and after (delta 0.0000).

## Verdict G1: PASS with notes (D1, D3 resolved; drift is a data finding, not a regression)
