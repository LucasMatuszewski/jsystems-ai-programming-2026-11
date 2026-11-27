# Brief T25 — Chat UI wiring: streaming chat with recommendation updates

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read:
- `app/AGENTS.md`;
- `app/tests/AGENTS.md`;
- `.claude/rules/long-running-processes.md` (timeouts, logs, report overruns: mandatory).

Targeted tests: `timeout 5m pnpm exec vitest run <paths>`.

## Goal
On `/chat`, the customer can talk with the agent about their case:
- Messages stream in progressively.
- A `update_recommendation` tool result shows a new decision card and updates the summary panel's current decision.
- Failures show an error row with "Ponów".
- The whole conversation survives a refresh (sessionStorage).

Sources:
- PRD §4.3, §9.3, Chat AC-32–AC-37, AC-42, AC-43;
- ADR-003 §3.2–3.4;
- ADR-002 §5 `/api/chat` (request = `ChatRequestSchema` in `app/lib/schemas`, messages = `CaseUIMessage` in `app/lib/types/chat.ts`);
- ADR-006 §3.2: no requests in effects; a send happens only on a user action; Strict Mode safe.

## Existing pieces (read their props; extend minimally and say so)
- `app/components/case-flow/chat-screen.tsx` and `use-stored-session.ts` (T22).
- `MessageParts` and `DecisionCard` in `app/components/chat/`. MessageParts should already render the `tool-update_recommendation` output-available part as an update card; verify this.
- `app/lib/session-store.ts`: `readSession`, `writeSession`, `deriveCurrentDecision`. The current decision is derived from the latest tool output, falling back to the first decision.
- `pl` strings in `app/lib/i18n/pl.ts`: `pl.chat.inputPlaceholder`, `pl.chat.send`, and the error/retry texts. Add missing keys only if needed.
- AI SDK 7.0.118: `useChat` from `@ai-sdk/react` and `DefaultChatTransport`. Check the installed API in `node_modules` (`app/AGENTS.md` cheat-sheet). The body needs `caseContext` from the stored session, so use `prepareSendMessagesRequest` or the documented equivalent. Never send policy text or prompts from the client.

## Tasks (tests first, red, then green)
1. Component tests in `app/tests/component/chat/conversation/**`, using a replay transport/fetch that streams the T24 recordings (`app/tests/fixtures/app/chat/*.sse.json` via `replayAppResponse` in `app/tests/helpers/replay-app.ts`, with byte chunking). Cover:
   - plain reply streams and is appended;
   - the update recording shows the update card, and the current decision in the summary changes;
   - `upstream-failure` shows the user message kept plus the error row "Nie udało się wysłać odpowiedzi…" (exact PRD text) with "Ponów";
   - "Ponów" sends exactly 1 request and does not duplicate the user message;
   - empty or whitespace messages and messages over 2000 characters cannot be sent;
   - Enter sends and Shift+Enter inserts a newline;
   - the input is disabled while streaming;
   - messages are persisted to sessionStorage after each finished turn, and a quota error shows a notice rather than crashing;
   - no request is made on mount or refresh.
2. Implement `ChatInput` (`app/components/chat/input/**`), `ChatErrorRow` (`app/components/chat/error/**`) and the conversation wiring in the chat screen. Scroll to the newest message (AC-37). The message list keeps `role="log"`. Use brand styles as in T22.
3. E2E: remove `test.fail()` from `app/tests/e2e/chat.spec.ts`, and from `responsive-a11y.spec.ts` only where the remaining failure is the chat feature. Run them one spec per invocation:
   `timeout 15m pnpm exec playwright test --project=desktop <spec> --global-timeout=900000 > ../docs/qa/T25/e2e-<spec>.log 2>&1`
   Start the server yourself with its log in `docs/qa/T25/server.log`. The specs must pass. Fix selectors only when the PRD supports it, and justify each change.
4. Manual check, short and real: `playwright-cli` one command at a time against `pnpm start`.
   - Create a return case, then send 3 turns: a clarifying question, a new relevant fact (expect an update card), and "Jaki model urządzenia zgłosiłem?".
   - Reload: the history is identical and 0 requests are made.
   - Take screenshots `docs/qa/T25/chat-desktop.png` and `chat-mobile.png` (360×780).
   - Run `console` (0 errors).
   - Count POST `/api/chat` (1 per turn) and the `[hsdc]` chat-step lines (1, or 2 with the tool).
   - Write `docs/qa/T25/report.md` (≤ 40 lines).
5. Run `pnpm openrouter:status` before and after, and append a row to `docs/qa/spend.md`.

## Editable files
`app/components/case-flow/**`, `app/components/chat/**` (minimal extensions to `decision-card`/`message-parts`, stated in the report), `app/lib/session-store.ts` (only if needed, with its tests), `app/lib/i18n/pl.ts` (new keys only), `app/tests/component/chat/**`, `app/tests/unit/session/**`, `app/tests/e2e/chat.spec.ts`, `app/tests/e2e/responsive-a11y.spec.ts`, `app/tests/e2e/helpers.ts`, `docs/qa/T25/**`, `docs/qa/spend.md`. Nothing else; report other needs.

## Time limits
- Build: 5 min.
- Each E2E spec: 15 min.
- The server must answer within 60 s.
- Whole task: 90 min.
- When a limit is exceeded, stop, save the log tail and the process state, and report.
- Never wait on a process by matching its command line.
- Stop every server and browser you started.

## Forbidden
No commits or `git add`, no dependency changes, never read `.env*`, no mocks in E2E, no requests in effects, no hand-written stream bodies (recordings or named derived variants only).

## Verification
- `pnpm typecheck`;
- `pnpm lint`;
- full `pnpm test`;
- `pnpm build` (0 warnings);
- the E2E specs;
- the manual check.

## Report (≤ 35 lines)
- Files.
- Component test matrix (red → green).
- E2E per spec.
- Manual check, with call counts.
- Spend.
- Deviations and defects.
