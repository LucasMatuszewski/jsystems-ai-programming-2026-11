# T29 report: review fixes (F1-F8) and G4 additions

Phase 1: source and tests. Phase 2: build, manual check, E2E.

## Checks
- `pnpm typecheck`, `pnpm lint` (0 warnings), `pnpm test`: 54 files, 653 tests green (3 runs).
- `pnpm build`: exit 0, 0 warnings (`build.log`).
- E2E `--project=desktop --project=failure`: 29 passed (3.5 min). `--project=mobile`: 27 passed (3.4 min). Logs and server logs in this folder.
- Spend: 0.1115 -> 0.1138 USD (row appended to `docs/qa/spend.md`).

## Findings
F1 abort chunk -> masked `chat_failed`; F2 whitelist of roles and parts; F3 form schema reused, context limits, server recomputes days; F4 day count and rule IDs checked in code; F5 body limits while reading; F6 session kept in memory with a notice, own `unavailable` reason; F7 one `update_recommendation` per turn; F8 abort signal into signals. Simplifications done (one `NEUTRAL_FINDINGS`, one `httpStatusOf`).

## G4 additions (phase 2)
1. AC-23: `checkBody` looks for the day count inside the "Uzasadnienie" section only; fallback inserts there. Prompts say so (still 1.1.0).
2. D2: `renderCaseData` gives the Polish category label and dd.mm.yyyy (shared `formatPlDate`, also used by the panel).
3. D4: prompts require "Nowe zgłoszenie" wording for photo problems, no dangling references.
Recorded outputs predate AC-23, so tests use the named derived variant `withJustificationDays` (`tests/helpers/day-count-variant.ts`).

## Manual check (own server, playwright-cli, 1440 px)
- Return/laptop, 10 days: "Uzasadnienie" starts with "Od zakupu minęło 10 dni."; summary "Kategoria: Laptop", "Data zakupu: 16.11.2026" (`a-return-laptop-*.png`).
- Return/Telewizor with a laptop photo: mismatch; next steps say to file a new case with "Nowe zgłoszenie", no dangling reference; "Telewizor" label (`b-return-tv-mismatch-*.png`).
- 2 chat turns answered (`b-chat-2-turns.png`). Console: 0 errors (`console.txt`).
- Call counts from `server.log`: 2 signals, 2 escalated (no retries), 2 chat-step.
