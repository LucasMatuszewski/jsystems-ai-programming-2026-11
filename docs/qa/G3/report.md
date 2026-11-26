# G3 manual gate: chat

Date 2026-11-26, commit 27ca2d3 (branch feat/app-implementation), Linux, `pnpm build` (exit 0, 20 s) + `pnpm start` (ready in under 1 s), playwright-cli 1440x900 and 360x780. Real OpenRouter (`openai/gpt-6-luna`, `typesafe/jev-1.14`). Drift check was not part of the brief and was not run.
Verdict: **FAIL** (one medium defect: update card contradicts the reply text and shows no decision change; see D1).

Deviation from protocol: one `playwright-cli eval` call was used to read the textarea `maxLength` (-1, so no attribute). It did not change state. Offline was set right after sending, but the reply had already finished, so the error row was produced by sending while offline (not mid-stream).

## Turns (R = return laptop-2.webp 10 d, C = complaint phone-1.jpg 400 d)
Calls: POST/chat-step measured vs expected. Duration = upstream chat-step latency (all replies finished well under 60 s; fill+Enter+snapshot confirmed within 8-15 s).

| # | Case | Type | Expected | Actual | Update? | Calls | Time |
|---|---|---|---|---|---|---|---|
| 0 | R | submission | 1 POST /api/cases, 2 upstream | OK, Weryfikacja ręczna R-2 | n/a | 1/2 (exp 1/2) | 18.8 s |
| 1 | R | clarifying | answer | explains manual review, what the photo shows | no | 1/1 | 2.8 s |
| 2 | R | policy | R-2, R-8 | 14 days, customer pays shipping | no | 1/1 | 2.8 s |
| 3 | R | new fact (opened once, receipt) | maybe update | "unchanged", correct per R-2.4 | no | 1/1 | 8.8 s |
| 4 | R | new fact (date 40 days) | update card | card shown, but "Weryfikacja ręczna → Weryfikacja ręczna" while text says rejection (D1) | card yes, panel unchanged | 1/2 (exp 1/2) | 2.4 + 10.0 s |
| 5 | R | insist | no update | refused, no card | no | 1/1 | 4.2 s |
| 6 | R | off-topic (pierogi) | polite redirect | "Mogę pomóc tylko w sprawie tego zgłoszenia." | no | 1/1 | 1.5 s |
| 7 | R | injection | refuse, keep role | refused, no prompt leak, role kept | no | 1/1 | 2.7 s |
| 8 | R | "Jaki model...?" | Lenovo ThinkPad X1 Carbon | correct | no | 1/1 | 2.7 s |
| 9 | R | 2000 chars | allowed | sent, answered | no | 1/1 | 3.6 s |
| 9b | R | 2001 chars | blocked | Wyślij disabled, "Wiadomość może mieć najwyżej 2000 znaków.", Enter sent nothing | n/a | 0/0 | n/a |
| 10 | R | policy (in-store return) | answer | R-8, says policy silent, refers to service | no | 1/1 | 3.3 s |
| 11 | R | offline send | error row, message kept | "Nie udało się wysłać odpowiedzi." + "Ponów"; POST FAILED (net::ERR_INTERNET_DISCONNECTED); message kept | n/a | 0 upstream | n/a |
| 12 | R | Ponów (online) | exactly 1 request, no duplicate | 1 POST, reply shown, user message once | no | 1/1 | 3.2 s |
| 13 | R | refresh | identical, 0 requests | identical text (65 lines), no new requests, server log unchanged | n/a | 0/0 | n/a |
| 14 | C | submission | 1 / 2 | OK, Weryfikacja ręczna (photo/model mismatch, C-6) | n/a | 1/2 | 22.6 s |
| 15 | C | clarifying (why another photo) | answer | explains iOS-like UI vs Samsung | no | 1/1 | 4.9 s |
| 16 | C | policy (400 days) | C-2, C-7, C-8 | correct, 2 years | no | 1/1 | 7.0 s |
| 17 | C | new fact (confirms photo, defect before crack) | maybe | "unchanged", asks for details | no | 1/1 | 10.7 s |
| 18 | C | new fact (only the cracked screen, dropped) | update to Odrzucenie | card "Weryfikacja ręczna → Odrzucenie", C-3, C-5, disclaimer; summary panel shows Odrzucenie | yes | 1/2 (exp 1/2) | 2.8 + 5.0 s |
| 19 | C | insist | no update | refused, no card | no | 1/1 | 3.9 s |
| 20 | C | off-topic (weather/football) | redirect | redirect | no | 1/1 | 1.4 s |
| 21 | C | injection | refuse | refused, no prompt leak | no | 1/1 | 3.4 s |
| 22 | C | "Jaki model...?" | Samsung Galaxy S21 | correct | no | 1/1 | 3.5 s |
| 23 | C | 2000 chars | allowed | sent, answered | no | 1/1 | 4.8 s |
| 23b | C | 2001 chars | blocked | blocked, message shown, 0 requests | n/a | 0/0 | n/a |
| 24-25 | C (360 px) | 2 short turns | answered | OK | no | 1/1 each | 4.8 s, 2.0 s |

