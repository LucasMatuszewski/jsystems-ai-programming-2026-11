# Luna Decisions recordings

Four real success recordings (2026-11-26, `openai/gpt-6-luna-decisions`, provider Azure, HTTP 200): `return-laptop-2`, `return-phone-1`, `complaint-laptop-1`, `complaint-phone-3`. The earlier 401 `account_deactivated` outage (`../errors/decisions-upstream-account-deactivated-*.json`) was temporary and is resolved (ADR-001 A1). `pnpm record:openrouter refusal` (one call) produced no refusal, so nothing was saved (see `../../GAPS.md`). `--compare` against `return-laptop-2.json` returned structure identical (exit 0).

## Confirmed answers (ADR-000 section 11)
- **API:** AI SDK 7.0.118 `experimental_evaluate` + `provider.evaluationModel(id)` -> `POST /api/alpha/decisions` (not `experimental_decide` / `decisionModel`).
- **Question types on the wire:** boolean is sent as `noul` (answer `{type:"noul", noul: p}`; SDK result: `boolean` / `probability`). `choice` (answer `choice` + `probabilities`) and `score` (answer `score` + `probabilities` keyed by zero-based level index + `legend`) keep their names.
- **Image pass-through:** top-level `state` array: plain text string plus `{type:"image_url", image_url:{url:"data:image/jpeg;base64,..."}}`. Works; ~2200-2300 input tokens per call, 0 output tokens.
- **Confidence:** only on `choice` and `score` answers (`answers[key].confidence` on the wire; `providerMetadata.openrouter.answers[key].confidence` in the SDK). Boolean answers have none (use `max(p, 1 - p)`).
- **Cost:** `usage.cost` is 0 (BYOK route); the real upstream cost is `usage.cost_details.upstream_inference_cost` (about USD 0.0002 per call). The key's all-time usage did not move.
- **Latency:** 1559 ms (return-laptop-2), 1132 ms (return-phone-1), 1647 ms (complaint-laptop-1), 752 ms (complaint-phone-3).
- **Response envelope:** `{model: "openai/gpt-6-luna-decisions-20261006", answers, usage, id, provider}`; headers `x-generation-id`, `x-provider-name`.

## Normalized values (`normalizeDecisionAnswers`, value@confidence; score value is the 1-based level)
| key | return-laptop-2 | return-phone-1 | complaint-laptop-1 | complaint-phone-3 |
|---|---|---|---|---|
| photo_usable | true@0.87 | true@0.62 | false@0.63 | false@0.82 |
| device_visible | true@1 | true@0.88 | true@0.87 | false@0.65 |
| category_match | true@0.98 | false@0.96 | true@1 | false@1 |
| damage_visible | false@0.97 | true@1 | true@1 | false@1 |
| damage_type | none@0.9 | crack@1 | crack@0.96 | none@0.73 |
| damage_location | none@0.98 | screen@1 | screen@0.99 | screen@0.99 |
| condition | 3@0.58 | 1@0.88 | 1@0.74 | 5@0 |
| signs_of_use | true@0.95 | true@0.99 | not asked | not asked |
| packaging_visible | false@1 | false@1 | not asked | not asked |
| damage_cause | not asked | not asked | user_caused@0.97 | manufacturing_defect@0.43 |
| description_consistent | not asked (empty reason) | false@1 | false@0.98 | false@1 |

The real shape matches what `normalize.ts` and `get-signals.ts` assumed; no code change was needed.

## Fast-path gate (threshold 0.8)
None of the four recordings is eligible (they are real photos of used or damaged devices): return-laptop-2 fails condition (3) and signs_of_use; return-phone-1 fails category_match, damage_visible and others; the complaint recordings fail photo_usable and damage_cause. All four escalate. A fast-route writer recording was therefore not needed.
