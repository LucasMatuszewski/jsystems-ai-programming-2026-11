# Brief T19 — Session store, NDJSON reader, submission hook and progress view

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read `app/AGENTS.md`. Targeted tests: `pnpm exec vitest run <paths>`.

## Goal
- `app/lib/ndjson.ts`: `readNdjson(stream: ReadableStream<Uint8Array>): AsyncGenerator<unknown>` that handles lines split across chunks (including mid-UTF-8 sequences: use `TextDecoder` with `stream: true`), blank lines and a missing trailing newline.
- `app/lib/session-store.ts`: `SESSION_KEY = "hsdc.session.v1"`, `readSession(storage = sessionStorage): StoredSession | null` (invalid JSON, a wrong version or a schema failure → clear and return null), `writeSession(session, storage?) → { ok: true } | { ok: false, reason: "quota" }` (catch `QuotaExceededError`), `clearSession(storage?)`, `deriveCurrentDecision(session)` = the last decision-producing part (initial `data-decision` or the latest `tool-update_recommendation` with `output-available`), see ADR-003 §3.3. Validate with `StoredSessionSchema` from `@/lib/schemas`.
- `app/components/case-submission/use-case-submission.ts`: `useCaseSubmission({ fetchImpl = fetch, onSuccess(payload) })` → `{ state: {status:"idle"} | {status:"submitting", stage: "upload"|"analysis"|"decision"} | {status:"error", code}, submit(values, file) }`. Builds `FormData` (field names from `FORM_FIELD_NAMES`, consent "true", image), POSTs `/api/cases`, maps pre-stream JSON errors (400/413/415/500) and NDJSON `error` events to codes, and stores the session (`writeSession({version:1, case, messages:[case.firstMessage]})`) on `result` before calling `onSuccess`. A second `submit` while one is in flight is ignored (AC-13). A network failure → `analysis_failed`. The hook never clears the caller's form values (AC-41). It is event-driven, not effect-driven (no request in `useEffect`; ADR-006 §3.2 strict-mode rule).
- `app/components/case-submission/submission-progress.tsx`: shows `pl.progress[0]` ("Przesyłanie zdjęcia…") for stage upload, then `[1]`, then `[2]`, with `aria-live="polite"` and a spinner or progress indicator, using semantic Tailwind tokens (brand classes from `app/app/globals.css`, e.g. `border-hairline`, `shadow-brand-lg`, `font-display`, if present).
- `app/components/case-submission/analysis-error-banner.tsx`: an alert with `pl.analysisFailed.banner` and a "Spróbuj ponownie" button (`pl.analysisFailed.retry`), plus generic texts for `validation_failed` / `unsupported_media_type` / `file_too_large` / `server_misconfigured` codes from `pl.errors`. No technical details (AC-43).

Sources: ADR-003 §3.2 (useCaseSubmission, SubmissionProgress), §3.3, §8; ADR-002 §4–5; PRD §4.4–4.5, §9.2, AC-13, AC-38, AC-41, AC-43.

## Tests (first, red, then green)
- `app/tests/unit/client-utils/ndjson.test.ts`: feed the bytes of the REAL recording `app/tests/fixtures/app/cases/escalated-return-laptop-2.ndjson.json` (its recorded body) through `replayAppResponse(path, { chunkSizes })` from `app/tests/helpers/replay-app.ts`, split at many points including inside multi-byte Polish characters; the events must equal the line-by-line parse.
- `app/tests/unit/client-utils/session-store.test.ts`: round trip with the real recorded payload; corrupt JSON; wrong version; quota error (storage stub whose `setItem` throws a `DOMException` named QuotaExceededError); deriveCurrentDecision with the initial message and with a derived variant that appends a tool part (name the base).
- `app/tests/component/submission/*.test.tsx` (jsdom): `fetchImpl` = a function returning `replayAppResponse(...)` for the recorded success / `upstream-failure` / `validation-400` / `unsupported-415` fixtures; assert stage texts appear in order, `onSuccess` gets the payload and sessionStorage holds it; an error keeps state for retry and shows the banner text; a double `submit` → `fetchImpl` called once; progress has `aria-live`.
Recordings live in `app/tests/fixtures/app/cases/` (T18). Use only those, no hand-written bodies.

## Editable files
`app/lib/ndjson.ts`, `app/lib/session-store.ts`, `app/components/case-submission/**`, `app/tests/unit/client-utils/ndjson.test.ts`, `app/tests/unit/client-utils/session-store.test.ts`, `app/tests/component/submission/**`. Nothing else.

## Forbidden
No commits/`git add`, no dependency changes, never read `.env*`, no network, no hand-written response bodies.

## Report (≤ 25 lines)
Files · APIs · red→green counts · typecheck/lint.
