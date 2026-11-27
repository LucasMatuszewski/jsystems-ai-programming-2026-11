# Brief T06 — Record Luna Decisions responses and real errors

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read `app/AGENTS.md` first. Run commands in `app/` with `pnpm`.

## Goal
`app/scripts/record-openrouter.ts` records **real** OpenRouter exchanges as fixtures and can re-check them for drift (`--compare`). This task records the Luna Decisions (`openai/gpt-6-luna-decisions`) signal calls and the real error cases, and documents the answers to ADR-000 §11 open questions. Later tasks (T10, T13, T16) replay these recordings through the real SDK.

## Authoritative sources
- `docs/ADR/001-ai-decision-pipeline.md` §3.1, §3.3 (question keys, types, options, confidence normalization), §5, §8 (TAC-001-01)
- `docs/ADR/006-real-endpoint-verification.md` §3.1 (recording rules + metadata), §3.4 (spend), §5
- `docs/ADR/000-main-architecture.md` §11
- `docs/ADR/002-backend-api.md` §3 "Image processing rules" (model image: EXIF rotate, fit 1536×1536 without enlargement, JPEG q80, strip metadata)
- Library docs via Context7: AI SDK 7 `experimental_decide` (`/vercel/ai/ai_7.0.0`), the OpenRouter provider `decisionModel` (search `@openrouter/ai-sdk-provider`), and the OpenRouter Decisions API docs (https://openrouter.ai/docs/guides/features/decisions, multimodal decisions). Also read the installed provider source under `app/node_modules/@openrouter/ai-sdk-provider/` to confirm how decision models send images.
- Shared contracts: `app/lib/schemas/decision.ts` (signal keys, option lists).

## Recording design (mandatory)
- Record at the **HTTP level**: create the provider with `createOpenRouter({ apiKey, fetch: recordingFetch })`, where `recordingFetch` calls the real `fetch` and saves `{ request: {method, url, bodySummary}, response: {status, headers (only content-type and x-* non-secret ids), body (verbatim text)} }`. `bodySummary` is the request JSON with every base64 data URL replaced by `"<image:photo-file-name.jpg, N bytes>"` and the Authorization header never stored.
- Each fixture is one JSON file `{ "meta": {...}, "exchanges": [ ... ], "sdkResult": <the value experimental_decide returned, if any, with images stripped>, "error": <error name+message if the SDK threw, no stack> }`.
- `meta`: `capturedAt` ISO, `target` (model ID / URL path), `request` (synthetic inputs: caseType, category, model name, reason, photo file name), `appCommit` (`git rev-parse --short HEAD`), `versions` (`ai`, `@openrouter/ai-sdk-provider` from installed package.json files), `provider` (provider/endpoint reported in the response if present), `script` "record-openrouter.ts", `notes`.
- A replay helper `app/tests/helpers/replay-fetch.ts` exports `replayFetch(fixturePath | fixture)`: returns a `fetch` that serves the recorded responses in order (status, headers, body), throws the recorded network error for connection-failure fixtures, and fails the test if more requests arrive than were recorded. Also export `loadFixture(path)`. Write a unit test for the helper that uses one of your real recordings (`app/tests/unit/replay/replay-fetch.test.ts`).
- The script loads env via `app/scripts/load-env.ts` (from T04). Never read or print `.env`. Never print the key.

## What to record (each a separate run, small CLI: `pnpm record:openrouter decisions` / `errors` / `--compare`)
Synthetic form data only. Photos from `assets/example-images/` only; preprocess them in the script with sharp exactly per ADR-002 rule 4. **Do not describe the photo to the model** (example-images README).
1. `decisions/return-laptop-2.json` — caseType return, category laptop, model "Lenovo ThinkPad E14", reason "" (no description_consistent question), photo `laptop-2.webp`.
2. `decisions/return-phone-1.json` — return, smartphone, "Samsung Galaxy A55", reason "Telefon nie spełnia moich oczekiwań.", photo `phone-1.jpg`.
3. `decisions/complaint-laptop-1.json` — complaint, laptop, "Dell Latitude 5440", reason "Zawias pękł podczas zwykłego otwierania pokrywy, laptop nigdy nie upadł.", photo `laptop-1.png`.
4. `decisions/complaint-phone-3.json` — complaint, smartphone, "Xiaomi Redmi Note 13", reason "Ekran przestał reagować na dotyk w dolnej części bez żadnego upadku.", photo `phone-3.jpeg`.
Questions: build them from ADR-001 §3.3 for the case type (the state contains the photo plus a short Polish/English text block with category, model, reason). Put the question-set builder in `app/server/ai/signals/questions.ts` (pure, exported `buildSignalQuestions(caseType, hasReason)` and `buildSignalStateText(input)`), so T10 reuses exactly what was recorded.
5. `errors/decisions-401.json` — same call as 1 with an invalid key (`sk-or-v1-invalid`), real 401.
6. `errors/decisions-connection-failure.json` — base URL `http://127.0.0.1:9/api/v1` (closed port), record the error name/message.
7. Refusal: try once with a harmless prompt that may cause a refusal (for example a question about an empty part of the photo). Save it only if a refusal really appears; otherwise list it in GAPS.
8. `--compare`: re-requests case 1 live and prints structural differences (keys, value types) versus the fixture. Exit code 0 when identical.

## If `experimental_decide` cannot send the image, or the shape contradicts ADR-001 §3.3
Call `POST /api/alpha/decisions` directly with the same recording fetch (ADR-000 §11 fallback). If neither works, stop and report. Do not write an ADR amendment yourself.

## Also produce
- `app/tests/fixtures/GAPS.md`: uncaptured cases (402, 429, 503, mid-stream errors, refusal if none, 413 for own endpoint) with the reason "not provoked per ADR-006 §3.1".
- `app/tests/fixtures/openrouter/decisions/NOTES.md`: answers to ADR-000 §11 from the real captures (question-type names, confidence field name, image pass-through method, cost field, latency); and a table of **normalized** values per recording computed with ADR-001 §3.3 rules (key → value, confidence). Put the normalizer in `app/server/ai/signals/normalize.ts` (pure, `normalizeDecisionAnswers(raw)`) with a unit test in `app/tests/unit/signals/normalize.test.ts` that feeds the four recordings (red first, then green).
- A metadata scan test `app/tests/unit/fixtures/metadata.test.ts` (ADR-006 §5): every JSON under `tests/fixtures/` has `meta.capturedAt`, `meta.target`, `meta.request`, `meta.versions`; no file contains `sk-or-v1-` followed by more than 10 characters other than `sk-or-v1-invalid`; no `data:image` strings in OpenRouter fixtures.
- Append one row to `docs/qa/spend.md`: run `pnpm openrouter:status` before and after the recordings and log the usage delta. Abort if remaining credit is below USD 1.

## Budget
At most 8 real API calls in total (4 decisions + 1 compare + 1 refusal attempt + 2 spare). Luna Decisions costs fractions of a cent.

## Editable files
`app/scripts/record-openrouter.ts`, `app/tests/helpers/**`, `app/tests/fixtures/**`, `app/server/ai/signals/questions.ts`, `app/server/ai/signals/normalize.ts`, `app/tests/unit/signals/**`, `app/tests/unit/replay/**`, `app/tests/unit/fixtures/**`, `docs/qa/spend.md`. Nothing else.

## Forbidden
No commits, no `git add`, no dependency changes (report if you need one), no reading `.env*`, no hand-written response bodies, no generated images, no `course-materials/`.

## Report (≤ 50 lines)
Fixture files + sizes · method used (experimental_decide or direct) · ADR-000 §11 answers · normalized table · tests red→green counts · typecheck/lint · spend before/after · gaps · contradictions.
