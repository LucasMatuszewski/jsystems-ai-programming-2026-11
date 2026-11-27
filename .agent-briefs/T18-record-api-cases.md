# Brief T18 — Record /api/cases from the running app (real models)

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read `app/AGENTS.md`, `docs/ADR/006-real-endpoint-verification.md` §3.1–3.2, `docs/ADR/002-backend-api.md` §4–5, ADR-001 §9 A1 (call budget under A1: escalated = 1 failed signals + 1 escalated; rule = 1 failed signals + 1 writer).

## Goal
`app/scripts/record-app.ts` (`pnpm record:app cases [name...]`) sends REAL multipart HTTP requests to the running app (`pnpm build && pnpm start`, port 3000, real key loaded by the app from the root `.env`) and saves the verbatim responses (status, content-type, full body text) with metadata (`capturedAt`, `target` "/api/cases", `request` summary: synthetic fields + photo file name, `appCommit`, versions, `notes`) into `app/tests/fixtures/app/cases/`. It also collects the server's `[hsdc]` call-log lines for each request (capture server stdout to a log file you start the server with, and match by time window or requestId) and stores the upstream line count in `meta.upstreamCalls`.

## Recordings (synthetic data, photos only from `../assets/example-images/`, never describe the photo)
1. `escalated-return-laptop-2.ndjson.json`: Zwrot, laptop, "Lenovo ThinkPad E14", 10 days ago, no reason, `laptop-2.webp`.
2. `escalated-complaint-phone-1.ndjson.json`: Reklamacja, smartphone, "Samsung Galaxy A55", 400 days ago, reason "Ekran zaczął migać i pojawiły się kolorowe pasy, telefon nigdy nie upadł.", `phone-1.jpg`.
3. `rule-return-45d.ndjson.json`: Zwrot, laptop, 45 days ago, reason "Laptop przestał się ładować po miesiącu.", `laptop-1.png`.
4. `rule-complaint-800d.ndjson.json`: Reklamacja, tablet, 800 days ago, reason ≥ 20 chars, `phone-2.jpeg`.
5. `mismatch-tv-phone-3.ndjson.json`: Zwrot, category tv, 5 days ago, `phone-3.jpeg` (category mismatch, AC-27; record whatever the model decides).
6. `validation-400.json`: server-side validation failure (e.g. model "A", consent missing), sent directly (bypassing client validation).
7. `unsupported-415.json`: `../assets/logo.svg` as the image.
8. `upstream-failure.ndjson.json`: a second server instance on port 3001 started with `OPENROUTER_API_KEY=sk-or-v1-invalid` set in its environment (env var wins over the root `.env`), same request as 1 → error event.
9. 413 is a documented gap: add it to `app/tests/fixtures/GAPS.md` if not already listed.
Each successful submission must show exactly the A1 budget in `meta.upstreamCalls` (2), and no upstream calls for 6 and 7; otherwise report it as a defect. Each must finish < 90 s; record `durationMs`.

## Also
- Extend the metadata scan test `app/tests/unit/fixtures/metadata.test.ts` so app fixtures are covered: no `sk-or-` keys; `data:image` allowed only in the `thumbnailDataUrl` field.
- A replay helper `app/tests/helpers/replay-app.ts`: `replayAppResponse(fixturePath, { chunkSizes? })` returns a `Response` whose body streams the recorded bytes, optionally split into byte chunks (for NDJSON reader tests). Unit-test it with one recording.
- `pnpm openrouter:status` before/after; append a row to `docs/qa/spend.md`. Max 10 real submissions in total (including retries).
- Stop all servers you started.

## Editable files
`app/scripts/record-app.ts`, `app/tests/fixtures/app/cases/**`, `app/tests/fixtures/GAPS.md`, `app/tests/unit/fixtures/metadata.test.ts`, `app/tests/helpers/replay-app.ts`, `app/tests/unit/replay/replay-app.test.ts`, `docs/qa/spend.md`. Nothing else. Report app defects instead of fixing them.

## Forbidden
No commits/`git add`, no dependency changes, never read `.env*`, never print the key, no generated images.

## Report (≤ 35 lines)
Per recording: status, terminal event, decision + ruleRefs, durationMs, upstream call count vs expected · defects · tests · spend.
