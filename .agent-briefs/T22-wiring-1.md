# Brief T22 — Wiring increment 1: form → progress → /chat with summary and first message

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read `app/AGENTS.md`. Targeted tests: `pnpm exec vitest run <paths>`.

## Goal
A real user can open `/`, fill the case form, submit, see the progress texts and land on `/chat`. There the case summary panel and the first agent message (greeting → decision card with disclaimer → body) are shown. A refresh restores the page, "Nowe zgłoszenie" works, and a failure returns to the form with the data kept. The chat input/streaming comes in T25. In this increment `/chat` shows no input, or a disabled placeholder.

Sources: PRD §4.1, 4.2, 4.4, 4.5, 4.7, §9.1–9.3, AC-12/13, AC-36–AC-39, AC-41, AC-45; ADR-003 §3.1 (routes, no wrong-screen flash), §3.3; ADR-006 §3.2 (no effect-driven requests; Strict Mode).

## Use the existing components (do not rewrite them)
- `CaseForm`: `app/components/case-form/case-form.tsx`
- `useCaseSubmission`, `SubmissionProgress`, `AnalysisErrorBanner`: `app/components/case-submission/`
- `readSession` / `clearSession` / `deriveCurrentDecision`: `app/lib/session-store.ts`
- `MessageParts`, `DecisionCard`: `app/components/chat/`
- `CaseSummaryPanel`, `NewCaseDialog`: `app/components/case-summary/`
- the `pl` strings
Read their props first. If a component lacks something you need, report it rather than editing it. Small prop additions are OK if they are covered by its existing tests; say so.

## Tasks
1. `app/app/page.tsx` (client component inside a server page as needed):
   - Metadata title "Zgłoś zwrot lub reklamację — Hardware Service Decision Copilot".
   - On mount, read the session; if present, `router.replace("/chat")`. Render a neutral shell until the check runs (no flash).
   - Otherwise show the H1 `pl.form.title`, the intro `pl.form.intro` and `CaseForm`.
   - On submit, `useCaseSubmission.submit(values, file)` and show `SubmissionProgress` (replacing or overlaying the form).
   - On error, show the form again with `initialValues`/`initialFile` from memory, plus `AnalysisErrorBanner`, whose "Spróbuj ponownie" resubmits the same data.
   - On success, `router.push("/chat")`.
2. `app/app/chat/page.tsx`:
   - Read the session on mount; none means `router.replace("/")`.
   - Desktop: two columns, `CaseSummaryPanel` (narrow, left) and the conversation (right) rendering `session.messages` with `MessageParts` inside agent/user bubbles. Use the brand bubble styles: agent `bg-chat-agent rounded-bubble-agent`, user `bg-chat-client rounded-bubble-client`, 3 px ink border.
   - Mobile: the summary is collapsible above the conversation.
   - The message list has `role="log"`.
   - "Nowe zgłoszenie" opens `NewCaseDialog`; confirm runs `clearSession()` then `router.replace("/")`.
   - Title "Rozmowa — Hardware Service Decision Copilot".
3. Remove the template chat leftovers that are no longer used. They are tracked, so use `git rm` (allowed for you here, unlike `git add`/`commit`): `components/chat.tsx`, `chat-message.tsx`, `prompt-form.tsx`, `new-chat-button.tsx`, `message-actions.tsx`, `markdown-code.tsx` (only if unused), `status-icon.tsx`, `components/ui/trace.tsx`, `components/parts/*` (only if unused), and `lib/chat-types.ts` (if unused). Keep anything still imported. Run `pnpm typecheck` to prove nothing broke.
4. E2E: in `app/tests/e2e/`, remove `test.fail()` from the specs for flows 4.1 (return-flow), 4.2 (complaint-flow), date-rule, 4.4 (form-validation) and 4.7 (session). Keep `test.fail()` on chat.spec.ts (T25) and on responsive-a11y only where it needs chat features. Fix the spec selectors only if they contradict the PRD or the real accessible names, and justify each change. Run `pnpm test:e2e --project=desktop` for those specs (real OpenRouter; about 6 submissions, each 10–40 s); they must pass. Then run the mobile project for form-validation and session.
5. Manual check (short, real): start `pnpm start` (after `pnpm build`). With `playwright-cli`, one command at a time: open `/`, fill a return case with `../assets/example-images/laptop-2.webp` (10 days ago), submit, watch the progress, and land on `/chat`. Screenshot `docs/qa/T22/chat-desktop.png` at 1440×900. Reload (same content). Resize to 360×780 and screenshot `docs/qa/T22/chat-mobile.png`. Click "Nowe zgłoszenie", cancel, then confirm (empty form). Then `console` (0 errors). Count `POST /api/cases` with `playwright-cli requests` (1 per submission) and the server `[hsdc]` upstream lines (2 per submission). Write `docs/qa/T22/report.md` (≤ 40 lines). Stop the server.
6. `pnpm openrouter:status` before/after the E2E and manual runs; append a row to `docs/qa/spend.md`.

## Editable files
`app/app/page.tsx`, `app/app/chat/**`, `app/app/layout.tsx` (only if needed for the layout height), template files to delete (listed above), `app/tests/e2e/**` (annotations + justified selector fixes), `docs/qa/T22/**`, `docs/qa/spend.md`. Nothing else.

## Forbidden
No commits/`git add`, no dependency changes, never read `.env*`, no mocking in E2E, no requests in `useEffect` (navigation only).

## Verification
`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` (0 warnings), the E2E above, and the manual check.

## Report (≤ 35 lines)
Files · deleted files · E2E results (per spec, per project) · manual check summary and call counts · spend · defects/deviations.
