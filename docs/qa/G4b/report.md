# G4b — Independent manual re-check after the T29 fixes, plus the open ACs

**Verdict:** Part A PASS with 1 low defect (G4b-1, fixed in G4b-1 follow-up).

- **Date and commit:** 2026-11-26, commit 9796029.
- **Tester:** independent Sonnet QA subagent. The report was transcribed by the orchestrator because the subagent could not write files.
- **Build and server:** `pnpm build` exit 0; server ready in 522 ms.
- **Totals:** 11 real submissions (limit 14) and 5 chat turns (limit 12).
- **Console:** 0 errors, 0 warnings.
- **`server.log`:** 16 incoming lines (11 cases + 5 chat) and 29 upstream lines (11 signals + 12 escalated + 6 chat-step), with 0 errors.
- **Spend:** USD 0.1138 before and after (BYOK).
- **Covering tests:** the orchestrator re-ran the files cited below: 10 files, 131 tests, all passed.

## A. T29 fixes in the real app (1440×900)
| Item | Result | Evidence |
|---|---|---|
| AC-23 return, escalated route | PASS | laptop-2, 10 d: "Od zakupu minęło 10 dni." in Uzasadnienie, panel shows 10 |
| AC-23 return, writer route | n/a | The fast-path gate never opened (see B2). Covered by `tests/integration/pipeline/run-case-pipeline.test.ts` and `tests/unit/pipeline/body-checks.test.ts` |
| AC-23 complaint | PASS | phone-1, 200 d: "minęło 200 dni" in Uzasadnienie, panel shows 200. The plurals "2 dni", "3 dni" and "5 dni" are correct |
| D2 | PASS | "Kategoria: Telewizor", "Laptop"; dates 16.11.2026 and 23.11.2026 |
| D4 | PASS | Telewizor + phone-3: a correct photo goes into a new case via "Nowe zgłoszenie", with no dangling reference |
| F3 | PASS | Chat "kupiłem 23.11.2026": no update card; the reply says the form date (10 dni) counts; the panel is unchanged |
| F7 | PASS | One turn with two new facts gave exactly 1 update card (Akceptacja → Weryfikacja ręczna) and 2 chat-steps |
| F6 | n/a | sessionStorage cannot be blocked without mocking; covered by component tests in `tests/component/case-flow/` and `tests/component/submission/` |
| F1, F2, F5 | covered by integration tests | `tests/integration/api-chat/` (timeout, validation, stream) and `tests/integration/api-cases/` (validation, stream) |
| Mobile 360×780 | PASS | Return laptop-2, 4 d: summary collapsed (`aria-expanded=false`), 1 chat turn answered, `scrollWidth` = `clientWidth` = 360 |

## B1. AC-28 (remedy when a complaint is accepted): not reproducible with the current model
| # | Inputs | Decision | Rules |
|---|---|---|---|
| 1 | Samsung Galaxy S24 + phone-1, 200 d | Weryfikacja ręczna | C-6, C-5 |
| 2 | iPhone 13 + phone-1, 150 d | Odrzucenie | C-3, C-5, C-9 |
| 3 | S24 Ultra + phone-3, 100 d (restarts, battery) | Weryfikacja ręczna (designed retry, 3 upstream calls) | C-6, C-9 |
| 4 | "Smartfon" + phone-2, 120 d | Weryfikacja ręczna | C-3, C-6 |
| chat ×2 | case 1: corrected model, two defects, service protocol SRV-2291 | no update | – |

Note on #1: the photo shows an iPhone but the form said Samsung, so the model-name conflict was the tester's input error.

No complaint was ever accepted. That includes G4 (3 attempts) and G2. So the remedy text could not be observed in the real app. The remedy requirement is enforced by the policy and covered by tests on recorded and derived outputs.

## B2. Fast path (signals ≥ 0.8 → writer route): not reproducible with the current model
| Return | Route | Decision |
|---|---|---|
| laptop-2, 10 d | signals + escalated | Akceptacja |
| phone-2, 2 d | signals + escalated | Akceptacja |
| laptop-2, 1 d | signals + escalated | Akceptacja |
| laptop-1, 3 d | signals + escalated | Weryfikacja ręczna (cracked screen) |
| phone-3, 5 d | signals + escalated | Akceptacja |

There were 0 writer lines, and together with T26 (0 of 10 cases) the gate never opened with Jev 1.14 confidences (maximum per-case minimum 0.77).

The gate logic is covered by `tests/unit/ai-logic/fast-path.test.ts` and `fast-path-recordings.test.ts`, which include derived variants at 0.79 and 0.8. Calibrating the threshold is a product decision (ADR-001 §3.4).

## B3. AC-07 (camera on a phone): needs a physical device
Verified at 360 px:
- `accept="image/jpeg,image/png,image/webp"`, with no `capture` attribute and `multiple=false`;
- a photo can be chosen and the case submitted.

The PRD does not require `capture`. Without it, mobile browsers offer both the camera and the gallery, which matches "the camera or the gallery". Only the native picker UI needs a physical phone.

## Calls
- Every submission: 1 POST, 2 upstream calls (signals + escalated), except one designed retry (3 upstream calls).
- Every chat turn: 1 POST with 1 step; the update turn had 2 steps.

## Defects
| # | Sev | Finding |
|---|---|---|
| G4b-1 | low | "Od zakupu minęło 1 dni." on a 1-day return (`b6-return-laptop2-1d.png`). The count matches the panel, but the singular should be "1 dzień". The body check accepts it. |
