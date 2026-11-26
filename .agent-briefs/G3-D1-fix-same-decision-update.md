# Brief G3-D1 — Fix: no update card when the guarded decision equals the current one

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`, commit 7d598f4. Read:
- `app/AGENTS.md`;
- `app/tests/AGENTS.md`;
- `.claude/rules/long-running-processes.md` (mandatory);
- `docs/qa/G3/report.md` (defect D1);
- ADR-001 §3.8 and TAC-001-04;
- PRD AC-23, AC-35 and §11.

## Defect D1 (medium, AC-35)
1. Return case, 10 days ago (system-computed), current decision Weryfikacja ręczna.
2. The user writes "Muszę sprostować… Laptop dostałem 40 dni temu".
3. The model calls `update_recommendation` with Odrzucenie / R-4.
4. The chat guards in `app/server/ai/chat/build-chat-stream.ts` (`applyGuards`: date rules and R-2.4 use the SYSTEM `daysSincePurchase` = 10) turn it into Weryfikacja ręczna.
5. Result: the UI shows a card "Weryfikacja ręczna → Weryfikacja ręczna" with an R-4 reason, the reply text claims a rejection, and the panel does not change.

## Expected behaviour
- The purchase date and day count come only from the form and are computed by the system (AC-23). A date claimed in chat never changes them.
- An update whose guarded `newDecision` equals `caseContext.currentDecision.decision` is **not** an update. The tool must not produce an output-available part, so there is no card and the panel does not change. Make the tool's execute throw a short neutral error, e.g. `no_change: decision unchanged after policy checks`. The tool part then ends in output-error, which the UI already ignores. The model then sees the error in step 2.
- The chat prompts (`app/server/ai/prompts/chat-return.md`, `chat-complaint.md`; bump the prompt version as the loader requires):
  - The purchase date and day count from the case context are authoritative. If the customer says the date is different, the agent explains that the date from the form counts, and that a different date needs a new case (or will be checked by customer service). It does not change the recommendation because of a claimed date.
  - When `update_recommendation` fails, the reply must not claim that the recommendation changed.
- Keep: at most 1 tool call per turn, and the guards for enum, rule IDs and R-2.4.

## Tasks (tests first, red, then green)
1. Integration test in `app/tests/integration/api-chat/`: a derived variant of `app/tests/fixtures/openrouter/llm/chat-tool-update.json` (name the base in the variant) whose tool input has a `newDecision` that the guards turn into the current decision. Expect a tool output-error, no output-available chunk, and 2 chat-step log lines.
2. A test that an update to a genuinely different decision still works (existing recordings).
3. A prompt test, if the project has prompt snapshot/content tests: the date rule text is present.
4. Implement the fix.
5. Real check, short: `pnpm start` (yourself, log in `docs/qa/G3-D1/server.log`). Drive it with `playwright-cli`, one command at a time:
   - Return case, laptop-2.webp, 10 days. Send the G3 correction message: expect no update card, the panel unchanged, and a Polish reply that does not claim rejection.
   - Then send a genuine new fact that should change the decision (e.g. that the device was not used and the smudges are removed): an update card may appear; record what happens.
   - Take screenshots in `docs/qa/G3-D1/` and run `console` (0 errors).
   - Count calls: 1 POST per turn, 1–2 chat-step lines.
   - At most 4 chat turns and 1 submission.
6. Run `timeout 15m pnpm exec playwright test --project=desktop chat --global-timeout=900000` → `docs/qa/G3-D1/e2e-chat.log` (must pass).
7. Append a row to `docs/qa/spend.md`. Write `docs/qa/G3-D1/report.md` (≤ 30 lines).

## Editable files
`app/server/ai/chat/**`, `app/server/ai/prompts/chat-*.md` and the prompt loader/version registry if needed, `app/tests/integration/api-chat/**`, `app/tests/unit/prompts/**`, `app/tests/fixtures/openrouter/llm/` (derived variants only, named), `docs/qa/G3-D1/**`, `docs/qa/spend.md`.

## Time limits
- Whole task: 60 min.
- Build: 5 min.
- E2E: 15 min.
- The server must be ready within 60 s.
- If a limit is exceeded, report it; do not wait. Never wait on a process by matching its command line.
- Stop every server and browser you started.

## Forbidden
No commits or `git add`, no dependency changes, never read `.env*`, no hand-written response bodies.

## Verification
- Full `pnpm test`, run once and alone;
- `pnpm typecheck`;
- `pnpm lint`;
- `pnpm build` (0 warnings).

## Report (≤ 25 lines)
Root cause, change, tests red→green, real-check result with calls, E2E, prompt version bump, deviations.
