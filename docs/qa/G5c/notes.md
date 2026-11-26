# G5c gate: fast path in a real run (2026-11-26)

Config: own server `next start -p 3001` with `FAST_PATH_THRESHOLD=0.3` (verification only; production stays 0.8). Ready in 556 ms. Log: `docs/qa/G5c/server.log`. Browser: playwright-cli 1440x900. Port 3000 server (pid 583540) not touched; no build run.

| # | Photo | Days | Route | Decision | Gate reasons | Screenshot |
|---|---|---|---|---|---|---|
| 1 | phone-3.jpeg (Smartfon "Smartfon", Zwrot, no reason text) | 5 | fast | Akceptacja | none (escalationReasons []) | a1-result.png (form: a1-form.png) |

Only 1 of 5 allowed submissions was needed. (One earlier click on Wyślij was a client-side validation miss, because the Zwrot radio was not selected through the sr-only input; no POST, 0 upstream.)

## Evidence
- `[hsdc]` lines for the request: incoming 200 -> upstream signals ok (jev-1.14, 705 ms) -> upstream writer ok (gpt-6-luna, 7841 ms). 2 upstream lines in total, no escalated line (grep count 0).
- Decision log last row (read only): route `fast`, escalationReasons [], decision Akceptacja, guardsApplied [], durations signals 708 / writer 7854.
- Uzasadnienie in UI: "Od zakupu minęło 5 dni, ... zgodnie z R-2 ... nie widać uszkodzeń ani śladów użytkowania. Rekomendujemy przyjęcie zwrotu." Rule ref R-2 listed; disclaimer "To jest wstępna rekomendacja ... a nie ostateczna decyzja" present. Side panel: Akceptacja, 5 dni.
- Threshold note: signal confidences were damage_visible false 0.91, signs_of_use false 0.84, condition 5 at 0.74, photo_usable 0.86. Condition 0.74 is below the production 0.8, so with the default threshold this case would have escalated; the gate opened only because of 0.3.
- Console: 0 errors, 0 warnings.
- Cleanup: server (pids 585054 pnpm, 585082 next-server) stopped, browser closed, port 3001 free.

## Verdict: OBSERVED (at threshold 0.3 only)
