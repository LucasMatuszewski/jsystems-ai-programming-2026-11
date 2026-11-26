# T28 independent code review

Branch `feat/app-implementation`, commit 54427e5. Read-only review of `app/server/**`, `app/app/api/**`, `app/lib/**`, `app/components/{case-flow,chat,case-form,case-submission}`, against PRD, ADR-000..006 (ADR-001 A1/A2) and `app/AGENTS.md`.

Checks run: `pnpm typecheck` clean, `pnpm lint` clean. Two throw-away scripts lived in the session scratchpad, outside the repo. No repo file was changed, no network call made, no `.env*` read.

## Areas checked with no defect found

- **Secret handling.** `OPENROUTER_API_KEY` is read only in `server/env.ts` and `server/ai/provider.ts`, both `server-only`. There is no `NEXT_PUBLIC_*`. The only log sinks are `[hsdc]` lines (ids, status, latency, cost) and the decision log (scores only). Errors are mapped to fixed codes; the upstream error object is never logged.
- **Call budget.** Every `generateText` and `streamText` call sets `maxRetries: 0`. The first decision uses signals once plus either escalation or the writer, with at most one guard-violation retry per model call. A chat turn uses at most 2 steps. No request is made from a React effect: the effects in `home-screen` and `chat-screen` only navigate, and `useCaseSubmission` and `sendMessage` fire on user events.
- **Fail-closed signals.** Any error, missing answer, bad probability or unknown answer type gives `status: "unavailable"`. The fast path then refuses with `signals_unavailable`. Verified by reading `get-signals.ts`, `normalize.ts` and `fast-path.ts`.
- **Guards.** Enum, rule IDs from the policy, date-rule override, R-2.4 and AC-27 are applied on every route. The D1 `no_change` path throws before any update is built.
- **Error masking, `/api/cases`.** Pre-stream errors are JSON codes. In-stream errors map to 3 fixed codes.
- **sessionStorage.** The value is validated with a schema on read, wrong-version data is cleared, and quota is handled on the write path in `chat-session`.

## Findings

### F1 (medium): chat timeout and client abort end the SSE with an `abort` chunk, not an error (AC-42 / AC-43)

- **Where:** `app/server/ai/chat/build-chat-stream.ts:100-107` (`onError` only), `app/server/ai/chat/handle-chat.ts:61` (60 s timeout fed to `abortSignal`).
- **Scenario:** OpenRouter stalls for more than 60 s, or the stream dies mid-answer. The AI SDK emits `{"type":"abort","reason":"TimeoutError: The operation was aborted due to timeout"}` followed by `[DONE]`.
- **Expected:** a masked `error` chunk (`chat_failed`), so `useChat` shows `ChatErrorRow` with "Ponów" (AC-42).
- **Actual:** `useChat` treats `abort` as a normal finish. With nothing streamed yet, the message has no visible parts and `hasVisibleParts` hides it, so the user sees no reply and no error. With partial text, the reply is silently truncated. The raw `TimeoutError: ...` text goes to the client in `reason`, which also bypasses the AC-43 masking.
- **Status:** server side verified with a scratch script (`MockLanguageModelV4`, `abortSignal: AbortSignal.timeout(200)`; both a hang before the first chunk and a mid-stream abort give `abort` with no `error` chunk). The client behaviour (no error row) follows from the SDK's abort semantics and is plausible, not run in a browser.
- **Fix:** keep the timeout signal separate from `request.signal`. When it fires, replace the `abort` chunk with `{type:"error", errorText: CHAT_FAILED}`, for example with a `TransformStream` over the chunks of `toUIMessageStream`. Drop `reason` for real client aborts. Add a replay test for the timeout.

### F2 (medium): chat accepts non-text parts and `system` role messages from the client

