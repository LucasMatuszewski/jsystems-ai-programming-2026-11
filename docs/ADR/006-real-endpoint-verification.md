# ADR-006: Real-Endpoint Verification — Recorded Mocks, Call Accounting, Manual Gates

**Date:** 2026-11-26
**Status:** Accepted (user, 2026-11-26)
**Relates to:** `AGENTS.md` (TDD Rules: mocks from fresh real captures; Manual QA), `docs/ADR/000-main-architecture.md` §10, ADR-001 §8, ADR-002 §8, ADR-003 §8

---

## 1. Scope

Defines how tests and manual checks stay tied to real endpoints:
1. Every mock of an endpoint in unit, component and integration tests (OpenRouter **and** our own `/api/cases`, `/api/chat`) is a replay of a recorded real call.
2. Every upstream model call is counted and visible, so unnecessary calls are detectable.
3. Provider-side limits (credits, rate limits) are checked before real-endpoint runs.
4. Manual verification gates use the running application interactively against real models.

Overrides the test-double wording in ADR-000/001/002/003 where they differ (those sections now point here).

---

## 2. Technology Documentation References

| Tool | Context7 ID or official docs | Used for |
|---|---|---|
| AI SDK 7 test helpers | `/vercel/ai/ai_7.0.0` (`ai/test`: `MockLanguageModelV4`, `simulateReadableStream`) | Replaying recorded model results and stream chunks |
| OpenRouter API key/limits endpoint | https://openrouter.ai/docs/api-reference/limits (verify exact path and fields in T04) | Credit and rate-limit pre-check |
| OpenRouter errors | https://openrouter.ai/docs/api/reference/errors-and-debugging | Which error classes exist (not used as response bodies) |
| Playwright CLI | `playwright-cli --help` (installed 2026-11-26) | Interactive manual QA: `open`, `snapshot`, `fill`, `select`, `upload`, `click`, `type`, `press`, `screenshot`, `console`, `requests`, `request <n>`, `network-state-set`, `sessionstorage-list`, `reload`, `resize` |

---

## 3. Component Design

### 3.1 Recordings (single source for all endpoint mocks)

| Recording set | Location (inside `app/`) | Produced by | Content |
|---|---|---|---|
| OpenRouter | `tests/fixtures/openrouter/` | `scripts/record-openrouter.ts` (run by ORCH) | Raw provider results as the SDK receives them: decisions answers, structured `generateText` results, `streamText` chunk sequences (incl. tool calls and reasoning chunks if emitted), real error results |
| Own endpoints | `tests/fixtures/app/` | `scripts/record-app.ts` (run by ORCH) sends real HTTP requests with the example photos to the running app (`pnpm start`, real `.env.local`) and saves the verbatim responses; exchanges seen during manual sessions may also be saved from `playwright-cli request <n>` | `/api/cases` NDJSON bodies (each route, 400 from server-side validation, 415 with `assets/logo.svg`, upstream-failure error event with an invalid key), `/api/chat` SSE bodies (plain answer, recommendation update, masked failure, 400), status + headers. 413 is a documented gap: no real photo exceeds 10 MB and generated files are forbidden |

Every recording file carries metadata: capture date/time, target (URL path or model ID), request summary (synthetic inputs, photo file name, no secrets), app commit, SDK/provider package versions, model endpoint/provider reported by OpenRouter.

**Rules**
- No hand-written response bodies, no scripted streams (the `@shadcn/helpers/ai-sdk` scripted transport is not used for tests), no bodies copied from documentation.
- **Derived variants** are allowed only by changing *values* of fields that exist in a named base recording (e.g. a decision value, one probability) to reach a boundary; structure, field set and chunk order stay identical. Each variant names its base recording and the changed fields.
- **Errors:** record what can be produced safely and for real — invalid API key (401) and connection failure (base URL pointing to a closed local port, a real network error with no body). Refusals are recorded if a harmless prompt produces one. 402/429/503/mid-stream errors are **not** provoked; they are listed in `tests/fixtures/GAPS.md` as uncaptured and are covered only through the generic error path exercised by the real 401 and connection-failure recordings.
- **Refresh and drift:** recordings are refreshed whenever a prompt version, schema, model ID or package version they depend on changes. `scripts/record-openrouter.ts --compare` re-requests live and reports structural differences (keys, types, chunk types) — run at every manual gate.
- Pure functions over the app's own internal types (date math, gate, guards, normalizers given already-parsed values) need no recording because nothing external is mocked; their inputs come from recordings where a realistic value is needed.

### 3.2 Upstream call accounting

- Every outbound model call goes through one wrapper in `server/ai` that logs exactly one console line on completion: `requestId` (per incoming HTTP request), `stage` (`signals` | `escalated` | `writer` | `chat-step`), model ID, HTTP status/outcome, latency, OpenRouter cost when reported. No prompts, customer text or image data.
- `/api/cases` and `/api/chat` also log one line per incoming request with the same `requestId`, so browser → app → OpenRouter calls can be correlated.

**Expected call budget** (any deviation is a defect):

| User action | Browser → app | App → OpenRouter |
|---|---|---|
| Open `/` or `/chat`, refresh with stored session, type in fields | 0 | 0 |
| Submit with validation errors | 0 | 0 |
| Valid submission, route `rule` or `fast` | 1 × `POST /api/cases` | 1 signals + 1 writer |
| Valid submission, route `escalated` | 1 × `POST /api/cases` | 1 signals + 1 escalated (+1 only for a logged guard retry) |
| Signals unavailable | 1 × `POST /api/cases` | 1 failed signals + 1 escalated |
| Chat turn without update | 1 × `POST /api/chat` | 1 chat-step |
| Chat turn with `update_recommendation` | 1 × `POST /api/chat` | 2 chat-steps (tool step + text step) |
| "Ponów" after a failed reply | 1 × `POST /api/chat` | as a chat turn |
| "Nowe zgłoszenie" confirm/cancel | 0 | 0 |

