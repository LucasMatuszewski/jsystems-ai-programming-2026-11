# Brief G4b-1 — Fix "1 dni" in the justification, and record the known limits

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read:
- `app/AGENTS.md`;
- `app/tests/AGENTS.md`;
- `.claude/rules/long-running-processes.md` (mandatory);
- `docs/qa/G4b/report.md`.

## 1. Defect G4b-1 (low)
A 1-day return showed "Od zakupu minęło 1 dni." in Uzasadnienie. Expected: "Od zakupu minął 1 dzień." Use `dayCountSentence` in `app/server/ai/pipeline/body-checks.ts`.
- Tests first, in `tests/unit/pipeline/body-checks.test.ts`:
  - `checkBody` treats "1 dni" (a wrong plural for the system count) as a violation, so the existing retry runs;
  - after the retry, the server normalizes a wrong-plural sentence for N = 1 into the correct one (minimal approach: replace the matched phrase);
  - correct forms such as "1 dzień", "2 dni" and "5 dni" pass.
- Make the writer/decision prompts state the singular form explicitly, if they don't already. Bump the version only if the loader requires it.
- Run the full `timeout 5m pnpm test` once alone, plus `pnpm typecheck` and `pnpm lint`.
- Real check:
  - `timeout 5m pnpm build`, then your own `pnpm start` with its log in `docs/qa/G4b-1/server.log`;
  - with `playwright-cli`, one return at **1 day ago** (laptop-2.webp), so the justification shows the singular form;
  - a screenshot in `docs/qa/G4b-1/`, `console` (0 errors), and 1 POST / 2 upstream calls;
  - stop the server.
- Also run `timeout 15m pnpm exec playwright test --project=desktop return-flow --global-timeout=900000` → `docs/qa/G4b-1/e2e.log`.

## 2. Record the known limits in the plan
In `docs/plans/decision-copilot-poc-implementation-plan.md`, add a short **"Rev. 6 — verification limits (2026-11-26)"** bullet block under Rev. 5. Edit text only, never the Status or Issue columns. It says that:
- AC-28 and the fast path were not reproducible in real runs with `typesafe/jev-1.14` and `openai/gpt-6-luna`: about 10 complaint submissions were never accepted, and the gate opened in 0 of 15 returns (T26 and G4b). Both are covered by tests on recorded and derived outputs. Calibrating the 0.8 threshold is an open product decision.
- AC-07: the native camera picker needs a physical phone; everything else was verified by emulation (G4b B3).
- G4b is the post-fix gate, and G4b-1 is its follow-up.

Use links to `docs/qa/G4b/report.md` and `docs/qa/T26/report.md`.

## Editable files
`app/server/ai/pipeline/**`, `app/server/ai/prompts/**`, `app/tests/unit/pipeline/**`, `app/tests/unit/prompts/**`, `app/tests/integration/pipeline/**` (only if the variant tests need it), `docs/qa/G4b-1/**`, `docs/qa/spend.md`, the plan file (text as described).

## Forbidden
No commits or `git add`, never read `.env*`, no dependency changes.

## Time limits
- Whole task: 45 min.
- Report overruns. Never wait on a process by matching its command line.
- If you cannot write a report file, return the report as text.

## Report (≤ 20 lines)
