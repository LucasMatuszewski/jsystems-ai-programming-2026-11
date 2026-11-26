# Decision model recordings (TypeSafe Jev 1.14)

Four real success recordings (2026-11-26, `typesafe/jev-1.14`, provider TypeSafe, HTTP 200): `return-laptop-2`, `return-phone-1`, `complaint-laptop-1`, `complaint-phone-3`. They replace the earlier `openai/gpt-6-luna-decisions` recordings (user decision, ADR-001 A2), which are archived in `archive-luna/` (their `meta.notes` say "superseded"). `pnpm record:openrouter refusal` (one call) produced no refusal, so nothing was saved (see `../../GAPS.md`). `--compare` against `return-laptop-2.json` returned structure identical (exit 0). 6 real calls in total.

## Confirmed answers (ADR-000 section 11, ADR-001 A2)
- **API:** AI SDK 7.0.118 `experimental_evaluate` + `provider.evaluationModel(id)` -> `POST /api/alpha/decisions`. Same request shape as with Luna: `{ model, state, questions }`.
- **Question types on the wire:** boolean is sent as `noul` (answer `{type:"noul", noul: p}`; SDK result: `boolean` / `probability`). `choice` (answer `choice` + `probabilities`) and `score` (answer `score` + `probabilities` keyed by zero-based level index + `legend`, which echoes our level descriptions) keep their names.
- **Criteria sent (A2):** every `choice` option has a description, booleans carry `criteria {true, false}`, score levels are `"<n> <name>: <description>"`. Jev accepted all of them (4/4 HTTP 200).
- **Image pass-through:** top-level `state` array: plain text string plus `{type:"image_url", image_url:{url:"data:image/jpeg;base64,..."}}`. Works for all four JPEG photos (34.6 KB to 213 KB). Input tokens 2049 to 7336 per call (more for larger images), output tokens about 300 (output is free).
- **Confidence:** only on `choice` and `score` answers (`answers[key].confidence` on the wire; `providerMetadata.openrouter.answers[key].confidence` in the SDK). **Boolean (`noul`) answers carry no confidence** (checked on all 4 x 7-8 booleans), so `max(p, 1 - p)` stays the boolean rule. `normalize.ts` needed no change.
- **Cost:** `usage.cost` is 0 (BYOK route); the upstream cost is `usage.cost_details.upstream_inference_cost`: USD 0.000138 / 0.000180 / 0.000308 / 0.000086 per call (about USD 0.0007 for the 4 calls).
- **Latency (client-measured):** 430 ms (return-laptop-2), 301 ms (return-phone-1), 468 ms (complaint-laptop-1), 236 ms (complaint-phone-3). TypeSafe gives no latency claim; these are single samples.
- **Response envelope:** `{model: "typesafe/jev-1.14-20261014", answers, usage, id, provider: "TypeSafe"}`; the build is reported in `model`. Headers `x-generation-id`, `x-provider-name`.

## Normalized values (`normalizeDecisionAnswers`, value@confidence; score value is the 1-based level)
| key | return-laptop-2 | return-phone-1 | complaint-laptop-1 | complaint-phone-3 |
|---|---|---|---|---|
| photo_usable | true@0.86 | true@0.86 | true@0.72 | false@0.57 |
| device_visible | true@0.99 | true@0.98 | true@0.98 | true@0.96 |
| category_match | true@0.94 | true@0.85 | true@0.95 | true@0.83 |
| damage_visible | false@0.8 | true@0.98 | true@0.98 | false@0.93 |
| damage_type | none@0.68 | crack@0.96 | crack@0.99 | none@0.78 |
| damage_location | none@0.65 | screen@1 | screen@0.89 | screen@0.99 |
| condition | 4@0.31 | 1@0.74 | 1@0.61 | 1@0 |
| signs_of_use | true@0.77 | true@0.95 | not asked | not asked |
| packaging_visible | false@0.98 | false@0.96 | not asked | not asked |
| damage_cause | not asked | not asked | user_caused@0.8 | undetermined@0.59 |
| description_consistent | not asked (empty reason) | true@0.55 | false@0.88 | false@0.98 |

Observations: Jev is less confident than Luna on the clean return photo (condition 0.31, damage_type 0.68) and gives a zero provider confidence for complaint-phone-3 `condition` (kept as 0, fail-closed). return-phone-1 `description_consistent` is true@0.55 for a generic reason text; it is not a contradiction signal.

## Fast-path gate (threshold 0.8, uncalibrated for Jev; tuned in T26)
None of the four recordings is eligible (asserted in `tests/unit/ai-logic/fast-path-recordings.test.ts`): return-laptop-2 is blocked at least by condition (4@0.31) and signs_of_use (true); return-phone-1 and complaint-laptop-1 show damage; complaint-phone-3 has photo_usable false and damage_cause 0.59. All four escalate. No `writer-fast-*` recording was made.
