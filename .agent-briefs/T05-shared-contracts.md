# Brief T05 — Shared contracts (schemas, types, Polish strings)

Repo: `/home/labuser/jsystems-ai-programming-2026-11`, app in `app/` (Next.js 16, AI SDK 7, zod 4, Vitest). Run commands inside `app/` with `pnpm`. Read `app/AGENTS.md` first.

## Goal
One frozen contract module used by client and server: zod schemas, enums, inferred types, the typed chat UI message, and all Polish UI strings incl. the disclaimer. Boundary tests for PRD AC-04–AC-11 pass. No endpoint is involved, so no recordings are needed.

## Authoritative sources (read them)
- `docs/PRD.md` §6 Form (AC-01–AC-13), Disclaimer (AC-29), Chat (AC-32, AC-35), Errors (AC-41–AC-43), §4.5 and §4.7 texts, §9 (all UI texts: titles, subtitles, hints, placeholders, progress texts, dialog text)
- `docs/ADR/002-backend-api.md` §4 (CaseFormFields, CaseSessionPayload, CaseContext, NDJSON events), §5 (error codes, chat limits)
- `docs/ADR/001-ai-decision-pipeline.md` §3.3 (signal keys and option values), §4 (all data structures)
- `docs/ADR/003-frontend-chat-ui.md` §3.3 (StoredSession), §3.4 (typed UIMessage), §4
- AI SDK 7 `UIMessage` generic: verify with Context7 (`npx ctx7@latest docs /vercel/ai/ai_7.0.0 "UIMessage generic data parts tool parts typing"`)

## Files to create (exact layout, other tasks will import these names)
- `app/lib/schemas/enums.ts`
  - `CASE_TYPES = ["return","complaint"] as const`
  - `CATEGORIES = ["laptop","smartphone","tablet","desktop","monitor","tv","audio","wearable","other"] as const`
  - `DECISIONS = ["Akceptacja","Odrzucenie","Weryfikacja ręczna"] as const`
  - `ROUTES = ["rule","fast","escalated"] as const`, `REMEDIES = ["repair","replacement"] as const`
  - Types `CaseType`, `Category`, `Decision`, `Route`, `Remedy`, plus zod enums.
- `app/lib/dates.ts`: `todayInWarsaw(now?: Date): string` (YYYY-MM-DD in Europe/Warsaw via `Intl.DateTimeFormat`), `addYears(isoDate, n)`, `isValidIsoDate`.
- `app/lib/schemas/case-form.ts`
  - `MAX_IMAGE_BYTES = 10 * 1024 * 1024`, `MODEL_MIN = 2`, `MODEL_MAX = 100`, `REASON_MAX = 2000`, `COMPLAINT_REASON_MIN = 20`, `ALLOWED_IMAGE_TYPES = ["image/jpeg","image/png","image/webp"]`
  - `makeCaseFormFieldsSchema(today: string)` → zod object over the text fields `caseType, category, model, purchaseDate, reason, consent` (consent is the literal `true`). Model is trimmed (2–100). Reason is trimmed, max 2000, ≥ 20 when complaint (use `superRefine` with path `reason`). Date is not after today and not earlier than today minus 5 years. **Error messages are error codes** (`required`, `model_length`, `date_future`, `date_too_old`, `reason_too_short`, `reason_too_long`, `consent_required`, `invalid_option`). The UI maps codes to Polish via `pl.errors`.
  - `parseCaseFormData(formData: FormData, today)` helper for the server: text fields; `consent` "true" → true. Returns `{ success, data } | { success:false, fieldErrors: Record<field, code> }`.
  - `fieldErrorsFromZod(error)` → `Record<string, code>` (first error per field).
