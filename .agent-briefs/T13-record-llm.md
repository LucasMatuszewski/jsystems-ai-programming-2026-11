# Brief T13 — Call builders + real recordings of gpt-6-luna (decision, writer, chat)

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read `app/AGENTS.md`. Targeted tests: `pnpm exec vitest run <paths>` inside `app/` (the `pnpm test -- <path>` filter does not work).

## Goal
1. Pure **call builders** in `app/server/ai/calls/` that later tasks (T16 pipeline, T23 chat agent) must reuse unchanged, so the recordings match production requests:
   - `escalation.ts`: `buildEscalationCall({ caseInput, days, signals, image: {buffer, mediaType}, policy, reasoningEffort, model })` → the options object for `generateText` with `Output.object({ schema: EscalatedDecisionOutputSchema })`, `instructions` from `loadPrompt("decision-return"|"decision-complaint")` + the policy text, a user message with a file part (image) + a text part with the case data (category, model, purchase date, days since purchase computed by the system, reason wrapped in `<customer_reason>`), and the signals block (or "signals unavailable").
   - `writer.ts`: `buildWriterCall({ caseInput, days, decision, ruleRefs, imageFindings, signalsSummary, policy, reasoningEffort, model })` → `generateText` options with `Output.object({ schema: WriterOutputSchema })` and the `writer` prompt. No image.
   - `chat.ts`: `buildChatCall({ caseContext, messages, policy, model, reasoningEffort, tools })` → `streamText` options: `instructions` = `chat-<type>` prompt + policy + case context block, `messages` from `convertToModelMessages` (convert `data-decision` parts to short text like "[Rekomendacja: Akceptacja, reguły R-2]", and update-tool parts likewise), `stopWhen` 2 steps. Export `updateRecommendationToolSchema` (input schema only, no execute) for T23.
   - Reasoning effort through the AI SDK provider-agnostic `reasoning` option (ADR-001 §3.1). Do NOT also set it in `providerOptions`. Verify the exact option name in `node_modules/ai` 7.0.118 types or Context7 `/vercel/ai/ai_7.0.0`.
   - Provider: `createOpenRouter({ apiKey, fetch, headers: {"HTTP-Referer": APP_URL, "X-OpenRouter-Title": APP_TITLE} })` from a small factory `app/server/ai/provider.ts` (`createProvider({ fetch? })`, uses `getEnv()` from `@/server/env`).
   Use: `loadPrompt` (`@/server/ai/prompts`), `loadPolicy` — if `app/server/ai/logic/policy.ts` does not exist yet (another worker, T09, is writing it now), read the policy file text directly in the recorder and do NOT import logic/. Contracts from `@/lib/schemas`. Image preprocessing: `prepareForModel` from `@/server/image`.
2. Extend `app/scripts/record-openrouter.ts` with a `llm` command (keep the existing commands working) that records, with the same HTTP-level recording fetch and fixture format as T06 (`meta`, `exchanges`, `sdkResult`/`stream chunks`, `error`), into `app/tests/fixtures/openrouter/llm/`:
   - `escalated-return-laptop-2.json`: return, laptop, 10 days, no reason, `laptop-2.webp`, signals unavailable, effort high.
   - `escalated-complaint-phone-1.json`: complaint, smartphone, 400 days, reason "Ekran zaczął migać i pojawiły się kolorowe pasy, telefon nigdy nie upadł.", `phone-1.jpg`, signals unavailable, effort high.
   - `writer-rule-return-r4.json`: return 45 days, decision Odrzucenie, ruleRefs ["R-4"], reason "Laptop przestał się ładować po miesiącu.", imageFindings from the escalated-return recording's output, effort low.
   - `writer-rule-complaint-c2.json`: complaint 800 days, Odrzucenie, ["C-2"], effort low.
   - `chat-plain.json`: streamText with the chat-return prompt, the case context built from the escalated-return result, the first message as an assistant UIMessage (greeting text, data-decision part, body text), and the user question "Jaki model urządzenia zgłosiłem?". Record the full SSE/stream chunk sequence (HTTP body verbatim) and the UI message stream chunks produced by `toUIMessageStream`.
   - `chat-tool-update.json`: the complaint context, the user message "Chcę dodać ważny fakt: telefon był w etui i nigdy nie miał kontaktu z wodą, a pasy pojawiły się po aktualizacji systemu." with the `update_recommendation` tool given an execute that returns a fixed shape built from the input (previousDecision from context, `updatedAt` from a fixed clock). Record both steps. If the model doesn't call the tool, try ONE more realistic fact message; if it still doesn't call it, save what it did and list "tool call not obtained" in GAPS.md.
   - Reasoning: note whether reasoning chunks appear in any recorded stream (they must later be filtered); if none, add to GAPS.md (TAC-001-07).
   - `errors/chat-401.json`: chat call with an invalid key (`sk-or-v1-invalid`).
   - `meta` also records `promptVersions` used.
3. Unit tests (first red, then green) in `app/tests/unit/calls/*.test.ts`: the builders produce the expected structure (instructions contain the policy and prompt version text, image part present only in escalation, reason wrapped in delimiters, data parts converted to text, no disclaimer). Add one replay test per recording type in `app/tests/integration/replay-llm/*.test.ts` that runs the builder output through the REAL SDK (`generateText`/`streamText`) with `replayFetch` from `app/tests/helpers/replay-fetch.ts` and asserts the parsed output validates against the schema (escalated/writer) or the stream yields text (chat).

## Budget and spend
`pnpm openrouter:status` before and after, append a row to `docs/qa/spend.md`. Max 12 real calls in total. Stop if remaining credit < USD 1.

## Editable files
`app/server/ai/calls/**`, `app/server/ai/provider.ts`, `app/scripts/record-openrouter.ts`, `app/tests/fixtures/openrouter/llm/**`, `app/tests/fixtures/openrouter/errors/chat-401.json`, `app/tests/fixtures/GAPS.md`, `app/tests/unit/calls/**`, `app/tests/integration/replay-llm/**`, `docs/qa/spend.md`. Nothing else. Other workers are editing `app/server/ai/logic/**` (T09) and `app/components/case-form/**` (T15) right now.

## Forbidden
No commits/`git add`, no dependency changes, never read `.env*`, no hand-written response bodies, no generated images, do not describe the photo to the model.

## Report (≤ 40 lines)
Files · builder signatures · each recording: status, decision/answer excerpt (≤ 120 chars), tokens/cost · tool call obtained? reasoning chunks seen? · test counts red→green · typecheck/lint · spend · gaps.