Checked in development mode too, where React Strict Mode double-invokes effects: a duplicated request there is a defect (requests must be event-driven, not effect-driven).

### 3.3 No mock mode, no artificial usage caps

- The application has no mock/demo/offline mode and no environment flag that replaces a model. Test doubles exist only under `tests/`.
- No app-side quotas or call throttles beyond the input limits in the PRD and ADR-002 (message length, 60 messages per chat request). Manual gates never disable the fast path or models to save cost.

### 3.4 Provider limit pre-check

`pnpm openrouter:status` prints, for the configured key: credit limit, usage, remaining credit, free-tier flag and rate-limit information as returned by OpenRouter's key endpoint, plus whether `LLM_MODEL` and `DECISION_MODEL` currently list an available endpoint. It never prints the key. A gate starts only if remaining credit covers the gate's estimated cost and no rate limit blocks it; the before/after usage is recorded as the gate's cost.

**Spend cap (user decision 2026-11-26):** cumulative OpenRouter spend for the whole implementation is capped at **USD 5**. Every real-endpoint run (recordings, gates, E2E, evaluation, demo video) appends before/after usage to `docs/qa/spend.md`; when the cumulative total reaches USD 4.50, work stops and the user is asked.

### 3.5 Manual verification gates

Run by the orchestrator after each phase, on `pnpm build && pnpm start` with real `.env.local` (and one pass on `pnpm dev`):
1. Limit pre-check (3.4) and recording drift check (3.1).
2. **Interactive use, not a script:** one `playwright-cli` command at a time; after each `snapshot` the agent decides the next action from what it sees. Not allowed in gates: pre-written command sequences, `run-code`, `recording-start/stop` replays, `route`/`unroute` (network mocking), the E2E suite as a substitute.
3. In chat, the agent improvises each question from the previous answer (real-time conversation), covering: a clarifying question, a policy question, a new relevant fact, insistence without new facts, an off-topic question and an instruction-injection attempt.
4. Call budget verified for every action (3.2) from `playwright-cli requests`, server log lines and OpenRouter usage delta.
5. `console` shows no errors; screenshots of every touched screen at 1440 px and 360 px; Polish text; brand comparison.
6. Evidence in `docs/qa/<gate>/report.md` + PNG screenshots, committed to the repository for the user's review. Defects found → fix tasks in the same phase and the gate is re-run; the next phase does not start until the gate passes.
7. **Final demo video** (after the last gate and review fixes): an interactive walkthrough recorded with `playwright-cli video-start` / `video-chapter` / `video-show-actions` / `video-stop`, converted with ffmpeg to H.264 MP4 (≤ 10 MB, 1280 px wide) and committed as `docs/qa/final/demo.mp4`. ffmpeg is not installed on the VM and `sudo` is denied: install a static build with `pip install --user imageio-ffmpeg` (binary path from `imageio_ffmpeg.get_ffmpeg_exe()`); fallback `pnpm dlx ffmpeg-static` (prompted).

---

## 4. Technical Decisions

### Replay recorded calls as the only kind of endpoint mock
**Status:** Accepted · **Date:** 2026-11-26
**Context:** AGENTS.md requires mocks derived from fresh real captures; the user confirmed this for unit and integration tests. Earlier ADR text allowed scripted transports and hand-written error bodies.
**Decision:** As 3.1, including our own endpoints; uncapturable errors are documented gaps, not invented bodies.
**Rejected alternatives:** Scripted/hand-written streams (drift from real shapes); documentation-derived bodies (may be stale).
**Consequences:** (+) tests fail when real shapes change (drift check); (−) frontend tests that need endpoint responses can only be written after the endpoint exists and is recorded, which reorders the plan; recording costs a little API credit.
**Review trigger:** A provider adds an official sandbox with documented test responses.

### Count every upstream call and gate phases on real use
**Status:** Accepted · **Date:** 2026-11-26
**Context:** The user wants proof after each phase that the app works against real endpoints, without unnecessary calls and without hitting limits.
**Decision:** Call log wrapper + expected call budget + limit pre-check + interactive manual gates.
**Rejected alternatives:** Relying on E2E only (automation can pass falsely; AGENTS.md); counting from OpenRouter dashboard only (no per-request correlation).
**Consequences:** (+) duplicate/unneeded calls are caught early; (−) each gate costs real credit and orchestrator time.
**Review trigger:** Gate cost or duration becomes a bottleneck.

---

## 5. Testing Strategy

| Scenario | Type | Expected |
|---|---|---|
| Recording metadata | Unit (scans `tests/fixtures/**`) | every file has date, target, request summary, versions; no `sk-or-` strings, no base64 image data in own-endpoint recordings except the thumbnail field |
| Variant discipline | Unit | every derived variant names an existing base recording and only changes listed fields (structural equality check) |
| No mock mode | Static check | no imports from `tests/` or `ai/test` in `app/`, `server/`, `lib/`, `components/` production code |
| Call log | Integration (recorded replay) | one log line per upstream call with correct stage; none on validation errors |

- TAC-006-01: 100% of endpoint doubles in unit/component/integration tests load a file from `tests/fixtures/openrouter/` or `tests/fixtures/app/` (enforced by the variant/metadata scan).
- TAC-006-02: Every manual gate report states measured vs expected call counts per action, with zero unexplained extra calls.
- TAC-006-03: Every gate report records OpenRouter usage before and after and confirms no 402/429 occurred.