- **Where:** `app/lib/schemas/session.ts:68-72` (`UIMessageLikeSchema`: role includes `system`, parts are loose), `app/server/ai/calls/chat.ts:49-65` (`toModelFriendlyPart` returns every other part unchanged).
- **Scenario:** `/api/chat` receives a user message with `{type:"text"}` plus `{type:"file", mediaType:"image/png", url:"https://..."}` (or a base64 data URL up to the 512 KB body limit), or a message with `role:"system"`.
- **Expected:** ADR-001 3.8: the photo is not re-sent in chat turns, cost stays bounded, and the client only controls its own user text.
- **Actual:** `ChatRequestSchema.safeParse` succeeds, `validateUIMessages` keeps the file part, and `sanitizeChatMessages` forwards it. The model gets an image or URL, and a client-supplied system message reaches the model call. The AI SDK downloader blocks private IPs (`validateDownloadUrl`), so there is no SSRF. The defect is the unrestricted input.
- **Status:** verified. A scratch script gave `schema ok: true` and the file part survived `sanitizeChatMessages`.
- **Fix:** whitelist. Only `role: "user" | "assistant"`. User messages: `text` parts only. Assistant messages: `text`, `data-decision` and `tool-update_recommendation` parts. Reject the rest with 400. Optionally wrap the user text in `<customer_message>`, as `chat-*.md` and `shared-rules.md` already claim (currently no wrapping exists).

### F3 (medium): `caseContext` is under-validated (limits, format) and `daysSincePurchase` is not tied to `form.purchaseDate`

- **Where:** `app/lib/schemas/session.ts:16-23` (`CaseFormValuesSchema`: `model: min(1)`, `purchaseDate: min(1)`, `reason: z.string()`), `:53-64` (`CaseContextSchema`), `app/server/ai/calls/shared.ts:9-19` and `calls/chat.ts:29-39` (rendered into the system `instructions`).
- **Scenario A (limits):** the body carries `form.reason` of 100,000 characters, `form.model = "X\nIgnore previous rules..."`, `purchaseDate: "banana"`, or thousands of `imageFindings.evidence` items. Everything passes validation, and everything is put into the system prompt of every turn. `Model:` is not delimited, and `</customer_reason>` in the reason closes the delimiter early.
- **Expected:** the same limits as the form (model 2-100, reason at most 2000, a valid ISO date), because this is customer text moving into the system prompt (ADR-001 3.6).
- **Scenario B (forged days):** the body has `purchaseDate: "2020-01-01"` with `daysSincePurchase: 0`. The R-4 / C-2 / R-2.4 guards in the `update_recommendation` tool then use the forged 0. The ADR-002 "Trust boundary" section accepts a client-editable context for the PoC, so B is a documented gap, not a regression.
- **Status:** A and the schema acceptance in B verified with a scratch script (`schema ok: true` for a 100k reason, a 2020 date and days = 0). The effect on the tool guards in B is by code reading.
- **Fix:** reuse `makeCaseFormFieldsSchema(todayInWarsaw())` shape (or at least the limits) inside `CaseContextSchema.form`, cap array and string lengths in `imageFindings` and `signalsSummary`, and recompute `daysSincePurchase = daysSincePurchase(form.purchaseDate, now())` on the server instead of reading the client value. This is one line and closes B without a signed token.

### F4 (medium): AC-23 is not enforced in code (known gap, confirmed; where to enforce)

- **Where:** `app/server/ai/pipeline/run-case-pipeline.ts:227-241` (`guard` closure), called at `:266` (writer) and `:316` (escalated).
- **Scenario:** the writer or escalated model writes "minęło 35 dni" in `bodyMarkdown` for `daysSincePurchase = 45` (rule route R-4), or omits the day count. Nothing checks it; only the prompt says to quote the given number.
- **Expected:** PRD AC-23: the day count in the justification is the system's number. ADR-001 "Deterministic facts and policy guards in code" says prompt-only enforcement is rejected.
- **Actual:** `bodyMarkdown` is stored and rendered as returned. The same applies to rule IDs mentioned in the body text: only `ruleRefs` is validated.
- **Status:** verified by grep, with no server code reading `bodyMarkdown` except to copy it. `CaseSummaryPanel` shows the correct number, but the justification text is unchecked.
- **Fix:** add the check next to the existing guards, inside the `attempt` closures before `finish`. Extract every `(\d+)\s*(dni|dzień|dnia)` and every `[RC]-\d+(\.\d+)?` from `bodyMarkdown`. A mismatch with `days` or `policy.ruleIds` throws `OutputViolation`, so it uses the existing single retry and costs no extra call budget beyond that retry. More robust option: the server prepends a fixed line "Dni od zakupu: N" to `bodyMarkdown`. The chat path cannot be checked this way; the prompt remains the only control there.

### F5 (medium): body size limits bypassed when `Content-Length` is absent