- `app/lib/schemas/decision.ts`: zod + types for `SignalAnswer {value, confidence, probabilities: Record<string,number>}`, `DecisionSignals` (ADR-001 4.2), `ImageFindings` (4.3, all fields), `EscalatedDecisionOutput` (4.3), `WriterOutput` (4.4), `SignalsSummary` (key → {value, confidence}), `CaseDecision` (4.5), `DecisionData` (data part payload, ADR-003 §4: decision, ruleRefs, kind "initial", remedy nullable), `UpdateRecommendationInput {decision, reason, ruleRefs}` and `UpdateRecommendationOutput {previousDecision, newDecision, reason, ruleRefs, updatedAt}` (ADR-001 4.6). Signal keys as constants `RETURN_SIGNAL_KEYS` / `COMPLAINT_SIGNAL_KEYS` and option lists `DAMAGE_TYPES`, `DAMAGE_LOCATIONS`, `CONDITION_LEVELS` (1..5 with names), `DAMAGE_CAUSES`, per ADR-001 §3.3.
- `app/lib/types/chat.ts`: `CaseUIMessage = UIMessage<never, { decision: DecisionData }, { update_recommendation: { input: UpdateRecommendationInput; output: UpdateRecommendationOutput } }>` (adapt to the actual AI SDK 7 generics) and part helper types.
- `app/lib/schemas/session.ts`: `CaseFormValues` (form without image), `CaseSessionPayload` (ADR-002 §4, `decision` = CaseDecision without `escalationReasons`/`guardsApplied`; `firstMessage` as a UIMessage-shaped object, assistant, id `initial-<caseId>`, parts: text greeting, data-decision, text body), `CaseContext` (ADR-002 §4), `ChatRequestSchema` `{id, messages (array, max 60), caseContext}` (message contents are validated later by `validateUIMessages`; here enforce count and that the last message is a user message whose text is 1–2000 chars after trim), `CasesStreamEvent` discriminated union (stage analysis|decision, result, error with codes `analysis_failed|model_unavailable|timeout`), `CasesErrorResponse {code: validation_failed|file_too_large|unsupported_media_type|server_misconfigured, fieldErrors?}`, `StoredSession {version:1, case, messages}`, `CHAT_MESSAGE_MAX = 2000`, `CHAT_MAX_MESSAGES = 60`.
- `app/lib/schemas/index.ts` re-exporting everything.
- `app/lib/i18n/pl.ts`: one exported `pl` object, `as const`. It includes: `disclaimer` (exact AC-29 text), `appName` "Hardware Service Decision Copilot", case-type labels and subtitles (PRD 9.1), category labels (AC-03 exact strings), field labels, placeholders per type, photo hints per type, personal-data note, consent text (AC-11 exact), submit "Wyślij zgłoszenie", `errors` (validation codes → AC-05/AC-09 exact texts where given; write short Polish texts for the others; file errors `file_too_large` "Plik przekracza limit 10 MB.", `unsupported_media_type` "Dozwolone formaty: JPG, PNG, WebP."), progress texts (PRD 9.2), analysis failure banner + "Spróbuj ponownie" (PRD 4.5), chat error "Nie udało się wysłać odpowiedzi." + "Ponów", "Zaktualizowana rekomendacja", input placeholder "Zadaj pytanie lub dodaj informacje…", new case "Nowe zgłoszenie" + confirm text (PRD 4.7) + confirm/cancel buttons, summary labels (AC-36), "Aktualizuję rekomendację…", "Nie udało się zapisać rozmowy w przeglądarce.", "Zmień zdjęcie", decision labels, remedy labels, generic server error text, form title/intro (PRD 9.1). Polish only.

## Tests (write first, run red against empty stubs, then green)
`app/tests/unit/schemas/case-form.test.ts`, `.../session.test.ts`, `.../i18n.test.ts`. Use a fixed `today = "2026-11-26"`. Cover: model 1/2/100/101 chars after trim; date today ok, tomorrow `date_future`, exactly 5 years ago ok, 5 years + 1 day ago `date_too_old`; complaint reason 19 vs 20 trimmed chars; return reason empty ok; reason 2001 → too long; consent false → `consent_required`; invalid category → `invalid_option`; `parseCaseFormData` on a FormData; chat request: 61 messages rejected, last-message text 0/1/2000/2001 chars; the NDJSON event union parses each kind; `pl.disclaimer` equals the AC-29 text exactly; `pl` category labels equal the AC-03 list in order. Size limit constant equals 10485760.

## Editable files
`app/lib/schemas/**`, `app/lib/types/**`, `app/lib/i18n/pl.ts`, `app/lib/dates.ts`, `app/tests/unit/schemas/**`. Nothing else.

## Forbidden
No commits, no `git add`, no dependency changes, no network calls, no reading `.env*` or `course-materials/`.

## Commands
`pnpm test -- tests/unit/schemas` (red, then green) · `pnpm typecheck` · `pnpm lint`

## Report (≤ 40 lines)
Files created · exported names (one line per file) · red output summary · green counts · typecheck/lint results · any ADR ambiguity and how you resolved it.
