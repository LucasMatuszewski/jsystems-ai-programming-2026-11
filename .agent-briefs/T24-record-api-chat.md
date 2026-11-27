# Brief T24 — Record /api/chat from the running app (real models)

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read:
- `app/AGENTS.md` and `.claude/rules/long-running-processes.md` (timeouts, logs, watchdog: mandatory);
- `docs/ADR/006-real-endpoint-verification.md` §3.1–3.2;
- `docs/ADR/002-backend-api.md` §5 `/api/chat`;
- ADR-001 §3.8;
- the existing `app/scripts/record-app.ts` (cases mode, T18) and `app/tests/fixtures/app/cases/`.

Call budget for a chat turn: 1 upstream `chat-step` line, or 2 when the tool runs.

## Goal
Add a `chat` mode to `app/scripts/record-app.ts` (`pnpm record:app chat [name...]`).
- It sends REAL JSON requests to the running app (`pnpm start` on port 3000; you start it yourself with output in `docs/qa/T24/server.log`) and saves the verbatim responses (status, content-type, full SSE body text) into `app/tests/fixtures/app/chat/`.
- Use the same metadata as cases mode: `capturedAt`, `target` "/api/chat", a request summary, `appCommit`, versions, `notes`, `durationMs`, and `meta.upstreamCalls` counted from the `[hsdc]` lines.
- Build the case context from a recorded T18 case: `escalated-return-laptop-2.ndjson.json`, plus one complaint case. Build the messages exactly as the UI will send them (the `ChatRequestSchema` in `app/lib/schemas`, with `CaseUIMessage` parts).

## Recordings (synthetic Polish user messages)
1. `plain-return.sse.json`: a clarifying question ("Jak mam zapakować laptopa?"). Expect text, no tool, 1 upstream line.
2. `update-return.sse.json`: a new relevant fact that should change the recommendation. Expect the `tool-update_recommendation` output, then text, 2 lines. If the model does not call the tool, try at most one rephrasing and record what happens; report it.
3. `insist-complaint.sse.json`: the user insists on acceptance without new facts. Expect no tool call (record whatever happens).
4. `upstream-failure.sse.json`: a second server on port 3001 with `OPENROUTER_API_KEY=sk-or-v1-invalid` in its environment, request 1. Expect an error chunk with `chat_failed` and no provider text.
5. `validation-400.json`: an empty last user message. Expect 400 and 0 upstream lines.

## Also
- Extend the metadata scan test (`app/tests/unit/fixtures/metadata.test.ts`) to cover `fixtures/app/chat/**`: no `sk-or-` keys, no reasoning parts.
- In `app/tests/integration/api-chat/`, add one test that replays a recording through `replayAppResponse` and parses the SSE (proves the fixtures are usable for T25).
- Run `pnpm openrouter:status` before and after, and append a row to `docs/qa/spend.md`. At most 8 real requests in total.
- Stop every server you started.

## Time limits
- Build: 5 min.
- Each recording run: `timeout 10m`.
- The server must answer within 60 s.
- Whole task budget: 45 min.
- If any limit is exceeded, stop, save the log tail, and report. Never wait on a process by matching its own command line.

## Editable files
`app/scripts/record-app.ts`, `app/tests/fixtures/app/chat/**`, `app/tests/unit/fixtures/metadata.test.ts`, `app/tests/integration/api-chat/replay-recorded.test.ts`, `docs/qa/T24/**`, `docs/qa/spend.md`. Nothing else. Report app defects instead of fixing them.

## Forbidden
No commits/`git add`, no dependency changes, never read `.env*`, never print the key.

## Verification
- Targeted tests;
- `pnpm typecheck`;
- `pnpm lint`.

## Report (≤ 30 lines)
- Per recording: status, tool called?, newDecision, durationMs, upstream lines vs expected.
- Defects.
- Tests.
- Spend.
