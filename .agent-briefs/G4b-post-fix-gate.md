# Brief G4b — Independent manual re-check after the T29 fixes, plus the open ACs

You are an independent QA tester. Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`, commit 9796029. Read:
- `app/AGENTS.md` and `.claude/rules/long-running-processes.md` (mandatory);
- `docs/qa/G4/report.md`, `docs/qa/T28/review.md` and `docs/qa/T29/report.md`;
- PRD AC-07, AC-23, AC-28 and §4.6;
- ADR-001 §3.4 (fast path) and §10 A2;
- `docs/qa/T26/report.md`.

**IMPORTANT:** you cannot create report files with the Write tool. Write `docs/qa/G4b/report.md` with Bash (a heredoc). If that is blocked too, return the full report as text in your final message.

## Protocol
1. Run `pnpm openrouter:status` → `docs/qa/G4b/status-before.txt`.
2. Run `timeout 5m pnpm build`. Start `pnpm start` yourself in the background, with its log in `docs/qa/G4b/server.log`, and confirm it is ready within 60 s.
3. Use `playwright-cli` interactively, one command at a time. `eval` is allowed only for read-only measurements. Screenshots go in `docs/qa/G4b/`.

## A. Re-verify the T29 fixes in the real app (1440×900)
1. **AC-23:** for 3 decisions (one return in the writer route, one return in the escalated route, one complaint), the **Uzasadnienie** section states the system day count with the correct Polish plural, and it matches the panel.
2. **D2:** the category is shown with its Polish label (e.g. "Telewizor", not "tv") and dates as dd.mm.yyyy in the messages.
3. **D4:** the next steps for a mismatch (Telewizor + phone-3.jpeg) say a correct photo needs a new case ("Nowe zgłoszenie"), with no dangling reference.
4. **F3:** in chat, claim a different purchase date. Expect no update card, a reply saying the form date counts, and the panel unchanged.
5. **F7:** in one turn, ask for two changes at once. At most one update card may appear.
6. **F6:** run only if `playwright-cli` can block sessionStorage without route mocking; otherwise mark it n/a (covered by component tests).
7. **F1/F2/F5:** these are server paths; mark them "covered by integration tests" and give the test file names. Do not fake them.
8. Mobile 360×780: one return with a 1-turn chat, no horizontal scroll, and the summary collapsed.

## B. Open acceptance criteria (real attempts, honest results)
1. **AC-28** (remedy when a complaint is accepted). Up to **4** complaint submissions that a reasonable policy would accept, for example:
   - a smartphone at 200 days, `phone-1.jpg`, reason "Ekran pękł samoistnie bez upadku, telefon był zawsze w etui, usterka pojawiła się po aktualizacji";
   - variants with different photos and 100–500 days.

   Do not describe the photo to the model. If one gives Akceptacja, check that the remedy (repair, replacement, refund per the C-rules) is stated and take a screenshot. Also try once in chat: on a complaint case, add a new fact that justifies acceptance; if an update card to Akceptacja appears, check whether it states a remedy. Record every attempt with its decision and rules.
2. **Fast path** (signals ≥ 0.8 → writer route, 2 upstream lines = signals + writer, decision Akceptacja). Try returns at 1–5 days with the clearest photos (`laptop-2.webp`, `phone-2.jpeg`, others in `../assets/example-images/`), at most **4** submissions. For each, read the `[hsdc]` lines: the stage names show the route. Report the route and outcome. If the gate never opens, write that down together with the T26 evidence (0 of 10 cases) and say that the gate logic is covered by `tests/unit/ai-logic/fast-path*.test.ts` (name the files and test counts).
3. **AC-07** (camera capture on a phone). With the mobile emulation at 360 px:
   - check the file input's `accept` attribute, whether a `capture` attribute exists, and that a photo file can be chosen;
   - state precisely what was verified and what can be verified only on a physical phone (the camera picker UI);
   - say whether the PRD requires `capture`.

## Limits
- At most 14 real submissions and 12 chat turns.
- Whole gate: 100 min.
- If a step takes 3× its expected time, save the log tail, stop, and report.
- Never wait on a process by matching its command line.
- Stop the server and the browser at the end. Do not edit app code. Never read `.env*`. Do not commit or stage.
- Run `pnpm openrouter:status` again → `status-after.txt`, and append a "G4b gate" row to `docs/qa/spend.md`.

## Report
- A table for A (each item: pass, fail or n/a, with evidence).
- A table for B (each attempt: inputs, decision, rules, route, remedy?).
- Calls measured vs expected, console results.
- Defects.
- Verdict PASS or FAIL for part A, and per-item status for part B: verified / not reproducible with this model (with evidence) / needs a physical device.

Final message ≤ 35 lines.