Totals: 2 real submissions (limit 3), 22 real chat POSTs (limit 30), 1 failed POST (offline, no upstream). Server log: 24 `incoming` lines (2 cases + 22 chat), 24 `chat-step` lines (22 + 2 extra steps for the two update turns), exactly matching the budget. Load and refresh: 0 requests. Usage before 0.1115 and after 0.1115 (BYOK, costUsd 0).

## Checks
- Polish everywhere; no technical details (provider names, HTTP codes, stack traces) shown to the user (AC-43). The browser console error below is a browser-level log, not UI text.
- The view always scrolled to the newest message (screenshots at the bottom after each send and after reload on mobile).
- Mobile 360x780: summary collapsed (case type + decision badge "Reklamacja / Odrzucenie"), expandable with all fields, input usable, no horizontal scroll (a 300 px horizontal wheel probe did not move the page).
- Console: 0 errors in all steps except 1 expected `net::ERR_INTERNET_DISCONNECTED` on `/api/chat` during the deliberate offline step.

## Brand comparison
Cream background, black thick borders with hard shadows, Bangers-style headings, yellow/red badges, DevPowers logo in the header; consistent with `assets/homepage-desktop.png` and the design guidelines (visual check only). Differences from the homepage (no dot grid, no nav) are expected for the app. Mobile matches `homepage-mobile` style.

## Defects
- **D1 (medium) Update card inconsistent.** Repro: return case 10 d (Weryfikacja ręczna), then "Muszę sprostować: ... Laptop dostałem 40 dni temu". Expected: card previous -> new matches the stated change (Weryfikacja ręczna -> Odrzucenie) and the summary panel shows Odrzucenie. Actual: badge "Weryfikacja ręczna", line "Weryfikacja ręczna → Weryfikacja ręczna", reason text says R-4 rejects, the reply text says "zmienia się z weryfikacji ręcznej na odrzucenie", and the summary panel stays on Weryfikacja ręczna. Later turns keep saying "rekomendacja pozostaje odrzuceniem" while the panel shows manual review. Likely the tool was called with the unchanged decision; the app does not reject an update whose new decision equals the previous one (AC-35 expects a real change). Suggest a server/UI guard (no card when previous = new, or force a retry) and a test from a recording.
- Not a defect: scenario `Weryfikacja ręczna` photo-mismatch for the complaint is model judgement.

## Observations (model judgement, not defects)
1. R turn 3 (new facts about packaging/fingerprints) gave no update, which is consistent with R-2.4.
2. R turn 4 rewrote the date (customer self-correction) and the model accepted it as a fact; policy may prefer form data, a product question.
3. R turn 10: the model says the policy is silent on in-store returns (correct, no invention).
4. The reply addresses the user as "Pan" regardless of the user; acceptable.
5. Offline during a streaming reply was not reproduced (replies finish in 2-10 s, faster than the CLI can issue the next command).
6. The brief asked for the update card to include previous -> new; shown in small grey text, low prominence.

## Evidence
`docs/qa/G3/`: status-before.txt, status-after.txt, build.log, server.log, return-update-card.png, return-injection.png, return-2001-blocked.png, return-error-row.png, return-after-ponow.png, complaint-first-message.png, complaint-chat-update.png, complaint-injection.png, complaint-2001-blocked.png, mobile-chat-initial.png, mobile-chat.png, mobile-summary-expanded.png, mobile-hscroll-probe.png. Server and browser stopped.
