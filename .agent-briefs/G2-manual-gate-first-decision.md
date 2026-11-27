# Brief G2 — Manual verification gate: first decision

You are the QA tester. Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read `app/AGENTS.md`, plan §4 (gate protocol) and the G2 row in `docs/plans/decision-copilot-poc-implementation-plan.md`, ADR-006 §3.2–3.5, PRD §4.1–4.7, §6 Form/Image/Decision/Disclaimer/Session/Errors, §9, `docs/design-guidelines.md`. Decision model = `typesafe/jev-1.14` (ADR-001 §10 A2). Call budget per valid submission = 2 upstream lines (signals + escalated or writer; +1 only for a logged retry).

## Protocol
1. `cd app && pnpm openrouter:status` → `docs/qa/G2/status-before.txt`. `pnpm record:openrouter --compare` → `docs/qa/G2/drift.txt` (must exit 0).
2. `pnpm build` (0 warnings) and `pnpm start` in the background with logs to `docs/qa/G2/server.log`.
3. Use `playwright-cli` interactively, one command at a time, deciding after every `snapshot`. Not allowed: `run-code`, `eval`, `route`, pre-written sequences, or the E2E suite. Use desktop 1440×900 unless stated otherwise. Scenarios:
   a. **Return**: laptop, `../assets/example-images/laptop-2.webp`, 10 days ago, no reason. Check the progress texts, landing on `/chat`, the summary panel fields (AC-36), and the first bubble order: greeting → badge with the disclaimer attached → summary, justification, next steps. Check the justification cites ≥ 1 R-rule and one image observation, and states the day count (AC-22/23). Check it is Polish, and record how long it took (≤ 90 s).
   b. **Complaint**: smartphone, `phone-1.jpg`, ~400 days ago, reason ≥ 20 chars typed by you. Check for C-rules, and a remedy if Akceptacja (AC-28).
   c. **Return after 45 days** (`laptop-1.png`, JPEG bytes named .png, AC-08) with a defect described in the reason: expect Odrzucenie, R-4 and a complaint suggestion (AC-25).
   d. **Category mismatch**: category Telewizor with `phone-3.jpeg`: expect Weryfikacja ręczna and photo advice (AC-27). If the model decides differently, report it as an observation, not a test failure, unless a guard should have fired.
   e. **Invalid fields**: an empty submit, a complaint with a short reason, a future date and `../assets/logo.svg` as the photo. Check errors appear under the fields, focus moves to the first invalid field, values are kept, and there are **0** requests to `/api/cases`.
   f. **Refresh** `/chat`: identical content, 0 requests.
   g. **New case**: cancel (nothing changes), then confirm (empty form), 0 requests.
   h. **Failure + retry**: stop the server and start a second one on port 3000 with `OPENROUTER_API_KEY=sk-or-v1-invalid` in its environment (the env var wins over the root `.env`). Submit a valid case and expect the banner "Nie udało się przeanalizować zgłoszenia. Spróbuj ponownie za chwilę." with all data and the photo kept. Click "Spróbuj ponownie" and check exactly 1 more POST. Then restart the server with the real key.
   i. **Mobile 360×780**: repeat scenario a (one submission) and check there is no horizontal scroll, the summary is collapsed by default, and the screens look right.
   j. **Keyboard only**: fill and submit the form with `press Tab/Space/Enter` and `type` only (AC-46). One submission.
4. After each action, compare `playwright-cli requests` (browser → app) and the `[hsdc]` lines in `server.log` (app → OpenRouter) with the budget: 0 for e, f, g, and 1 POST + 2 upstream lines per valid submission. Also run `console` (0 errors).
5. Screenshots (PNG in `docs/qa/G2/`): form empty and with errors, progress, chat for a/b/c/d (desktop), the failure banner, mobile form and chat, and the new-case dialog. Compare them with `assets/homepage-desktop.png` / `homepage-mobile.png` and `docs/design-guidelines.md` (colours, fonts, borders, shadows, logo, bubbles).
6. `pnpm openrouter:status` again → `status-after.txt`; append a "G2 gate" row to `docs/qa/spend.md`. Stop all servers and close the browser.

## Report `docs/qa/G2/report.md`
Date, commit, environment. A per-scenario table: steps, result, decision + rules, duration, measured vs expected calls. Then console, brand comparison, defects (severity, repro, expected vs actual), and a verdict (PASS or FAIL). At most 10 real submissions.

## Rules
Do not edit app code; report defects. Never read `.env*`. Do not commit or stage.

## Final message (≤ 30 lines)
Verdict, scenario table summary, call table, spend delta, defects, evidence paths.

## Time limits (mandatory)
- Check `ps` first: no leftover `next-server` or `playwright`, and port 3000 free.
- Wrap `pnpm build` in `timeout 5m` and the recordings/status scripts in `timeout 10m`.
- Start the server in the background with its output in `server.log`, and check that it answers within 60 s.
- If a step takes more than 3× its expected time, or `next-server` uses high CPU while idle, stop and report it as a defect with the last 50 lines of `server.log`. Do not keep waiting.
- Total budget for the gate: 60 min.
