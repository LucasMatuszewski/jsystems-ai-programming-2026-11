# Brief T09 — Pure decision logic (days, rules, fast-path gate, guards, policy loader)

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read `app/AGENTS.md`. Contracts: `app/lib/schemas/**` (DECISIONS, CaseType, Category, signal keys/options, DecisionSignals, SignalAnswer, CaseDecision, ImageFindings) — import them, never redefine.

## Goal
Pure, model-free modules under `app/server/ai/logic/`:
- `days.ts`: `daysSincePurchase(purchaseDate: string, now: Date): number` — calendar days in Europe/Warsaw, purchase date = day 0 (ADR-001 §3.2 stage 1). Use `todayInWarsaw` from `@/lib/dates`.
- `rules.ts`: `applyDateRules(caseType, days)` → `{ decision: "Odrzucenie", ruleRefs: ["R-4"] }` for return > 30, `["C-2"]` for complaint > 730, else `null` (§3.2 stage 3).
- `fast-path.ts`: `evaluateFastPath({ caseType, category, days, hasReason, signals, enabled, threshold })` → `{ eligible: true } | { eligible: false; reasons: string[] }` implementing **every** condition in ADR-001 §3.4 (common, return incl. audio exclusion and the days 15–30 `packaging_visible` rule, complaint incl. excluded damage types). Only possible fast outcome is `Akceptacja` (TAC-001-03).
- `guards.ts`: `applyGuards({ caseType, days, decision, ruleRefs, policyRuleIds, signals, imageFindings, threshold, route, photoAdvice })` → `{ decision, ruleRefs, photoAdvice, guardsApplied: string[] } | { violation: "invalid_rule_refs" | "missing_photo_advice" }` implementing ADR-001 §3.5 items 1–5 (enum, rule IDs exist in the case-type policy and ≥ 1, R-2.4 override → "Weryfikacja ręczna" with `guardsApplied` "R-2.4", date-rule assertion, AC-27 image-quality guard incl. the LLM's own imageFindings).
- `policy.ts`: `loadPolicy(caseType, dir?)` → `{ text, ruleIds, version }` — reads `return-policy.md` / `complaint-policy.md` from `POLICIES_DIR` (default: `path.resolve(process.cwd(), "../docs/policies")`), parses rule IDs `R-n`, `R-n.m`, `C-n`, `C-n.m` from headings and numbered sub-items (e.g. `## R-2 …` plus its numbered items 1–4 → R-2, R-2.1…R-2.4), `version` = short sha256 of the text, in-memory cache, throws if file missing or no IDs. Read the real policy files in `docs/policies/` to verify parsing.
- `server-only` import at top of each file.

Sources: `docs/ADR/001-ai-decision-pipeline.md` §3.2–3.6, §8 table, TAC-001-02/03/04/05. PRD AC-23–AC-27.

## Test inputs (ADR-001 amendment A1)
No success recording of Luna Decisions exists (the upstream is deactivated, see ADR-001 §9 A1). For these pure functions, build `DecisionSignals` values over the internal types directly (ADR-006 §3.1 allows this for pure functions): one complete "clear acceptance" base set per case type, and boundary variants that change one value at a time. Ignore the paragraph below about recordings until success recordings exist.

## (Deferred) Test inputs from recordings
Signal inputs must be **normalized values taken from T06 recordings**: read `app/tests/fixtures/openrouter/decisions/NOTES.md` (normalized tables) and/or call `normalizeDecisionAnswers` from `app/server/ai/signals/normalize.ts` on the fixture JSONs. Boundary cases are **derived variants**: clone a recording-derived signal set and change only values (e.g. confidence 0.79 vs 0.80), naming the base recording in the test name.

## Tests (first, red, then green) `app/tests/unit/ai-logic/*.test.ts`
- days: purchase today / 14 / 15 / 30 / 31 / 730 / 731 days ago with a fixed `now`; midnight Warsaw edge; DST change; leap year.
- rules fire at 31 (return) and 731 (complaint), not at 30 / 730.
- fast path: each §3.4 condition just below (0.79) and at/above (0.8) T; headphones → not eligible; signals unavailable → not eligible; complaint `crack` / `user_caused 0.95` → not eligible; flag off → not eligible; days 15–30 without packaging → not eligible.
- guards: return 10 days + Odrzucenie → Weryfikacja ręczna + "R-2.4"; 15 days → no override; `["R-9"]` → invalid_rule_refs; `C-2` in a return → invalid; image findings `photoQuality: "unusable"` → Weryfikacja ręczna and photoAdvice required; date-rule rejection kept even with an unusable photo.
- policy: real files give R-1…R-8 and C-1…C-9 (plus sub-IDs); missing dir → throws.
- property-style test for TAC-001-04: for every recording-derived signal set and days 0–14, no guarded output is Odrzucenie.

## Editable files
`app/server/ai/logic/**`, `app/tests/unit/ai-logic/**`. Nothing else.

## Forbidden
No commits/`git add`, no dependency changes, no `.env*`, no network, no hand-written signal JSON that is not derived from a named recording.

## Commands (in `app/`)
`pnpm test -- tests/unit/ai-logic` · `pnpm typecheck` · `pnpm lint`

## Report (≤ 30 lines)
Files · exported signatures · red summary · green counts · typecheck/lint · ambiguities found in ADR-001 and how resolved.
