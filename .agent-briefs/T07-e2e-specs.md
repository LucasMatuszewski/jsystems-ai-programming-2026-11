# Brief T07 — E2E acceptance specs (expected to fail until wired)

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read `app/AGENTS.md` and `app/playwright.config.ts` (projects `desktop` 1440 px and `mobile` 360 px, webServer `pnpm build && pnpm start`).

## Goal
Playwright specs in `app/tests/e2e/` that encode PRD flows 4.1–4.7 against the REAL stack (real OpenRouter, nothing mocked). The features don't exist yet, so every new test is annotated `test.fail()` and the run is green. Wiring tasks (T22, T25) remove the annotations later.

Sources: PRD §4 (flows 4.1–4.7), §6 ACs, §9 UI; `docs/ADR/000-main-architecture.md` §10 (key scenarios, TAC-04/05/06); `docs/ADR/003-frontend-chat-ui.md` §3 (routes, components), §8 (TAC-003-03/04/05); `docs/ADR/002-backend-api.md` §4–5. Strings come ONLY from `app/lib/i18n/pl.ts` (import `pl`). Read `app/lib/schemas/**` for enums.

## Spec files (one per flow group)
- `form-validation.spec.ts` (4.4): empty submit → errors under fields, focus on the first invalid one, 0 requests to `/api/cases` (track with `page.on("request")`); complaint without reason; future date; `../assets/logo.svg` → the unsupported-type message; `laptop-1.png` (JPEG bytes) accepted, thumbnail + file name + "Zmień zdjęcie"; values kept after errors. Keyboard-only completion of the form (AC-46).
- `return-flow.spec.ts` (4.1): Zwrot, Laptop, purchase date 10 days ago, `laptop-2.webp` → progress texts → `/chat` within 90 s (TAC-05) → first bubble shows a greeting, a decision badge whose text is one of the 3 decisions with the exact `pl.disclaimer`, at least one `R-` rule reference, Polish text. Assert structure and invariants only, never a specific verdict.
- `complaint-flow.spec.ts` (4.2): Reklamacja, Smartfon, 400 days ago, reason ≥ 20 chars, `phone-1.jpg` → decision in the enum, `C-` rule; if Akceptacja, a remedy is named.
- `date-rule.spec.ts`: Zwrot 45 days → Odrzucenie and R-4.
- `session.spec.ts` (4.7): after a successful case, reload `/chat` → same messages in order (TAC-003-03); "Nowe zgłoszenie" → cancel keeps everything; confirm → empty form at `/`; direct visit to `/chat` without a session → redirected to `/`.
- `chat.spec.ts` (4.3, AC-31–AC-37): send "Jaki model urządzenia zgłosiłem?" → the reply contains the model from the form; Enter sends, Shift+Enter adds a newline; input disabled while streaming; the newest message is in view.
- `responsive-a11y.spec.ts` (AC-45/46): `document.documentElement.scrollWidth <= window.innerWidth` on `/` and `/chat` (TAC-003-04); axe (`@axe-core/playwright`) with no serious or critical violations on both pages (TAC-003-05); on mobile the case summary is collapsed by default.
- Failure + retry (AC-41) needs an invalid key and is NOT written here (a dedicated project is added later); mention it in the coverage table as pending.
Share helpers in `app/tests/e2e/helpers.ts` (fill form, `daysAgo(n)` in Europe/Warsaw, submit, wait for `/chat`). Use role-based selectors (`getByRole`, `getByLabel`) with `pl` strings. Uploads use only `../assets/example-images/` and `../assets/logo.svg`. No `page.route`, no mocking of any kind.

## Annotation and proof
- Every test that needs unbuilt features: `test.fail()` at the top. `tests/e2e/smoke.spec.ts` stays as is.
- Run `pnpm test:e2e` and confirm the run is green (expected failures count as passed). The specs that submit a case should fail fast (element not found) without calling OpenRouter, because the form does not exist yet. Confirm no `/api/cases` call is made (the route doesn't exist). Keep the per-test timeout short for missing elements (`expect` timeout 5 s in helpers) so the red run is quick.
- Proof: temporarily remove one `test.fail()` locally, run that spec, copy the failure line ("element not found"/timeout) into the report, then restore the annotation.
- Add `app/tests/e2e/COVERAGE.md`: a table AC → spec/test name (AC-01…AC-46), marking which ACs are covered by component/unit tests instead or pending.

## Editable files
`app/tests/e2e/**` except `smoke.spec.ts`. Nothing else.

## Forbidden
No commits/`git add`, no config or dependency changes, no `.env*`, no mocking, no real model calls in this task (the features are missing, so none should happen; verify with the server log).

## Report (≤ 30 lines)
Spec files and test counts · run result (passed / expected-fail counts per project) · proof of one real failure · coverage gaps.
