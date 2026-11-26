# Brief T17 — POST /api/cases (multipart → NDJSON)

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/` (Next.js 16 route handlers). Read `app/AGENTS.md` and Next's route-handler docs in `app/node_modules/next/dist/docs/` if needed. Targeted tests: `pnpm exec vitest run <paths>`.

## Goal
`app/app/api/cases/route.ts` (`export const runtime = "nodejs"`, `maxDuration = 120`, `dynamic = "force-dynamic"`) and a testable core `app/server/cases/handle-cases.ts` exporting `handleCasesRequest(request: Request, deps?: { runPipeline?, now?, requestId?, callLogSink?, pipelineDeps? }): Promise<Response>` that the route calls.

Behaviour (ADR-002 §3 image rules, §4 NDJSON events, §5 contract; PRD AC-18, AC-41, AC-43):
1. `logIncoming` once per request (with final pre-stream status, or 200 for streams) via `app/server/ai/log/call-log.ts`.
2. `Content-Length` > 11 MB → 413 `{code:"file_too_large"}` before parsing. Missing env key → 500 `{code:"server_misconfigured"}` (catch `EnvError` from `getEnv()`).
3. `request.formData()`; text fields via `parseCaseFormData(formData, todayInWarsaw(now()))` from `@/lib/schemas` → 400 `{code:"validation_failed", fieldErrors}`. Image part missing → 400 with `fieldErrors.image = "required"`. File > 10 MB (`checkSize`) → 413. `inspectImage` not ok → 415 `{code:"unsupported_media_type"}`. No model is called on any of these paths (TAC-002-01).
4. `prepareForModel` + `makeThumbnail` (`@/server/image`).
5. Return `200 application/x-ndjson` stream: write `{"type":"stage","stage":"analysis"}` immediately, then run `runCasePipeline(caseInput, image, AbortSignal.any([request.signal, AbortSignal.timeout(90_000)]), { onStage: () => write stage decision, requestId, ... })` from `app/server/ai/pipeline/run-case-pipeline.ts`.
6. On success: exactly one `{"type":"result","case": CaseSessionPayload}`: `caseId` (crypto.randomUUID), `createdAt`, `form` (fields, no image), `thumbnailDataUrl`, `daysSincePurchase`, `decision` (CaseDecision without `escalationReasons`, `guardsApplied`, and `firstMessage`; check `CaseSessionPayloadSchema` in `app/lib/schemas/session.ts` and make the payload validate against it), `firstMessage` = UIMessage `{ id: "initial-<caseId>", role: "assistant", parts: [ {type:"text", text: greeting}, {type:"data-decision", data: {decision, ruleRefs, kind:"initial", remedy}}, {type:"text", text: bodyMarkdown} ] }` (AC-21). Validate with the schema before writing.
7. On `PipelineError`: one `{"type":"error","code"}` with mapping `invalid_model_output → analysis_failed`, `model_unavailable → model_unavailable`, `timeout → timeout`; any other error → `analysis_failed`. Never include messages, stack traces, provider names or HTTP codes (AC-43). Exactly one terminal event (TAC-002-03).
8. `server-only` in `server/cases/*`.

## Tests (first, red, then green)
`app/tests/integration/api-cases/*.test.ts`. Build multipart `Request`s with real `FormData` and the real example photos from `../assets/example-images/` (and `../assets/logo.svg` for 415). The pipeline is exercised for real with `pipelineDeps.provider = createOpenRouter({ apiKey:"test", fetch: replayFetch([...]) })` replaying committed recordings: `tests/fixtures/openrouter/errors/decisions-upstream-account-deactivated-1.json` + `tests/fixtures/openrouter/llm/escalated-return-laptop-2.json` for the success stream; `writer-rule-return-r4.json` for a 45-day return; `errors/chat-401.json` as the LLM exchange for the `model_unavailable` error event. Assert: NDJSON lines in order (stage analysis → stage decision → result), payload validates against `CaseSessionPayloadSchema`, first message parts order, thumbnail data URL present; 400 with field codes and zero upstream call-log lines (inject `callLogSink`); 415 for logo.svg; 413 via a `Content-Length: 11534337` header on a small real body (size rule unit-tested in T08 already); error event for the LLM failure with no provider text; an already-aborted request → `timeout` event. Set `OPENROUTER_API_KEY` for tests via the env `source`/stub, never real.

## Contract change (authorized by the orchestrator)
`runCasePipeline` returns `PipelineResult = CaseDecision & { photoAdvice: string | null }`. Add `photoAdvice: z.string().nullable()` to the `CaseDecision` schema in `app/lib/schemas/decision.ts` (and therefore to the session decision), pass it through in the payload, and update `app/server/ai/pipeline/run-case-pipeline.ts` only to drop the now-redundant intersection type if it becomes trivial (optional). Keep all existing schema tests green, and add one test for the new field in `app/tests/unit/schemas/session.test.ts`.

## Editable files
`app/app/api/cases/route.ts`, `app/server/cases/**`, `app/tests/integration/api-cases/**`, `app/lib/schemas/decision.ts` (photoAdvice only), `app/tests/unit/schemas/session.test.ts` (one test), `app/server/ai/pipeline/run-case-pipeline.ts` (type only). Nothing else.

## Forbidden
No commits/`git add`, no dependency changes, never read `.env*`, no real network, no hand-written response bodies, no generated images.

## Verification
`pnpm exec vitest run tests/integration/api-cases`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.

## Report (≤ 25 lines)
Files · test matrix · red→green counts · checks · deviations.
