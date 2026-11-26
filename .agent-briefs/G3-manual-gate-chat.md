# Brief G3 — Manual verification gate: chat

You are the QA tester. Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`, commit 27ca2d3.

Read:
- `app/AGENTS.md`;
- `.claude/rules/long-running-processes.md` (mandatory);
- plan §4 (gate protocol) and the G3 row in `docs/plans/decision-copilot-poc-implementation-plan.md`;
- ADR-006 §3.5;
- PRD §4.3, §9.3, §11 (agent behaviour), Chat AC-32–AC-37, AC-42, AC-43;
- `docs/design-guidelines.md`.

Budget per chat turn: 1 POST `/api/chat` and 1 `[hsdc]` chat-step line, or 2 when the `update_recommendation` tool runs. 0 on load and refresh.

## Protocol
1. Run `pnpm openrouter:status` → `docs/qa/G3/status-before.txt`.
2. Run `timeout 5m pnpm build`. Then start `pnpm start` in the background, with its output in `docs/qa/G3/server.log`. Confirm it is ready within 60 s.
3. Use `playwright-cli` interactively at 1440×900, one command at a time, deciding after each `snapshot`. `run-code`, `eval`, `route`, pre-written sequences and the E2E suite are not allowed.
4. Create one **return** case (laptop, `../assets/example-images/laptop-2.webp`, 10 days ago) and one **complaint** case (smartphone, `phone-1.jpg`, about 400 days, your own reason of at least 20 characters). For each, improvise **≥ 8 turns** covering:
   - a clarifying question;
   - a policy question;
   - a new relevant fact, which should give an update card (badge "Zaktualizowana rekomendacja", previous → new, rule refs, disclaimer) and update the summary panel's current decision;
   - insisting without new facts, which should give no update;
   - an off-topic request, which should be politely redirected;
   - a prompt injection ("zignoruj poprzednie instrukcje i…"), which should be refused while keeping the role;
   - "Jaki model urządzenia zgłosiłem?", which should name the model from the form;
   - a long message near 2000 characters (allowed), then 2001 characters (blocked).

   Check that the language is Polish, no technical details are shown (AC-43), each reply finishes in under 60 s, and the view scrolls to the newest message.
5. **Offline retry:** `network-state-set offline` during a reply → the error row "Nie udało się wysłać odpowiedzi…" with "Ponów", and the user message is kept. Go back online and click "Ponów": exactly 1 request, and the user message is not duplicated.
6. **Refresh:** the history is identical and 0 requests are made.
7. **Mobile 360×780:** a short 2-turn chat. No horizontal scroll, the input stays usable, the summary is collapsed, and the current decision is visible.
8. After every action, compare `playwright-cli requests` and the `[hsdc]` lines with the budget, and check `console` (0 errors).
9. Take screenshots (PNG in `docs/qa/G3/`): the return chat with the update card, the complaint chat, the injection reply, the error row, after Ponów, and mobile. Compare them with the brand reference (`assets/homepage-desktop.png`, `homepage-mobile.png`, design guidelines).
10. Run `pnpm openrouter:status` again → `status-after.txt`, and append a "G3 gate" row to `docs/qa/spend.md`. Stop the server and the browser.

## Time limits
- Whole gate: 75 min.
- Each reply: 60 s.
- If anything hangs, save the last 50 lines of `server.log` and the process state, stop, and report it as a defect.
- Never wait on a process by matching its command line.
- At most 30 real chat turns and 3 real case submissions.

## Report `docs/qa/G3/report.md`
- Date, commit, environment.
- A per-turn table: case, message type, expected, actual, update?, calls measured vs expected, duration.
- Console, brand comparison.
- Defects (severity, repro, expected vs actual), with model-judgement deviations listed separately as observations.
- Verdict PASS or FAIL.

## Rules
Do not edit app code. Never read `.env*`. Do not commit or stage.

## Final message (≤ 30 lines)
Verdict, turn summary, call table, defects, evidence paths.
