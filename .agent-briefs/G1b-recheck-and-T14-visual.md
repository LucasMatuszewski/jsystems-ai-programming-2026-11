# Brief G1b — G1 re-check (defects D1, D3) + T14 visual brand check

You are the QA tester. Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read `app/AGENTS.md`, `docs/qa/G1/report.md` (first run, conditional FAIL), plan §4 gate protocol, ADR-006 §3.2–3.5, `docs/design-guidelines.md`.

Current state: the template chat still lives at `/` (the real form arrives in T22). The brand theme (T14) is applied but uncommitted, and not yet seen in a browser. The upstream call log (T11) is now wired into `/api/chat`; each upstream step prints one `[hsdc]` line with `"type":"upstream"` and each request prints one `"type":"incoming"`-style line on server stdout.

## Part A — G1 re-check (`docs/qa/G1/recheck.md`)
1. `cd app && pnpm openrouter:status` (save as `docs/qa/G1/recheck-status-before.txt`).
2. `pnpm record:openrouter --compare` (D1 fix): expected baseline = the newest `account_deactivated` error recording; expected result identical structure (exit 0). Save output to `docs/qa/G1/recheck-drift.txt`.
3. `pnpm build` (must pass; note any warnings), then `pnpm start` in the background with stdout+stderr to `docs/qa/G1/recheck-server.log`.
4. With `playwright-cli`, one command at a time (no `run-code`, `eval`, `route`, no pre-written sequences): open `http://localhost:3000`, do **3 improvised Polish chat turns** (each follows from the previous answer), and after each turn check `playwright-cli requests`: 1 × `POST /api/chat`. Check the server log: exactly 1 incoming line and exactly 1 `upstream` line with stage `chat-step` per turn (D3), with `outcome` ok. Reload: 0 requests, 0 log lines. `console`: 0 errors.
5. Stop the server. `pnpm openrouter:status` again; append a row "G1 re-check" to `docs/qa/spend.md`.
Verdict for G1: PASS only if D1 and D3 are resolved and nothing else regressed.

## Part B — T14 visual check (`docs/qa/T14/report.md`)
With the same production server (before stopping it in A.5):
- `resize 1440 900` → screenshot `docs/qa/T14/desktop.png`; `resize 360 780` → screenshot `docs/qa/T14/mobile.png`. Check there is no horizontal scroll at 360 px: `snapshot` and inspect, or compare page width; `eval` is not allowed.
- Open `assets/homepage-desktop.png` and `assets/homepage-mobile.png` (Read tool shows images) and compare: cream background, 3 px ink border under a sticky header, logo top-left about 35 px high, product name "Hardware Service Decision Copilot" in Bangers, red primary button with an ink border and a hard offset shadow, Atkinson body text, Polish glyphs render correctly in Bangers. List matches and differences, each with severity.
- Check the page `<title>` and the favicon (the template's `app/app/page.tsx` may still set the title "Chat"; report it, T22 replaces that page).

## Rules
- Do not edit app code; report defects. Leave no server running; close the browser.
- Never read `.env*`. No more than 4 real chat turns in total.
- Do not commit or stage.

## Final message (≤ 25 lines)
G1 verdict + call table (measured vs expected), drift result, spend delta, T14 brand verdict with the main differences, evidence paths.
