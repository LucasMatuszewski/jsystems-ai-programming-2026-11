# Brief G4 — Final manual regression (desktop + mobile, brand comparison)

You are the QA tester. Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`, commit 54427e5. Read:
- `app/AGENTS.md` and `.claude/rules/long-running-processes.md` (mandatory);
- plan §4 and the G4 row;
- ADR-006 §3.5;
- PRD §4–§11 and all ACs;
- `docs/design-guidelines.md`;
- the earlier gate reports `docs/qa/G2/report.md`, `docs/qa/G3/report.md` and `docs/qa/G3-D1/report.md`;
- `app/tests/e2e/COVERAGE.md`. Its "Manual only (G4)" list is your checklist.

## Protocol
1. Run `pnpm openrouter:status` → `docs/qa/G4/status-before.txt`.
2. Run `timeout 10m pnpm record:openrouter --compare` → `drift.txt`. It must exit 0. If it reports drift, note it as a defect; do not re-record.
3. Run `timeout 5m pnpm build` (0 warnings). Start `pnpm start` yourself in the background, with its output in `docs/qa/G4/server.log`, and confirm it is ready within 60 s.
4. Use `playwright-cli` interactively, one command at a time, deciding after each `snapshot`. Not allowed: `run-code`, route mocking, pre-written sequences, and the E2E suite. Use `eval` only for read-only measurements such as `scrollWidth`.
5. At **1440×900**, repeat G2 scenarios a–g and a short G3 chat (≥ 4 turns per case type: a clarifying question, a new fact (update card), insisting, an injection). Then repeat at **360×780**: one return and one complaint with a 2-turn chat, the collapsed summary, no horizontal scroll, and the new-case dialog.
6. **D1 regression:** a return at 10 days; in chat, claim "Laptop dostałem 40 dni temu". Expect no update card, the panel unchanged, and a reply that says the form date counts.
7. Go through every "Manual only (G4)" item in `COVERAGE.md`. Mark each one pass, fail or n/a, with the evidence. Include:
   - AC-23: is the day count stated in the justification? It was a known gap in G2, so report what you see.
   - AC-28: the remedy when a complaint gets Akceptacja. Try at most 2 extra complaint submissions to get one, and record it if the model never decides that.
   - AC-09: an image over 10 MB. If there is no such asset, generate one locally only by padding a copy of an example JPEG in `docs/qa/G4/tmp/`, and delete it afterwards.
8. **Keyboard only:** one full submission plus one chat turn, using only Tab, Space, Enter and typing (AC-46).
9. **Brand:** take screenshots of the form, progress, chat and dialog on desktop and mobile. Compare them with `assets/homepage-desktop.png` and `homepage-mobile.png` and the design tokens (colours, fonts, 3 px ink borders, hard shadows, logo placement, bubble radii). List the deviations.
10. After each action, check `playwright-cli requests` and the `[hsdc]` lines in `server.log` against the call budget (a submission = 1 POST and 2 upstream calls; a chat turn = 1 POST and 1–2 chat-step calls; load, refresh and validation = 0), and run `console` (0 errors).
11. Run `pnpm openrouter:status` again → `status-after.txt`, and append a "G4 gate" row to `docs/qa/spend.md`. Stop the server and the browser.

## Limits
- At most 12 real submissions and 30 chat turns.
- Whole gate: 120 min.
- If a step takes 3× its expected time, save the log tail and process state, stop, and report.
- Never wait on a process by matching its command line.

## Report `docs/qa/G4/report.md`
- Date, commit, environment.
- A scenario table: desktop, then mobile, with the calls measured vs expected.
- The COVERAGE manual checklist results.
- The brand comparison.
- Defects (severity, repro, expected vs actual), with model-judgement observations listed separately.
- Verdict PASS or FAIL.

## Rules
Do not edit app code. Never read `.env*`. Do not commit or stage.

## Final message (≤ 35 lines)
Verdict, scenario summary, checklist results, defects, evidence paths.
