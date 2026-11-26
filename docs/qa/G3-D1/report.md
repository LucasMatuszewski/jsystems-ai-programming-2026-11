# G3-D1: no update card when the guarded decision equals the current one

Date 2026-11-26, base 7d598f4 (uncommitted changes). Verdict: PASS with one deviation (D1 path itself not reproduced live, see below).

- Root cause: `update_recommendation.execute` returned an output even when `applyGuards` turned the model's decision into the current one (R-2.4/date rules use the system `daysSincePurchase`), so the UI showed "X -> X" while the text claimed a rejection.
- Change: `server/ai/chat/build-chat-stream.ts` throws `no_change: decision unchanged after policy checks` when guarded decision === current decision (tool part ends in output-error, no card, panel unchanged, model sees the error in step 2). Prompts `chat-return` / `chat-complaint` bumped 1.0.0 -> 1.1.0: form date and `daysSincePurchase` are authoritative (claimed date -> explain, new case or customer service); a failed update must never be claimed as a change.
- Tests (red -> green): `tests/integration/api-chat/stream.test.ts` new D1 test, derived from `chat-tool-update.json` (Odrzucenie/R-4, current Weryfikacja ręczna): red without the fix (output-available present), green with it (output-error, no output-available, 2 chat-step lines). Existing update tests (Odrzucenie -> Weryfikacja ręczna, R-2.4 to Weryfikacja ręczna, R-99) still green. `tests/unit/prompts`: date-rule text, failed-update rule, version 1.1.0 (red before, green after).
- Verification: `pnpm test` 51 files / 578 tests pass (run alone), `pnpm typecheck` ok, `pnpm lint` ok, `pnpm build` exit 0, 0 warnings (`build.log`).
- Real check (`pnpm start`, ready < 1 s, `server.log`, playwright-cli 1440x900), 1 submission, 2 chat turns:
  - Return, laptop-2.webp, 10 days: initial decision was Akceptacja (not Weryfikacja ręczna as in G3), so the exact D1 state was not available; only 1 submission allowed.
  - Turn 1 (G3 correction, "40 dni temu"): no tool call, no card, panel unchanged (Akceptacja), Polish reply: form date and 10 days count, rekomendacja bez zmian, new case or customer service for a different date. No claim of rejection.
  - Turn 2 (device unused, smudges removed): no tool call, no card, reply asks about packaging/accessories, cites R-2. No update to record.
  - Calls: 3 incoming (1 /api/cases, 2 /api/chat), 2 chat-step lines (1 per chat turn). Console: 0 errors. Screenshots: chat-initial.png, turn1-correction.png, turn2-new-fact.png.
- E2E: `timeout 15m pnpm exec playwright test --project=desktop chat` 5 passed in 2.0 min (`e2e-chat.log`).
- Deviations: D1 not reproduced live (initial decision differed, model never called the tool); covered by the derived-recording integration test. The tool error text is masked to `chat_failed` for the client, so the test asserts the chunk type only. Usage after not re-measured (BYOK, costUsd 0 in step logs). Server and browser stopped, port 3000 free.
