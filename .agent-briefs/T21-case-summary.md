# Brief T21 — CaseSummaryPanel and NewCaseDialog

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read `app/AGENTS.md`. Targeted tests: `pnpm exec vitest run <paths>`.

## Goal
- `app/components/case-summary/case-summary-panel.tsx`: `CaseSummaryPanel({ payload: CaseSessionPayload, currentDecision: { decision, ruleRefs }, onNewCase(): void })`. It shows the case type, category (Polish labels from `pl`), model, purchase date (dd.mm.yyyy), days since purchase, and the photo thumbnail (`<img alt=…>`; click → a dialog with the larger image, ADR-002 §3 rule 5). It also shows the current decision as a compact badge (text + icon, same visuals as the decision card; reuse `DecisionCard` from `app/components/chat/decision-card.tsx` only if it exists when you finish, otherwise make a small `DecisionBadge` here) and the "Nowe zgłoszenie" button.
  - Desktop (≥ 768 px): a static left column panel.
  - Mobile (< 768 px): a collapsible panel (shadcn `components/ui/collapsible.tsx` exists), **collapsed by default**, whose trigger shows only the case type and the current decision badge (PRD §9.3).
- `app/components/case-summary/new-case-dialog.tsx`: `NewCaseDialog({ open, onOpenChange, onConfirm })`. Text `pl.newCase.confirm`, buttons `pl.newCase.confirmButton` / `pl.newCase.cancelButton`. Use an accessible dialog: copy a shadcn Dialog primitive into `app/components/ui/dialog.tsx` from the same base-ui pattern the other `components/ui` files use (no CLI, no installs; report it). Focus is trapped and restored, and Escape cancels.
- Brand: card style (3 px border, hard shadow, `rounded-card`), Bangers only for headings and buttons, semantic tokens only.

Sources: PRD §9.3, AC-36, AC-39, §4.7; ADR-003 §3.2 (CaseSummaryPanel, NewCaseDialog); design-guidelines.

## Tests (first, red, then green) `app/tests/component/case-summary/*.test.tsx`
Use the REAL `CaseSessionPayload` from `app/tests/fixtures/app/cases/escalated-return-laptop-2.ndjson.json` and `escalated-complaint-phone-1.ndjson.json` (parse the `result` event). Assert all AC-36 fields; the thumbnail is clickable and opens a larger view; "Nowe zgłoszenie" opens the dialog; cancel → `onConfirm` not called and nothing changes; confirm → `onConfirm` called once; the mobile collapsed-by-default trigger shows type and decision (test the collapsible state, since jsdom has no media queries: give the component a `variant="mobile"|"desktop"` prop or render both and test the mobile one).

## Editable files
`app/components/case-summary/**`, `app/components/ui/dialog.tsx` (new), `app/tests/component/case-summary/**`. Nothing else.

## Forbidden
No commits/`git add`, no dependency changes, never read `.env*`, no network.

## Report (≤ 20 lines)
Files · props · red→green counts · typecheck/lint.
