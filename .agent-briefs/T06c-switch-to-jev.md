# Brief T06c — Switch the decision (signals) model to TypeSafe Jev 1.14

User decision (2026-11-26): replace `openai/gpt-6-luna-decisions` with **`typesafe/jev-1.14`** (exactly 1.14, never `~typesafe/jev-latest`) on OpenRouter. Sources: https://openrouter.ai/typesafe/jev-1.14, https://openrouter.ai/docs/guides/features/decisions, https://openrouter.ai/docs/guides/community/multimodal-decisions (use WebFetch if you need to re-check a detail; never curl).

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read `app/AGENTS.md`. Targeted tests: `pnpm exec vitest run <paths>`.

## Research findings already established (verify only what you change)
- The request shape `{ model, state, questions }` sent by `openrouter.evaluationModel(id)` + `experimental_evaluate` is the same. State = `[text, {type:"image_url", image_url:{url:"data:image/jpeg;base64,…"}}]`. That's fine: Jev accepts only JPEG/PNG (no WebP), and our model image is always JPEG (`prepareForModel`). Each side must be 256–1568 px, with a total of 78,400–2,458,624 px; below the minimum gives 400, above gives 413. The 1536 px max fits. Smaller uploads are not enlarged (PRD AC-14), so they get a 400 → adapter `upstream` → escalation (fail-closed, acceptable).
- Question types: `noul` (boolean, optional `criteria {true,false}`), `choice` (**`criteria` REQUIRED: object option key → description string**), `score` (`criteria` = ordered array of levels). The docs list `confidence` for all types, incl. `noul` (Luna did not return it for booleans). Probabilities for score are keyed "0".."N-1". `box` exists but is not used.
- Pricing: about $0.042 / 1M input tokens, output free; provider TypeSafe only (endpoints `typesafe`, `typesafe/zdr`, build `typesafe/jev-1.14-20261014`). No latency claim. The image feature is "early and may change".
- The current `questions.ts` sends choice criteria as `{option: null}`. **This is the object that must change**: every option gets a short English description (no photo content, just the meaning of the option). Booleans get explicit `criteria {true: "...", false: "..."}`. Score levels stay an ordered array with short descriptions.

## Tasks
1. `app/server/ai/signals/questions.ts`: choice criteria → description maps for `damage_type`, `damage_location`, `damage_cause`; boolean questions → explicit true/false criteria; score levels with descriptions. Keys, option values and the question set per case type stay the same (ADR-001 §3.3). Unit test the new object shape in `app/tests/unit/signals/questions.test.ts` (tests first).
2. Defaults: `DECISION_MODEL` default `typesafe/jev-1.14` in `app/server/env.ts` (update the env test) and in `app/.env.example` and the root `.env.example`.
3. `pnpm openrouter:status` (before; also check that `typesafe/jev-1.14` shows an available endpoint: extend `scripts/openrouter-status.ts` only if it doesn't handle this model id). Archive the four Luna success recordings: `git mv` is not allowed for you, so copy them to `app/tests/fixtures/openrouter/decisions/archive-luna/` with a note in their `meta.notes` "superseded by Jev 1.14", then re-record the same four cases with Jev into the original file names (`pnpm record:openrouter decisions`). Then `refusal` once (save only a real refusal), then `--compare` (must exit 0). Max 8 real calls. Remove the four original Luna files from `decisions/` only by overwriting them with the Jev recordings.
4. Look at the Jev answers: does `noul` carry `confidence` (where)? If yes, `normalize.ts` should prefer the provider confidence for booleans too, falling back to `max(p,1-p)`, and the ADR must say so. Fix `normalize.ts` / `get-signals.ts` only as the real shape requires (tests first), and update `NOTES.md` (wire format, confidence location, cost, latency, normalized table per recording, model build reported in the response).
5. Update all tests that replay decisions recordings (`tests/integration/signals/**`, `tests/unit/signals/**`, `tests/unit/ai-logic/fast-path-recordings.test.ts`, `tests/integration/pipeline/signals-recorded.test.ts`) to the Jev recordings. Re-evaluate fast-path eligibility on Jev signals. If one recording is eligible, record `writer-fast-<name>` with `pnpm record:openrouter llm` (max 1 call) and add a fast-route pipeline test (signals ok + writer ok = 2 call-log lines, decision Akceptacja).
6. Docs:
   - `docs/ADR/001-ai-decision-pipeline.md`:
     - Rename "Luna Decisions" to "decision model (Jev 1.14)" in the title and the prose.
     - Update §2 references (add the Jev model page and the multimodal guide), §3.1 (model row: id, price, modalities, JPEG/PNG only, size limits, no latency claim), §3.3 (criteria with descriptions, boolean confidence rule as confirmed) and §3.4 (the 0.8 threshold is uncalibrated for Jev and is tuned via T26).
     - Add **§9 Amendment A2 (2026-11-26, Status: Accepted by user decision): switch to Jev 1.14**: why (user decision), the request-object change (before/after of one question per type), image constraints and their consequence (fail-closed), unverified items still open, and the recording refresh. Keep A1 (API names) as is.
   - `docs/ADR/000-main-architecture.md`: §1 deviation paragraph, §2 table, §3 stack table "Decision model" row, the flow table, §7 env default, §8 text that names `experimental_decide`/`decisionModel` (point to ADR-001 A1), §9 diagrams that say `gpt-6-luna-decisions`, and §11 open questions. Keep edits minimal and factual.
   - `docs/plans/decision-copilot-poc-implementation-plan.md`: add a **Rev. 5** bullet block under Rev. 4 (decision model switched to Jev 1.14 per the user; T06c added; the T06/T10/T26 descriptions now refer to the decision model generically; the §6 fallback row renamed "decision model unusable"). Edit only those rows' text, never their Status/Issue columns.
7. `pnpm openrouter:status` (after); append a row to `docs/qa/spend.md`.

## Editable files
`app/server/ai/signals/**`, `app/server/env.ts`, `app/tests/unit/env/**`, `app/.env.example`, `.env.example`, `app/scripts/record-openrouter.ts`, `app/scripts/openrouter-status.ts`, `app/tests/fixtures/openrouter/decisions/**`, `app/tests/fixtures/openrouter/llm/writer-fast-*.json`, `app/tests/fixtures/GAPS.md`, `app/tests/unit/signals/**`, `app/tests/integration/signals/**`, `app/tests/unit/ai-logic/fast-path-recordings.test.ts`, `app/tests/integration/pipeline/**`, `docs/ADR/001-ai-decision-pipeline.md`, `docs/ADR/000-main-architecture.md`, `docs/plans/decision-copilot-poc-implementation-plan.md` (text as described), `docs/qa/spend.md`. Nothing else.

## Forbidden
No commits/`git add`/`git mv`, no dependency changes, never read `.env*` (except `.env.example`), no hand-written response bodies, do not describe the photos to the model, never use `~typesafe/jev-latest`.

## Verification
Full `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` (zero warnings).

## Report (≤ 40 lines)
Object change (before/after summary) · recordings (status, model build, latency, cost, key answers, boolean confidence?) · code changes · fast-path eligibility · tests (counts) · checks · docs changed (sections) · spend · open items.
