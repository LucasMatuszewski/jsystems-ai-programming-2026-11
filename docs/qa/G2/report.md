# G2 manual gate: first decision

Date 2026-11-26, commit 0af43d5 (branch feat/app-implementation), Linux, `pnpm build` + `pnpm start`, playwright-cli, desktop 1440x900 and mobile 360x780. Build: 0 warnings. Drift check: exit 0 (structure identical).
Verdict: PASS with minor observations.

| Scenario | Result | Decision + rules | Duration | POST / upstream (budget 1 / 2) |
|---|---|---|---|---|
| a Return laptop-2.webp, 10 d | OK; /chat, summary panel complete (10 days), order greeting, badge+disclaimer, summary/justification/steps | Weryfikacja ręczna, R-2, R-8 | about 17 s | 1 / 2 |
| b Complaint phone-1.jpg, 400 d | OK; C-rules | Weryfikacja ręczna, C-6, C-5 (no Akceptacja, so no remedy check) | about 36 s | 1 / 2 |
| c Return 45 d, laptop-1.png | OK; complaint suggestion | Odrzucenie, R-4 | about 25 s | 1 / 2 (signals + writer) |
| d Telewizor + phone-3.jpeg | OK; photo advice | Weryfikacja ręczna, R-3, R-8 | about 27 s | 1 / 2 |
| e Invalid fields | errors under fields, focus on first invalid, values kept | n/a | n/a | 0 / 0 |
| f Refresh /chat | identical snapshot | n/a | n/a | 0 / 0 |
| g New case cancel + confirm | cancel keeps chat; confirm gives empty form | n/a | n/a | 0 / 0 |
| h Invalid key | banner with exact text, data and photo kept; retry = exactly 1 more POST | n/a | n/a | 2 POST / 4 upstream (401 errors, cost 0) |
| i Mobile 360 | one submission OK, summary collapsed, no horizontal scroll seen | Weryfikacja ręczna, R-2 | about 28 s | 1 / 2 |
| j Keyboard only | Tab/Space/Enter + type, OK | Weryfikacja ręczna | about 26 s | 1 / 2 |

Console: 0 errors in all scenarios. Real submissions: 6 valid + 2 failed (limit 10).
Brand: neo-brutalist borders/shadows, Bangers headings, cream background, yellow badge, logo in header; consistent with design guidelines (visual check only).
Spend: usage 0.1115 before and after (BYOK, costUsd 0).

## Observations / defects
1. Low: scenario a justification does not state the day count itself (it is in the summary: "10 dni"). AC-22/23 wording may require it in the justification.
2. Low: scenario b is Weryfikacja ręczna, so the AC-28 remedy was not exercised. Decision is model-chosen.
3. Info: progress texts: only "Przygotowanie rekomendacji…" observed (CLI polling is about 3 s; other stages not caught).
4. Info: date input is locale-segmented (dd.mm.rrrr); typing ISO digits via keyboard gives garbage; segment order must be used. Not a defect.
5. Info: playwright `click` on the hidden radio input retries (covered by label); the label click works.
6. Info: `/` redirects to `/chat` while a session exists (intended).
