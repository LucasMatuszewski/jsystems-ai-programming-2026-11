# Brief G5-1 — Remedy on chat update cards for an accepted complaint (AC-28)

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`, commit 1766708. Read:
- `app/AGENTS.md` and `app/tests/AGENTS.md`;
- `.claude/rules/long-running-processes.md` (mandatory);
- `docs/qa/G5/report.md` (defect G5-1, screenshot `ac28-chat-update-akceptacja.png`);
- PRD AC-28 and AC-35;
- ADR-001 §3.8;
- `app/lib/schemas/decision.ts` (the first-decision `remedy` field, `RemedySchema` in `enums.ts`);
- `app/components/chat/decision-card.tsx` (it already renders `remedy` for the first decision);
- `app/server/ai/calls/chat.ts` (`updateRecommendationToolSchema`);
- `app/server/ai/chat/build-chat-stream.ts` (guards and the D1 `no_change` path).

## Defect
On a complaint, a chat update to **Akceptacja** shows a card (Weryfikacja ręczna → Akceptacja, C-3/C-4, disclaimer) **without a remedy**. AC-28 requires an accepted complaint to name the remedy. The update tool input/output has no `remedy` field, and the update card renders none.

## Expected
- The `update_recommendation` input gets `remedy: RemedySchema.nullable()`, with the same values as the first decision. The output carries it.
- **Guard:** for `caseType` complaint with `newDecision` Akceptacja, a missing remedy is a guard violation, so the tool throws and there is no card. The model sees the error and must not claim a change. For any other case, the remedy must be null; if the model sends one, set it to null.
- The chat-complaint prompt says that an update to Akceptacja must include the remedy. Bump the version.
- The UI update card renders the remedy exactly as the first-decision card does: the same component/prop and Polish labels from `pl`.
- The session/schema validation for stored assistant tool parts (`ChatMessageSchema`, F2) accepts the new field.

## Tests (red, then green)
- Tool schema and guard: a unit test plus an integration test with a derived variant of `app/tests/fixtures/openrouter/llm/chat-tool-update.json` (name the base):
  - a complaint going to Akceptacja with a remedy → output-available including the remedy;
  - without a remedy → output-error and no card;
  - a return going to Akceptacja with a remedy → the remedy is null in the output.
- Component test: the update card shows the remedy text.
- Validation: a stored tool part with a remedy passes `ChatMessageSchema`.
- Full `timeout 5m pnpm test` once, alone; `pnpm typecheck`; `pnpm lint`.

## Real check (yours)
1. `timeout 5m pnpm build`, then your own `pnpm start` with the log in `docs/qa/G5-1/server.log`.
2. With `playwright-cli`, one command at a time: a complaint, smartphone, `phone-2.jpeg`, 45 days, a defect reason of at least 20 characters. In chat: "Serwis producenta potwierdził wadę fabryczną płyty głównej, protokół SRV-2291/2026".
3. If an update card to Akceptacja appears, it must show the remedy. Take a screenshot. At most 3 chat tries and 2 submissions.
4. Run `console` (0 errors) and check the call counts. Then stop the server.

## E2E
Run `timeout 15m pnpm exec playwright test --project=desktop chat --global-timeout=900000` → `docs/qa/G5-1/e2e-chat.log`. It must pass.

## Wrap-up
- Append a row to `docs/qa/spend.md`.
- Write the report to `docs/qa/G5-1/notes.md` (if the write is refused, return it as text).

## Editable files
`app/server/ai/calls/chat.ts`, `app/server/ai/chat/**`, `app/server/ai/prompts/chat-complaint.md` (and the version registry if needed), `app/lib/schemas/**`, `app/components/chat/**`, `app/lib/i18n/pl.ts` (only new keys), `app/tests/**` (no weakened E2E assertions), `docs/qa/G5-1/**`, `docs/qa/spend.md`.

## Limits
- Whole task: 60 min.
- No commits or `git add`, never read `.env*`, no dependency changes, no hand-written bodies (named derived variants only).
- Never wait on a process by matching its command line. Use `mv`, not `rm`.

## Report (≤ 20 lines)
