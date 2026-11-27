# G4 — Final manual regression

**Verdict:** PASS, with minor observations. There is no medium or high defect.

- **Date and commit:** 2026-11-26, 16:34–16:55, commit 54427e5.
- **Tester:** independent Sonnet QA subagent. The report was transcribed by the orchestrator because the subagent could not write files.
- **Build:** exit 0, 0 warnings.
- **Drift `--compare`:** exit 0, structure identical.
- **Server:** ready in 422 ms.
- **Spend:** usage USD 0.1115 before and after (BYOK, every `costUsd` 0).
- **Cleanup:** the server and browser are stopped, and port 3000 is free.

## Totals
- 10 real submissions (limit 12) and 15 chat POSTs (limit 30).
- Server log:
  - 25 incoming lines (10 cases + 15 chat);
  - 19 chat-step lines (15, plus 4 extra steps on the update turns);
  - 0 non-ok upstream calls and 0 errors or warnings.
- Console: 0 errors on every screen.
- Mobile: `scrollWidth` = `clientWidth` = 360 on every screen.
- `eval` was used only for read-only measurements.

## Desktop 1440×900
Calls are POSTs / upstream lines; the budget is 1 / 2 per submission.

| Scenario | Result | Calls |
|---|---|---|
| a Return, laptop-2.webp, 10 d | Weryfikacja ręczna, R-2/R-8, ~20 s | 1/2 |
| b Complaint, phone-1.jpg, 400 d (double-click on submit) | Odrzucenie, C-3/C-5 | 1/2 (one POST only) |
| c Return, laptop-1.png, 45 d | Odrzucenie, R-4, complaint suggested | 1/2 (signals + writer) |
| d Telewizor + phone-3.jpeg | mismatch flagged, Weryfikacja ręczna | 1/2 |
| e Invalid fields (empty, short model, future date, short reason, logo.svg, 11 MB file) | inline errors, focus on the first invalid field, values kept | 0/0 |
| f Refresh /chat | identical | 0 |
| g New case | cancel keeps the chat, confirm gives an empty form | 0 |
| h, i Extra complaints (AC-28 attempts) | Weryfikacja ręczna both times | 1/2 each |
| j Return 5 d, cracked phone-1.jpg | Weryfikacja ręczna | 1/2 |
| k Keyboard-only return | submitted | 1/3 (designed retry, see D3) |

**Chat**
- Return case, 5 turns: clarifying, new fact (no update), the D1 date claim, insisting, injection.
- Complaint case, 5 turns: clarifying, new fact (update card), insisting, injection, a service-protocol fact.
- Plus 1 keyboard-only turn.
- Each turn was 1 POST and 1 chat-step; the update turns had 2 steps.

**D1 regression: PASS.** Return case at 10 days, then "Laptop dostałem 40 dni temu":
- no update card;
- the panel stays on Weryfikacja ręczna;
- the reply says the form date (10 dni) counts and points to a new case or customer service.

Calls: 1 POST and 2 steps; the guarded update was rejected.

**Update cards:** 3 real ones, each showing previous → new, the reason, the rules and the disclaimer, and each updating the panel and badge:
- desktop complaint: Odrzucenie → Weryfikacja ręczna;
- mobile return: Akceptacja → Weryfikacja ręczna;
- mobile complaint: Odrzucenie → Weryfikacja ręczna.

## Mobile 360×780
- The summary is collapsed (case type + badge) and expands on tap.
- The new-case dialog works.
- Return: Akceptacja, 2 turns, update card. Complaint: Odrzucenie, 2 turns, update card.
- Calls stayed within the budget, and there is no horizontal scroll.

## COVERAGE "Manual only (G4)" checklist

**PASS**
- AC-01: field order.
- AC-03: 9 category options.
- AC-09: an 11 MB file shows "Plik przekracza limit 10 MB." with 0 POSTs; an SVG shows the format error.
- AC-11: consent text.
- AC-13: a double-click sends 1 POST.
- AC-17.
- AC-21: message order.
- AC-24: a cracked phone at 5 days is not rejected for its condition.
- AC-27: phone as TV, laptop as tablet, and iOS vs Samsung all give Weryfikacja ręczna.
- AC-29.
- AC-31: Markdown is rendered.
- AC-32: Shift+Enter adds a newline; 2001 characters are blocked with 0 POSTs.
- AC-35, AC-36.
- AC-40: `decision-log.jsonl` contains no customer text.
- AC-44.
- AC-46: Tab, Shift+Tab, Space, Enter and typing are enough for a full submission and one chat turn.

**n/a**
- AC-07 (camera): the input accepts image/jpeg, png and webp, one file, with no `capture` attribute. A real phone is needed to test it.

**PARTIAL**
- AC-23: the day count is always in "Podsumowanie" and the panel, but **not** in the "Uzasadnienie" section (7 of 7 cases checked). It does appear in update cards and replies.

**NOT EXERCISED**
- AC-28: 2 extra complaint submissions and 1 chat attempt all gave Weryfikacja ręczna, so the model never chose Akceptacja for a complaint.

## Brand (computed styles at 1440)
Matches the tokens:
- background cream #fff9eb and ink #101820;
- header 79 px high with a 3 px border, logo 35 px high on the left;
- Bangers for headings and buttons, Atkinson for body text;
- inputs with 3 px borders and 8 px radius;
- red button with 7 px radius and a 4px 4px 0 hard shadow;
- cards with a 6 px hard shadow;
- blue agent and yellow client bubbles with asymmetric radii;
- mobile is consistent.

Deviations (all low):
- no dot-grid background and no nav/theme buttons;
- the logo sits at x=24 (full-width header) instead of in the centred container;
- the case-type card titles use Atkinson rather than Bangers, with no yellow eyebrow;
- the select is 36 px high while inputs are 48 px;
- labels and the character counter are small;
- the update card's previous → new line is small grey text.

## Defects
| # | Sev | Finding |
|---|---|---|
| D1 | low | AC-23: the day count is not in the justification section (known gap; the T29 fix in progress accepts it anywhere in the body) |
| D2 | low | Raw enum "Kategoria: tv" in a Polish message (scenario d); ISO date "2026-11-21" in messages vs dd.mm.yyyy in the panel |
| D3 | note | The keyboard submission (requestId bac27dfb) made 3 upstream calls (signals, escalated, escalated). This is the designed single retry (ADR-001 §3.5), 1 of 10 submissions, about 34 s |
| D4 | info | The mismatch next steps say "prześlij zdjęcie telewizora" and refer to "powyższą wskazówką", which points to nothing, without saying that a new photo needs a new case (PRD 4.6) |
| D5 | info | Only the progress text "Przygotowanie rekomendacji…" was seen; "Przesyłanie…" and "Analiza…" were never caught |

## Model-judgement notes
- Complaint b was Odrzucenie here but Weryfikacja ręczna in G2.
- On mobile, a question triggered an update (arguably it contained a new fact).
- No return update card appeared on desktop.
- Akceptacja was never chosen for a complaint.
- Replies address the user as "Pan" regardless of who they are.

## Evidence (`docs/qa/G4/`)
- `status-before.txt`, `status-after.txt`, `drift.txt`, `build.log`, `server.log`.
- Desktop screenshots `d-*.png`: form empty, filled, errors and oversize; progress; chats a–e; D1; update card; mismatch; 2001 characters; new-case dialog; refresh; keyboard focus.
- Mobile screenshots `m-*.png`: form, progress, summary collapsed and expanded, return update, complaint, dialog.
- The temporary 11 MB test file and the playwright-cli snapshots were moved out of the repo by the orchestrator.