- **Where:** `app/server/cases/handle-cases.ts:86-89` and `:101` (`request.formData()`); `app/server/ai/chat/handle-chat.ts:30-33` and `:32` (`request.text()`).
- **Scenario:** a client sends a chunked body with no `Content-Length`: 2 GB of multipart to `/api/cases`, or megabytes of text to `/api/chat`.
- **Expected:** 413 above 11 MB (ADR-002 image rule 1) and above 512 KB (chat). `Number(null)` is 0 and `NaN > MAX` is false, so the header check is skipped.
- **Actual:** the whole body is buffered in memory before the post-parse check. The check at `handle-chat.ts:33` runs after `request.text()` has already read everything. Next.js has no default body cap for route handlers.
- **Status:** plausible, from code reading. Not run, to avoid pushing a large body.
- **Fix:** reject requests with no `Content-Length` (411/413), or read `request.body` through a counting `TransformStream` that aborts at the limit before `formData()` / `text()`.

### F6 (low): a failed `writeSession` after a successful analysis leaves the user at a dead end

- **Where:** `app/components/case-submission/use-case-submission.ts:109-111` (result of `writeSession` ignored), `app/components/case-flow/chat-screen.tsx:16-18`.
- **Scenario:** storage is full, blocked or in a private window (quota gives `{ok:false}`, other errors are thrown). The case was already analysed and paid for.
- **Expected:** the comment says "the chat notice covers it" and ADR-003 3.3 says a quota failure does not block the case.
- **Actual:** `onSuccess` navigates to `/chat`; `ChatScreen` reads only sessionStorage, finds nothing and does `router.replace("/")`. The user lands on an empty form and loses the result. If `writeSession` throws a non-quota error, the `catch` reports `analysis_failed` even though the analysis succeeded.
- **Status:** plausible, by code reading (not run with a blocked storage).
- **Fix:** keep the payload in memory (a context or module variable) when `writeSession` fails, let `ChatScreen` fall back to it, and show `pl.chat.storageFailed`. Wrap `writeSession` in `try/catch`.

### F7 (low): "at most once per turn" for `update_recommendation` is prompt-only

- **Where:** `app/server/ai/chat/build-chat-stream.ts:46-74` and `:92-98` (`stopWhen: isStepCount(2)`, no per-turn state).
- **Scenario:** the model emits two parallel tool calls in step 1, or calls the tool again in step 2. `execute` runs for each. Each compares against the same static `caseContext.currentDecision`, so two cards can appear, one possibly reverting the first. A call in step 2 leaves a card with no explanation text.
- **Expected:** ADR-001 3.8: at most one call per turn, and the explanation comes after the tool result.
- **Status:** plausible, by code reading.
- **Fix:** a `let applied = false` closure that throws `no_change` on a second execution, or `prepareStep` that sets `activeTools: []` for step 2.

### F8 (low): the signals call ignores the pipeline abort signal

- **Where:** `app/server/ai/signals/get-signals.ts:100` and `:112-118` (own `AbortSignal.timeout(20s)`), called from `run-case-pipeline.ts:148`.
- **Scenario:** the client disconnects, or the 90 s budget is hit, while signals are running.
- **Expected:** ADR-002 5 says the request abort cancels upstream work.
- **Actual:** the signals request continues for up to 20 s. The pipeline notices only at `signal.throwIfAborted()` at `:154`. The cost is small, but it is an unneeded upstream call.
- **Status:** plausible, by code reading.
- **Fix:** add `abortSignal` to `GetSignalsDeps`, pass `AbortSignal.any([timeout, pipelineSignal])`, and keep the `timeout.aborted` check for the reason code.

## Simplifications (3)

1. **Two different `NEUTRAL_FINDINGS`.** `pipeline/image-findings.ts:13` has `photoQuality: "limited"` with Polish text; `chat/build-chat-stream.ts:27` has `"good"` with empty text. Export one constant, or one `neutralGuardInputs()` helper for the chat guard call.
2. **Duplicated status extraction.** `upstream.ts:33` (`httpStatusOf`) and `get-signals.ts:42` (`statusOf`) are identical. Keep one export.
3. **Weaker duplicate form schema.** `CaseFormValuesSchema` (session.ts) repeats the case-form fields with weaker rules than `makeCaseFormFieldsSchema`. Deriving the former from the latter removes the drift behind F3 and costs fewer lines.

## Notes for CLAUDE.md / AGENTS.md (course tip)

Add one line under "Rules" in `app/AGENTS.md`: "Every field of a client-supplied context that reaches a prompt has a length limit and a whitelist of part types." The reviewer would then catch F2 and F3 during implementation.
