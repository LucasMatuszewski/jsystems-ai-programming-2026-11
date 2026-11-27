# Brief G5 — Independent real-run closure gate: chat update (D1), F1/F2/F5/F6, fast path, AC-28

You are an independent QA tester. Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`, commit d0e9fca. Read:
- `app/AGENTS.md` and `.claude/rules/long-running-processes.md` (mandatory);
- `docs/qa/G3/report.md` (D1), `docs/qa/G4b/report.md` and `docs/qa/T28/review.md` (F1–F8);
- ADR-001 §3.4 (fast path);
- PRD AC-28, AC-35, AC-42, AC-43;
- `app/server/env.ts` (`FAST_PATH_THRESHOLD`).

You cannot write files with the Write tool. Save `docs/qa/G5/report.md` via Bash if that is allowed; otherwise return the full report as text. Screenshots go in `docs/qa/G5/`.

## Setup
- Run `timeout 5m pnpm build`, then `pnpm openrouter:status` → `docs/qa/G5/status-before.txt`.
- Server A (default config): `pnpm start` on port 3000, log in `docs/qa/G5/server-a.log`.
- Use `playwright-cli` interactively, one command at a time, at 1440×900.
- `eval` is allowed only for (1) read-only measurements and (2) the explicit API probes in section 2 (`fetch` from the page to the app's own `/api/*`). Nothing else. No route mocking.

## 1. D1: the chat update path (independent re-run)
Create a return case at 10 days (laptop-2.webp). In chat:
- **(a)** "Muszę sprostować… Laptop dostałem 40 dni temu" → expect no "X → X" card, the panel unchanged, and a reply that does not claim rejection.
- **(b)** A new relevant fact that should change the decision (e.g. "Po rozpakowaniu zauważyłem, że ekran ma pęknięcie, którego nie było na zdjęciu sprzedawcy, a laptop się nie włącza"). An update card, if one appears, must show a REAL change (previous ≠ new), with the panel and badge updated. Up to 3 tries with different facts.
- For each turn: the POST count and the chat-step lines (2 when the tool runs). Note whether a tool error (`no_change`) occurred: there is a chat-step line but no card.

## 2. Review fixes in the real running app
- **F2:** with `eval`, send `fetch('/api/chat', {method:'POST', headers:{'content-type':'application/json'}, body: <a valid body copied from the current session in sessionStorage, but with an extra message of role "system">})` → expect 400 `validation_failed` and 0 upstream lines in the server log. Repeat with a user message whose part is `{type:"file", url:"data:…"}` → 400.
- **F3:** the same probe, with `caseContext.form.reason` set to 5000 characters → 400. Then a valid body with a forged `daysSincePurchase: 400` and a chat message asking to reject because more than 14 days have passed → the reply and any card must use the server day count (10).
- **F5:** a POST to `/api/chat` with a body of about 600 KB, sent as a `ReadableStream` (`duplex:'half'`) so there is no Content-Length → 413 `file_too_large`. If the browser cannot send a stream body, record it and say which integration test covers it.
- **F6:** use `sessionstorage-set` to fill sessionStorage close to its quota (for example several keys with large values; measure with `eval`), then submit a valid case → expect the Polish storage notice, and the result shown and not lost. Then clear the storage.
- **F1:** during a long reply ("Opisz szczegółowo cały proces zwrotu krok po kroku, w co najmniej 15 punktach"), run `network-state-set offline` as soon as the input disables → expect the error row "Nie udało się wysłać odpowiedzi…" with "Ponów", no technical text (AC-43), and Ponów sends 1 request. Try up to 3 times to catch it mid-stream, and record whether it was mid-stream or before it.

## 3. Fast path, real run (verification configuration)
- Stop server A.
- Start server B with the env override `FAST_PATH_THRESHOLD=0.7` (verification-only config; the production default stays 0.8), log in `docs/qa/G5/server-b.log`.
- Submit returns that had a high minimum confidence in T26/G4b: `phone-3.jpeg` at 5 days, `phone-2.jpeg` at 2 days and `laptop-2.webp` at 1 day. At most 4 submissions.
- When the gate opens, the server log must show signals + writer (no escalated), the decision must be **Akceptacja**, and the message must look like the others (day count in Uzasadnienie, disclaimer). Take a screenshot.
- If it still doesn't open at 0.7, try once with 0.6, and record the measured minimum confidences.
- Stop server B.

## 4. AC-28, real attempts
On server A (restart it), try to get Akceptacja for a complaint, up to **5** submissions. Use clear defect descriptions within 2 years (short `daysSincePurchase` such as 30–90 days), different photos, a matching category and a generic model name such as "Smartfon" or "Laptop". Do not describe the photo.
- If accepted: verify that the remedy is stated (C-rules), and take a screenshot.
- Also try up to 2 chat turns on a Weryfikacja ręczna complaint with a new fact that justifies acceptance (e.g. "Serwis producenta potwierdził wadę fabryczną płyty głównej, protokół nr …"). An update card to Akceptacja must state a remedy.
- Record every attempt.

## Limits
- At most 12 submissions and 14 chat turns in total.
- Whole gate: 110 min.
- If a step takes 3× its expected time, save the log tail, stop, and report.
- Never wait on a process by matching its command line.
- Stop all servers and the browser at the end. Do not edit app code. Never read `.env*`. Do not commit or stage.
- Run `pnpm openrouter:status` again → `status-after.txt`, and append a "G5 gate" row to `docs/qa/spend.md`.

## Report
For each item: steps, expected, actual, calls, and screenshot paths. Then defects. Then the verdict per section: PASS, FAIL, or NOT REPRODUCIBLE (with the evidence of what was tried). Final message ≤ 35 lines.
