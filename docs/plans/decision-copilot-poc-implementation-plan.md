# Implementation Plan — Hardware Service Decision Copilot PoC (whole application)

**Status:** ACCEPTED (rev. 3, 2026-11-26) by the user. Execution starts in a new session on a new implementation branch (`feature/decision-copilot-poc`) created from this docs branch; merging still requires the user.
**Scope:** the complete PoC defined by [PRD](../PRD.md), on one feature branch (user decision 2026-11-25: whole app instead of a single slice).
**Architecture:** [ADR-000](../ADR/000-main-architecture.md) · [ADR-001 AI pipeline](../ADR/001-ai-decision-pipeline.md) · [ADR-002 backend](../ADR/002-backend-api.md) · [ADR-003 frontend](../ADR/003-frontend-chat-ui.md) · [ADR-004 setup](../ADR/004-project-setup-and-tooling.md) · [ADR-005 agent tooling](../ADR/005-agent-execution-tooling.md) · [ADR-006 real-endpoint verification](../ADR/006-real-endpoint-verification.md) (both Accepted 2026-11-26)
**Design guidance:** [design-guidelines.md](../design-guidelines.md); references `assets/homepage-desktop.png`, `assets/homepage-mobile.png`, `assets/design-tokens.json`
**Policies:** `docs/policies/return-policy.md`, `docs/policies/complaint-policy.md`

**Rev. 2 changes (user feedback 2026-11-26):**
- A manual verification gate (G1–G4) after every phase, run against real endpoints by using the app interactively, with call-budget and provider-limit checks ([ADR-006 §3.2–3.5](../ADR/006-real-endpoint-verification.md#3-component-design)).
- All endpoint mocks in unit, component and integration tests are replays of recorded real calls, including our own `/api/*` endpoints ([ADR-006 §3.1](../ADR/006-real-endpoint-verification.md#3-component-design)). The test wording in ADR-000/001/002/003/004 was aligned with this.
- Phases reordered so that each phase ends with a runnable increment, and every recording exists before the tests that replay it.

**Rev. 3 changes (consistency review, 2026-11-26):**
- **Dependency cycle removed.** T18 and T24 recorded own endpoints "by hand" before the UI that calls them existed (T22 depends on T18). They now record through `scripts/record-app.ts`, which sends real HTTP requests to the running app. Manual browser use stays in the gates.
- **E2E specs annotated `test.fail()`.** T07 specs are committed as expected-to-fail (AGENTS.md allows commits only after verification passes), and each wiring task removes the annotation for its flows.
- **Task-level manual checks.** Every task that changes the running app (AGENTS.md Manual QA) now has a short manual check, in addition to the phase gates.
- **No 15 MB/HEIC upload tests.** Example photos cannot be generated and none is larger than 10 MB, so the wrong-type case uses the real `assets/logo.svg`; the size limit is checked on byte counts.
- **Script entries registered in T04.** Workers never edit `package.json`.
- **New task T30 (demo video + PR).** The final demo video is recorded and converted with ffmpeg; it adds an issue (33 in total).
- **PRD/ADR corrections:**
  - PRD 4.1 now points to Flow 4.7.
  - PRD AC-21 order made consistent with AC-29: the disclaimer is attached to the badge.
  - PRD AC-40 now allows the anonymised decision log.
  - PRD 11.1 has an implementation note.
  - The first message is split into greeting / decision / body.
  - The fast path for days 15–30 requires visible packaging (R-3/R-6.1).
  - The AC-27 guard also uses the LLM's own findings.
  - `deps` injection is added to the AI entry points.
  - The thumbnail is now 640 px so that "click to enlarge" makes sense.
  - The error-code mapping is explicit.
  - ADR-004 pnpm/README steps no longer need root or `rm`.

**Rev. 4 changes (user feedback 2026-11-26, during execution):**
- **ORCH only orchestrates:** it writes briefs, reads diffs and evidence, accepts or rejects, commits and updates the tracker. It edits no app code, runs no long commands and does no browser QA.
- **Owner override:** every row marked ORCH is executed by a worker: Sonnet subagents for shared or risky rows (T03–T06, T12, T13, T16, T18, T22–T25, T27, T29, T30), Haiku/OpenCode as before. Only one worker at a time edits `app/package.json` / lockfile, and its brief names those files.
- **Gates G1–G4 and the final check:** run by a fresh QA subagent (Sonnet) following §4, writing `docs/qa/<gate>/report.md` plus screenshots. ORCH spot-checks screenshots and call counts before accepting.
- **Briefs reference document sections** instead of pasting them; ORCH asks a doc-reader subagent when it needs facts.
- **Secrets:** nobody reads `.env`. The app and scripts load the repository-root `.env` (then `app/.env.local`) at runtime.

**Rev. 5 changes (user decision 2026-11-26, during execution):**
- **Decision model switched to TypeSafe Jev 1.14** (`typesafe/jev-1.14`, pinned, never `~typesafe/jev-latest`) replacing `openai/gpt-6-luna-decisions`; see ADR-001 A2.
- **T06c added:** worker brief that switches the model, rewrites the question criteria (option descriptions, explicit boolean criteria), re-records the four decision recordings (Luna ones archived in `app/tests/fixtures/openrouter/decisions/archive-luna/`) and updates the ADRs and tests. Spend is logged in `docs/qa/spend.md`.
- **T06/T10/T26 descriptions** now refer to the decision model generically; the 0.8 fast-path threshold is uncalibrated for Jev and is tuned via T26.
- **§6 fallback row** renamed "decision model unusable".

---

## 1. Current state (inspected 2026-11-25/26)

| Item | Observed |
|---|---|
| Branch | `docs/prd-adr-plan` (created from `design-system`; `design-system` is 20 commits ahead of `origin/design-system` and unpushed; open PR #6 `design-system` → `main`) |
| Working tree | `M .mcp.json`, `?? binary-assets.json` (unrelated, left untouched); `docs/ADR/000–006` and this plan **uncommitted** |
| PRD / policies | Committed in `7d4c4b0` (local `design-system` history) |
| Application | `app/` contains only `README.md`. No `package.json`, entry points or tests |
| Tests / build | None exist, so there is **no baseline failure** to report. The first runnable baseline is created in T03/T04 |
| Agent config | Root `AGENTS.md`/`CLAUDE.md`; `.claude/settings.json` (allow/deny lists, `plansDirectory: ./docs/plans`); no `.claude/agents/` (no named roles); `.codex/config.toml` |
| Tracker | GitHub issues enabled, 0 issues, default labels; `gh` authenticated with admin rights |
| ffmpeg | Not installed; no `sudo` → static build via `pip install --user imageio-ffmpeg` in T30 ([ADR-006 §3.5](../ADR/006-real-endpoint-verification.md#3-component-design)) |
| Unpushed history | Local `design-system` = `origin/design-system` + 18 commits merged from `origin/main` (already on `main`) + PRD commit `7d4c4b0` + merge `99797b1` |

### Commands verified in this session

| Command | Result |
|---|---|
| `node --version` | v24.22.3 |
| `corepack pnpm --version` | 12.23.0; plain `pnpm` **not on PATH** → [ADR-005 §3.1](../ADR/005-agent-execution-tooling.md#3-component-design) |
| `opencode --version` / `opencode run --help` | 1.19.0; headless flags `-m`, `--variant`, `--format json`, `-f`, `--title`, `-s`, `--auto` (not used) |
| `opencode models openrouter` / `opencode auth list` | `openrouter/openai/gpt-6-luna` available; one OpenRouter credential |
| `claude --version` | 2.1.332; Agent tool exposes `model: haiku` / `sonnet` (not yet exercised) |
| `playwright-cli --help` | Interactive commands present: `open`, `snapshot`, `fill`, `select`, `upload`, `click`, `type`, `press`, `screenshot`, `console`, `requests`, `request <n>`, `network-state-set`, `sessionstorage-list`, `reload`, `resize` |
| `gh api repos/…` | `has_issues: true`, push/admin permissions |

Not verified yet: OpenCode under a project permission file (T02); the exact OpenRouter key/limits endpoint used by `pnpm openrouter:status` (T04).

---

## 2. Delivery approach

- **Branches:** `docs/prd-adr-plan` carries PRD + ADRs + this plan → one docs PR. Implementation runs on `feature/decision-copilot-poc`, branched from `docs/prd-adr-plan` after the docs PR is approved. One checkout, no worktrees (parallel tasks have disjoint files).
- **Phases end with a runnable increment and a manual gate:** P1 foundation (template chat over OpenRouter) → P2 form to first decision → P3 chat → P4 hardening and delivery. The next phase starts only when the gate passes.
- **TDD in every implementation row:** the worker writes the behavioral test first, records the failing run (red evidence), then implements to green. T07 writes the E2E acceptance specs early (Wave A) with `test.fail()` annotations so the committed suite stays green; wiring tasks remove the annotation for their flows and must see them pass.
- **Test doubles:** only replays of recordings from `app/tests/fixtures/openrouter/` (made by T06/T13) and `app/tests/fixtures/app/` (made by T18/T24). Derived variants change values only; uncapturable errors go to `GAPS.md` ([ADR-006 §3.1](../ADR/006-real-endpoint-verification.md#3-component-design)). E2E and manual gates mock nothing.
- **Task-level manual check:** every task that changes what the running app does (T03, T14, T17, T22, T23, T25, fixes) ends with a short real-endpoint check of the touched screen or endpoint before commit; the phase gates are the full checks.
- **Spend cap:** cumulative OpenRouter spend ≤ USD 5, logged in `docs/qa/spend.md`; stop and ask at USD 4.50 ([ADR-006 §3.4](../ADR/006-real-endpoint-verification.md#3-component-design)).
- **Commits:** one commit per row after the orchestrator has read the diff and re-run the row's checks. Workers never commit, push, install dependencies or edit files outside their list. Format `Area: summary`.
- **Commands** (inside `app/`, created in T03/T04; `pnpm` = shim from ADR-005, else `corepack pnpm`): `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test -- <path>`, `pnpm build`, `pnpm start`, `pnpm dev`, `pnpm test:e2e`, `pnpm openrouter:status`, `pnpm record:openrouter [--compare]`, `pnpm record:app`, `pnpm eval:decisions`. Reports list build, tests (discovered/passed/skipped) and startup as separate results.

### Owners / models

| Owner label | Mechanism | Used for |
|---|---|---|
| **ORCH** | This Claude Code session (Opus 5.5) | Architecture decisions, shared contracts, lockfile, prompts, recordings, integration, **all manual gates**, review acceptance, commits, tracker |
| **HAIKU** | Claude Code Agent tool, ad hoc `general-purpose` subagent, `model: haiku` | Bounded test-writing and implementation |
| **OC-LUNA** | `opencode run -m openrouter/openai/gpt-6-luna` headless (§8) | Bounded self-contained modules (external-model delegation) |
| **REVIEW** | Fresh Claude Code subagent, `model: sonnet`, given only the diff and document links | Independent review (T28) |

If the Agent tool or OpenCode is unavailable, ORCH executes the same matrix sequentially.

---

## 3. Dependency matrix (authoritative)

Issue numbers are assigned in T01; Claude Code session tasks are then titled `#<issue> <ID> <name>`. **Status** values: `todo` · `in-progress` · `review` · `done` · `cut`, updated here at each commit.

### Phase 0 — Docs and execution harness

| Task | Observable outcome | PRD/ADR links | Prerequisites | Owner/model | Editable files | Verification and handoff | Issue | Status |
|---|---|---|---|---|---|---|---|---|
| **T00** Docs PR content | ADR-000–006 and this plan committed on `docs/prd-adr-plan`; branch layout per §9.1 so the docs PR against `design-system` shows PRD + ADRs + plan only | [ADR-000](../ADR/000-main-architecture.md), [ADR-005](../ADR/005-agent-execution-tooling.md), [ADR-006](../ADR/006-real-endpoint-verification.md) | User approves this plan | ORCH | `docs/ADR/**`, `docs/plans/**` | Scripted relative-link check over `docs/` = 0 broken; diff is docs only. Commit `Docs: add ADR set, verification and tooling decisions, implementation plan`. Push and PR (base `design-system`) only after the user confirms §9.1 | — | done |
| **T01** Tracker | Epic issue + one issue per row T02–T30 and G1–G4; Issue column filled; matching session tasks | — | T00 | ORCH | this plan (Issue column) | `gh issue list` shows 1 epic + 33 issues (T02–T30, G1–G4), each linking its row. Commit `Docs: link plan tasks to GitHub issues` | #10 (epic) | done |
| **T02** Worker harness smoke | Project `opencode.json` with restricted permissions; `.agent-briefs/README.md` template; `.agent-runs/` ignored; one OpenCode and one Haiku dry run without edits | [ADR-005 §3](../ADR/005-agent-execution-tooling.md#3-component-design) | T01 | ORCH | `opencode.json`, `.agent-briefs/README.md`, `.gitignore`, `.claude/settings.json` (allow-list exactly as [ADR-005 §3.4](../ADR/005-agent-execution-tooling.md#3-component-design)) | TAC-005-01: OpenCode JSON log shows `openai/gpt-6-luna`; an attempted `git commit` and `.env` read are refused; Haiku returns the brief checksum. Commit `Chore: add OpenCode worker config and brief template` | #11 | done |

### Phase 1 — Foundation (increment: template chat streams from `gpt-6-luna`)

| Task | Observable outcome | PRD/ADR links | Prerequisites | Owner/model | Editable files | Verification and handoff | Issue | Status |
|---|---|---|---|---|---|---|---|---|
| **T03** Scaffold | `feature/decision-copilot-poc`; template merged into `app/` with `app/README.md` preserved; AI Gateway replaced by OpenRouter | [ADR-004 §3](../ADR/004-project-setup-and-tooling.md#3-component-design) steps 1–5, [§6](../ADR/004-project-setup-and-tooling.md#6-technical-decisions) | T02 | ORCH | `app/**` template files, `app/package.json`, `app/pnpm-lock.yaml` | typecheck, lint, build pass; `pnpm start` serves `/`; TAC-004-04 grep clean. Commit `App: scaffold from shadcn chatbot-template with OpenRouter` | #12 | done |
| **T04** Tooling, limits check, agent instructions | Strict TS; Vitest (node + jsdom); Playwright (1440 + 360 px); scripts incl. `openrouter:status`; env example; `app/AGENTS.md` + `app/CLAUDE.md`; one smoke test per runner | [ADR-004 §3](../ADR/004-project-setup-and-tooling.md#3-component-design), [ADR-006 §3.3–3.4](../ADR/006-real-endpoint-verification.md#3-component-design), [ADR-000 §7](../ADR/000-main-architecture.md#7-environment-variables) | T03 | ORCH | `app/package.json`, lockfile, `app/tsconfig.json`, `app/vitest.config.*`, `app/playwright.config.*`, `app/scripts/openrouter-status.ts`, `docs/qa/spend.md`, `app/.env.example`, `.env.example`, `app/.gitignore`, `app/AGENTS.md`, `app/CLAUDE.md`, `app/tests/smoke/**`, root `AGENTS.md` (one pointer line) | Smoke tests red first, then TAC-004-01…05; all script entries incl. `record:openrouter`, `record:app`, `eval:decisions` registered; `pnpm openrouter:status` prints limits without the key (endpoint verified against OpenRouter docs first); `docs/qa/spend.md` started. **All later dependency changes go through ORCH.** Commit `App: add test tooling, limits check and nested agent instructions` | #13 | done |
| **T05** Shared contracts | Zod schemas, enums, shared types, Polish strings incl. disclaimer | [PRD Form](../PRD.md#form), [Disclaimer](../PRD.md#disclaimer), [ADR-002 §4](../ADR/002-backend-api.md#4-data-structures), [ADR-001 §4](../ADR/001-ai-decision-pipeline.md#4-data-structures), [ADR-003 §4](../ADR/003-frontend-chat-ui.md#4-data-structures) | T04 | ORCH (shared contract, serialized) | `app/lib/schemas/**`, `app/lib/types/**`, `app/lib/i18n/pl.ts`, `app/tests/unit/schemas/**` | Boundary tests for AC-04–AC-11 red on stubs, then green (no endpoint involved). Contract frozen afterwards; changes only via ORCH. Commit `App: add shared schemas, types and Polish strings` | #14 | done |
| **T06** Record Decisions API + errors | `scripts/record-openrouter.ts` (record + `--compare`); recordings: decision-model (Decisions API) return and complaint question sets × 2 example photos each; real 401 (invalid key); real connection failure; refusal if obtainable; normalized values computed per ADR-001 §3.3 for T09; `GAPS.md`; notes resolving [ADR-000 §11](../ADR/000-main-architecture.md#11-open-questions-and-assumptions) | [ADR-001 §3.3](../ADR/001-ai-decision-pipeline.md#3-component-design), [TAC-001-01](../ADR/001-ai-decision-pipeline.md#8-testing-strategy), [ADR-006 §3.1](../ADR/006-real-endpoint-verification.md#3-component-design) | T05 | ORCH | `app/scripts/record-openrouter.ts`, `app/tests/fixtures/openrouter/decisions/**`, `app/tests/fixtures/openrouter/errors/**`, `app/tests/fixtures/GAPS.md` | Metadata scan passes (ADR-006 §5); no secrets. **Gate:** if the decision model cannot pass images or the shape contradicts ADR-001 §3.3, ORCH writes an ADR-001 amendment (Proposed) and stops for user review. Commit `Test: record Luna Decisions and error responses` | #15 | done |
| **G1** Manual gate — foundation | App runs against real OpenRouter; interactive chat; limits and call count verified | [ADR-006 §3.5](../ADR/006-real-endpoint-verification.md#3-component-design), [AGENTS.md Manual QA](../../AGENTS.md) | T03–T06 | ORCH | `docs/qa/G1/**` | §4 protocol: `openrouter:status` before/after; `--compare` drift check; `pnpm start` and `pnpm dev`; ≥ 5 improvised chat turns with the template chat; 1 `POST` and 1 upstream call per turn, 0 calls on load/refresh; no console errors. Commit `Docs: add G1 manual verification evidence` | #16 | done |

### Phase 2 — Form to first decision (increment: submit a case → chat page shows the first message)

| Task | Observable outcome | PRD/ADR links | Prerequisites | Owner/model | Editable files | Verification and handoff | Issue | Status |
|---|---|---|---|---|---|---|---|---|
| **T07** E2E acceptance specs (red) | Playwright specs for PRD flows 4.1–4.7 fail only because features are missing | [PRD §4](../PRD.md#4-main-flows), [ADR-000 §10](../ADR/000-main-architecture.md#10-testing-strategy), [ADR-003 §8](../ADR/003-frontend-chat-ui.md#8-testing-strategy) | G1 | HAIKU | `app/tests/e2e/**` (not `smoke/`) | Every spec annotated `test.fail()` and the run is green; removing one annotation locally shows an "element not found"/404 failure; AC coverage table; role selectors + `lib/i18n/pl`; uploads only from `assets/example-images/`; no `route` mocking. Commit `Test: add E2E acceptance specs (red)` | #17 | done |
| **T08** Image module | `inspectImage`, `prepareForModel`, `makeThumbnail` | [ADR-002 §3](../ADR/002-backend-api.md#3-component-design), [PRD AC-07–AC-09, AC-14](../PRD.md#form) | G1 | OC-LUNA | `app/server/image/**`, `app/tests/unit/image/**` | Red then green on the 5 real example photos; TAC-002-02; size limit on byte length; no generated images. Commit `Backend: add image validation and compression` | #18 | done |
| **T09** Pure decision logic | `daysSincePurchase`, fast-path gate, guards, policy loader | [ADR-001 §3.2–3.6](../ADR/001-ai-decision-pipeline.md#3-component-design), [PRD AC-23–AC-27](../PRD.md#ai-decision-first-message) | G1 | OC-LUNA | `app/server/ai/logic/**`, `app/tests/unit/ai-logic/**` | Red then green; boundary days 14/15/30/31/730/731; signal inputs are normalized values taken from T06 recordings, boundaries as derived variants. Commit `Backend: add decision facts, fast-path gate, guards and policy loader` | #19 | done |
| **T10** Decisions adapter | `getDecisionSignals` (decision model) with both question sets, normalization, fail-closed | [ADR-001 §3.3, §5](../ADR/001-ai-decision-pipeline.md#3-component-design) | T06 | HAIKU | `app/server/ai/signals/**`, `app/tests/integration/signals/**` | Replays T06 recordings only (answers, 401, connection failure, refusal if present). Commit `Backend: add Luna Decisions signals adapter` | #20 | done |
| **T11** Env, decision log, call log | Env validation; JSONL decision log; upstream call wrapper with one log line per call | [ADR-001 §3.7](../ADR/001-ai-decision-pipeline.md#3-component-design), [ADR-006 §3.2](../ADR/006-real-endpoint-verification.md#3-component-design) | G1 | HAIKU | `app/server/env.ts`, `app/server/ai/log/**`, `app/server/ai/upstream.ts`, `app/tests/unit/env/**`, `app/tests/unit/log/**` | Red then green; TAC-001-06; log line has no customer text. Commit `Backend: add env validation, decision log and upstream call log` | #21 | done |
| **T12** Prompts | Six versioned prompt files + loader | [ADR-001 §3.6, §3.8](../ADR/001-ai-decision-pipeline.md#3-component-design), [PRD §11](../PRD.md#11-agent--system-behavior-specification) | T05, T06 | ORCH | `app/server/ai/prompts/**`, `app/tests/unit/prompts/**` | Loader tests: version, rule-citation, injection and Polish clauses present. Commit `Backend: add decision, writer and chat prompts` | #22 | done |
| **T13** Record LLM calls | Recordings with the T12 prompts: escalated decision (return + complaint, with photo), writer (fast + rule), chat stream plain, chat stream with `update_recommendation` tool call + second step, reasoning chunks if emitted; 401 for chat | [ADR-006 §3.1](../ADR/006-real-endpoint-verification.md#3-component-design), [ADR-001 §3.8](../ADR/001-ai-decision-pipeline.md#3-component-design) | T12 | ORCH | `app/tests/fixtures/openrouter/llm/**`, `app/tests/fixtures/GAPS.md`, `app/scripts/record-openrouter.ts` | Metadata scan; prompt versions recorded; gaps listed. Commit `Test: record gpt-6-luna decision, writer and chat responses` | #23 | done |
| **T14** Brand theme + shell | Tokens → Tailwind 4/shadcn variables, fonts, header with logo, favicon | [ADR-003 §3.5](../ADR/003-frontend-chat-ui.md#3-component-design), [Colours](../design-guidelines.md#colours), [Typography](../design-guidelines.md#typography), [Borders](../design-guidelines.md#borders-radius-and-shadows), [Components](../design-guidelines.md#components), [Logo](../design-guidelines.md#logo-usage) | G1 | OC-LUNA | `app/app/globals.css`, `app/app/layout.tsx`, `app/components/site-header.tsx`, `app/public/**` | Typecheck/build; screenshots at 1440/360 compared with `assets/homepage-*.png` (verified again in G2). Commit `Frontend: apply DevPowers brand tokens and app shell` | #24 | done |
| **T15** Case form | `CaseForm` + `PhotoInput` with all field rules and magic-byte check; emits validated values via `onSubmit` (no fetch) | [PRD AC-01–AC-13](../PRD.md#form), [PRD §9](../PRD.md#9-ui-description-wireframe-level), [ADR-003 §3.2](../ADR/003-frontend-chat-ui.md#3-component-design) | G1 | HAIKU | `app/components/case-form/**`, `app/tests/component/case-form/**` | Red then green with real example photos; no endpoint doubles needed. Commit `Frontend: add case form and photo input` | #25 | done |
| **T16** Case pipeline | `runCasePipeline`: rule/fast/escalated, writer, retry, guards, decision + call log | [ADR-001 §3.2, §5, §7](../ADR/001-ai-decision-pipeline.md#3-component-design) | T09, T10, T11, T13 | ORCH | `app/server/ai/pipeline/**`, `app/tests/integration/pipeline/**` | Integration tests replay T06/T13 recordings per route and failure; call-log line count matches the ADR-006 budget; TAC-001-03/04/05/07; no network. Commit `Backend: add case decision pipeline` | #26 | done |
| **T17** `/api/cases` | Multipart route streaming NDJSON stages and one terminal event | [ADR-002 §5](../ADR/002-backend-api.md#5-interface-contracts), [PRD AC-18, AC-41, AC-43](../PRD.md#errors-and-general) | T08, T16 | HAIKU | `app/app/api/cases/route.ts`, `app/tests/integration/api-cases/**` | Red then green with recorded OpenRouter replays; TAC-002-01/03/04; task-level manual check happens in T18 (real requests + call log). Commit `Backend: add cases endpoint` | #27 | done |
| **T18** Record `/api/cases` | `scripts/record-app.ts`; verbatim recordings from the running app with real models: fast, escalated and rule results (return + complaint), 400 (server-side validation), 415 (`assets/logo.svg`), upstream-failure error event (invalid key); 413 listed in `GAPS.md` | [ADR-006 §3.1](../ADR/006-real-endpoint-verification.md#3-component-design), [ADR-002 §4](../ADR/002-backend-api.md#4-data-structures) | T17 | ORCH | `app/scripts/record-app.ts`, `app/tests/fixtures/app/cases/**`, `app/tests/fixtures/GAPS.md` | Real HTTP requests to `pnpm start` with example photos; call-log lines match the budget per submission; metadata scan passes. Commit `Test: record /api/cases responses` | #28 | done |
| **T19** Submission flow UI | Session store, NDJSON reader, `useCaseSubmission`, `SubmissionProgress` | [ADR-003 §3.2–3.3](../ADR/003-frontend-chat-ui.md#3-component-design), [PRD §4.4–4.5, Session](../PRD.md#4-main-flows) | T18 | OC-LUNA | `app/lib/session-store.ts`, `app/lib/ndjson.ts`, `app/components/case-submission/**`, `app/tests/unit/client-utils/**`, `app/tests/component/submission/**` | Red then green; the fetch double streams T18 recordings (incl. byte-split chunks of a recorded body); failure keeps data; one request per submit. Commit `Frontend: add submission flow and session store` | #29 | done |
| **T20** First-message rendering | `DecisionCard`, `MessageParts` for `data-decision` + text | [PRD AC-21, AC-29–AC-31](../PRD.md#disclaimer), [ADR-003 §3.2](../ADR/003-frontend-chat-ui.md#3-component-design) | T18 | HAIKU | `app/components/chat/decision-card.tsx`, `app/components/chat/message-parts.tsx`, `app/tests/component/chat/first-message/**` | Red then green using `firstMessage` from T18 recordings; TAC-003-01/02. Commit `Frontend: add decision card and message parts` | #30 | done |
| **T21** Case summary | `CaseSummaryPanel` + `NewCaseDialog` | [PRD §9.3, AC-36, AC-39](../PRD.md#9-ui-description-wireframe-level) | T18 | HAIKU | `app/components/case-summary/**`, `app/tests/component/case-summary/**` | Red then green using the recorded `CaseSessionPayload`. Commit `Frontend: add case summary panel and new-case dialog` | #31 | done |
| **T22** Wiring increment 1 | `/` submits and navigates to `/chat`, which shows the summary and the first message; refresh restore; new case | [PRD §4.1–4.2, §4.4–4.7](../PRD.md#4-main-flows), [ADR-003 §3.1](../ADR/003-frontend-chat-ui.md#3-component-design) | T14, T15, T19, T20, T21 | ORCH | `app/app/page.tsx`, `app/app/chat/page.tsx`, template files to delete | Typecheck, lint, `pnpm test`, build, start; `test.fail()` removed and T07 specs for 4.1/4.2/4.4/4.5/4.7 green; short manual click-through of `/` → `/chat` with one real submission. Commit `Frontend: wire form, progress and first-message pages` | #32 | done |
| **G2** Manual gate — first decision | Case submission works end to end with real models, no extra calls, within limits | [ADR-006 §3.5](../ADR/006-real-endpoint-verification.md#3-component-design), [PRD Form](../PRD.md#form)…[Session](../PRD.md#session) | T22 | ORCH | `docs/qa/G2/**` | §4 protocol by hand: return (laptop photo), complaint (phone photo), return 45 days (rule), category mismatch, invalid fields + `assets/logo.svg` as wrong type (0 calls), refresh (0 calls), new case (0 calls), failure + "Spróbuj ponownie" with a wrong key in a second run; each submission = 1 POST + budgeted upstream calls; ≤ 90 s; drift check. Commit `Docs: add G2 manual verification evidence` | #33 | done |

### Phase 3 — Chat (increment: follow-up conversation with recommendation updates)

| Task | Observable outcome | PRD/ADR links | Prerequisites | Owner/model | Editable files | Verification and handoff | Issue | Status |
|---|---|---|---|---|---|---|---|---|
| **T23** Chat agent + `/api/chat` | Streaming chat with case context, `update_recommendation` tool, masked errors; template route replaced | [ADR-001 §3.8](../ADR/001-ai-decision-pipeline.md#3-component-design), [ADR-002 §5](../ADR/002-backend-api.md#5-interface-contracts), [PRD Chat](../PRD.md#chat) | G2 (may start after T16 on disjoint files) | ORCH | `app/server/ai/chat/**`, `app/app/api/chat/route.ts`, `app/tests/integration/api-chat/**` | Red then green replaying T13 chat recordings; validation limits; no reasoning parts; call log 1 or 2 steps; task-level manual check happens in T24. Commit `Backend: add chat agent with recommendation updates` | #34 | done |
| **T24** Record `/api/chat` | `scripts/record-app.ts` chat mode: verbatim SSE recordings from the running app using a recorded T18 case as context: plain answer, recommendation update, masked failure (invalid key), 400 | [ADR-006 §3.1](../ADR/006-real-endpoint-verification.md#3-component-design) | T23 | ORCH | `app/scripts/record-app.ts`, `app/tests/fixtures/app/chat/**` | Real HTTP requests to `pnpm start`; call budget matches; metadata scan passes. Commit `Test: record /api/chat responses` | #35 | done |
| **T25** Chat UI wiring | `useChat` with case context, `ChatInput`, `ChatErrorRow` + "Ponów", update card from tool parts, session persistence of messages | [PRD Chat](../PRD.md#chat), [AC-42](../PRD.md#errors-and-general), [ADR-003 §3.2–3.4](../ADR/003-frontend-chat-ui.md#3-component-design) | T22, T24 | ORCH (+ HAIKU for `ChatInput`/`ChatErrorRow` components in `app/components/chat/input/**`, `app/components/chat/error/**`) | `app/app/chat/page.tsx`, `app/components/chat/**` (except T20 files), `app/tests/component/chat/conversation/**` | Red then green with a replay transport streaming T24 recordings; `test.fail()` removed and T07 chat specs green; short manual chat (3 turns) before commit. Commit `Frontend: wire streaming chat with recommendation updates` | #36 | done |
| **G3** Manual gate — chat | Real-time conversation behaves per PRD §11 with correct call counts | [ADR-006 §3.5](../ADR/006-real-endpoint-verification.md#3-component-design), [PRD §11](../PRD.md#11-agent--system-behavior-specification), [PRD Chat](../PRD.md#chat) | T25 | ORCH | `docs/qa/G3/**` | §4 protocol: ≥ 8 improvised turns per case type (clarifying, policy, new relevant fact → update card, insistence → no update, off-topic, injection, "Jaki model urządzenia zgłosiłem?"); `network-state-set offline` during a reply → error row → online → "Ponów" (1 request, no duplicate user message); refresh keeps history (0 calls). Commit `Docs: add G3 manual verification evidence` | #37 | done |

### Phase 4 — Hardening and delivery

| Task | Observable outcome | PRD/ADR links | Prerequisites | Owner/model | Editable files | Verification and handoff | Issue | Status |
|---|---|---|---|---|---|---|---|---|
| **T26** Evaluation script | `pnpm eval:decisions` prints signals, both decisions and agreement for 5 photos × 2 types | [ADR-001 §3.7](../ADR/001-ai-decision-pipeline.md#3-component-design) | T16 | OC-LUNA | `app/scripts/eval-decisions.ts` | One real run, cost noted; TAC-001-08. **Cut-able.** Commit `Chore: add decision evaluation script` | #38 | done |
| **T27** E2E green | Full `pnpm test:e2e` passes at 1440 and 360 px with real OpenRouter | [ADR-000 §10](../ADR/000-main-architecture.md#10-testing-strategy), [PRD AC-44–AC-46](../PRD.md#errors-and-general) | G3 | ORCH (+ HAIKU for isolated fixes) | fixes in the owning area; spec changes only when the PRD supports them | TAC-04/05/06/07; axe no serious issues. Commit per fix area | #39 | done |
| **G4** Final manual regression | All PRD flows re-verified by hand on desktop and mobile; brand comparison | [ADR-006 §3.5](../ADR/006-real-endpoint-verification.md#3-component-design), [AGENTS.md Manual QA](../../AGENTS.md), [design-guidelines](../design-guidelines.md) | T27 | ORCH | `docs/qa/G4/**` | G2 + G3 scenarios again at 1440 and 360 px; keyboard-only form; recordings refreshed if drift found. Commit `Docs: add final manual QA evidence` | #40 | todo |
| **T28** Independent review | Review report with verified findings | [AGENTS.md Code Review Rules](../../AGENTS.md), all ADRs | G4 | REVIEW (Sonnet, fresh context) | none (read-only) | ORCH reproduces or rejects each finding with a reason | #41 | todo |
| **T29** Review fixes | Accepted findings fixed; full verification; short manual re-check of touched flows | — | T28 | ORCH (+ HAIKU for isolated fixes) | files named by accepted findings | typecheck, lint, test, build, start, E2E; recordings refreshed if a response shape changed. One commit per finding area | #42 | todo |
| **T30** Demo video + PR | `docs/qa/final/demo.mp4` (interactive walkthrough of return, complaint, chat update, refresh, new case; chapters) and the implementation PR (no merge) | [ADR-006 §3.5](../ADR/006-real-endpoint-verification.md#3-component-design) | T29 | ORCH | `docs/qa/final/**` | Video recorded with `playwright-cli video-*`, converted with ffmpeg (`pip install --user imageio-ffmpeg`) to H.264 MP4 ≤ 10 MB; spend logged. PR (base: the docs branch or `design-system`, whichever is unmerged) body: scope, AC coverage, test counts, gate reports, screenshots, video link, gaps, total spend. Push only with user OK. GitHub does not offer a CLI upload for inline PR videos: the PR links the committed file, and you can drag it into the description for inline playback | #43 | todo |

---

## 4. Manual verification gate protocol (G1–G4)

Defined in [ADR-006 §3.2–3.5](../ADR/006-real-endpoint-verification.md#3-component-design); summary of what ORCH does at every gate:

1. **Limits first:** `pnpm openrouter:status` — record remaining credit, free-tier flag, rate limit and model availability; abort the gate if a limit would block it. Record usage again at the end (gate cost).
2. **Real configuration only:** real `.env.local`, `LLM_MODEL`/`DECISION_MODEL` as in ADR-000 §7, fast path as configured; the app has no mock mode; no `route` mocking in the browser.
3. **Drift check:** `pnpm record:openrouter --compare` — structural differences mean the affected recordings are refreshed before continuing.
4. **Interactive use:** start `pnpm build && pnpm start` (plus one pass on `pnpm dev`), then drive the browser with single `playwright-cli` commands — `open` → `snapshot` → decide → `fill`/`select`/`upload`/`click`/`type`/`press` → `snapshot`/`screenshot`. No pre-written sequences, `run-code` or replayed recordings. In chat, every next question is written from the previous answer.
5. **Call budget:** after each action, `playwright-cli requests` (browser → app) and the server's upstream log lines (app → OpenRouter) are compared with the expected budget table in ADR-006 §3.2; extra or duplicate calls are defects.
6. **Observations:** `playwright-cli console` without errors; Polish text; screenshots of every touched screen at 1440 and 360 px compared with the brand references.
7. **Report and decision:** `docs/qa/<gate>/report.md` with steps, screenshots, measured vs expected calls, usage before/after, defects. Defects become fix commits in the same phase; the gate is repeated until it passes.

---

## 5. Parallel waves, critical path and hotspots

**Waves** (max. 3 workers at once so ORCH can review each diff; every brief lists the concurrent tasks and their files):
- Serial: T00 → T01 → T02 → T03 → T04 → T05 → T06 → G1.
- Wave A (after G1): T08 (OC) · T09 (OC) · T15 (HAIKU) while ORCH does T12 → T13. Then T07 (HAIKU) · T10 (HAIKU) · T11 (HAIKU), then T14 (OC) when an OC slot frees.
- ORCH: T16 → T17 (HAIKU, after T16) → T18.
- Wave B (after T18): T19 (OC) · T20 (HAIKU) · T21 (HAIKU); ORCH may start T23 (disjoint files) → T22 → G2.
- Phase 3: T24 → T25 → G3; T26 (OC) can run any time after T16 (cut-able).
- Phase 4: T27 → G4 → T28 → T29 → T30.

**Critical path:** T00 → T01 → T02 → T03 → T04 → T05 → T06 → G1 → T12 → T13 → T16 → T17 → T18 → T19 → T22 → G2 → T23 → T24 → T25 → G3 → T27 → G4 → T28 → T29 → T30.

**Shared-file hotspots (ORCH-only, serialized):** `app/package.json` + `app/pnpm-lock.yaml` (T03/T04; later needs are reported, not installed); `app/lib/schemas/**`, `app/lib/types/**`, `app/lib/i18n/pl.ts` (frozen after T05; workers request strings in reports); `app/tests/fixtures/**` and `app/scripts/record-openrouter.ts` (recordings only by ORCH); `app/app/layout.tsx` + `globals.css` (T14 only); `app/app/page.tsx`, `app/app/chat/**`, `app/app/api/chat/route.ts` (T22/T23/T25); runner configs (T04); `app/AGENTS.md`; this plan's Status/Issue columns.

---

## 6. Failure, rollback and fallback

- **Worker failure:** a result that fails ORCH's re-run, edits files outside its list, changes a contract or adds a non-recorded test double is rejected. Unstaged changes are restored with `git restore --source=HEAD -- <listed paths>`; new untracked files are listed with `git status` and removed only after user confirmation (`rm`/`git clean` are not pre-approved). Second attempt with a corrected brief (`opencode run -s <session>` or a new Haiku brief); after two failures ORCH does the task.
- **Committed regression:** `git revert <sha>`; row back to `in-progress`.
- **Gate failure:** defects become fix commits in the same phase; recordings are refreshed when a fix changes a response shape; the gate is repeated.
- **Provider limits:** `openrouter:status` shows insufficient credit or a rate limit → stop, report to the user, no switch to mocks.
- **Model access:** OpenCode unavailable → OC-LUNA rows to HAIKU; Agent tool unavailable → ORCH sequential. Decision model unusable (T06 gate) → `FAST_PATH_ENABLED=false`, signals `unavailable`, always escalate (ADR-001 fail-closed) — PRD still met.
- **Contradiction found by a worker:** worker stops and reports; ORCH resolves against PRD/ADR or asks the user.
- **Smaller fallback, in cut order:** T26 eval script → `update_recommendation` tool (AC-35 deferred) → fast path (flag off) → mobile/axe E2E project (360 px checked by hand in G4 only) → progress-stage polish. **Minimum demonstrable cut:** both case types through T03–T06, G1, T08–T13, T15–T22, G2, T23–T25 (chat without updates), G3, G4 (desktop), T28–T30, escalation-only decisions. Manual gates and recorded-mock rules are never cut.

---

## 7. Execution protocol (after authorization)

1. ORCH marks the row `in-progress` (plan, session task, issue comment).
2. ORCH compiles `.agent-briefs/<ID>-<slug>.md` right before dispatch (template from T02): goal; concurrent tasks and their files; authoritative links; **pasted** current contracts, source excerpts, predecessor outputs and the exact recording files to replay; exhaustive editable files; forbidden actions (incl. "no hand-written or scripted endpoint responses"); ordered red→green steps; test inputs and expected results; exact commands; report format.
3. The worker executes and reports changed files, red output, green output, contradictions and open questions. It cannot change scope or accept its own work.
4. ORCH reads the diff, checks that every endpoint double loads a recording, re-runs the row's checks, commits named paths (brief included) and sets `done`; the commit closes the issue.

---

## 8. OpenCode headless — quick instruction

1. One-time: T02 adds a project `opencode.json` restricting permissions ([ADR-005 §3.3](../ADR/005-agent-execution-tooling.md#3-component-design)); verify with a smoke run. Never use `--auto`.
2. Run a task from the repository root:
   `opencode run "Execute the attached brief exactly. Edit only the files listed under Editable files. Do not commit. End with the Report section filled in." -m openrouter/openai/gpt-6-luna --variant medium --title "T08" --format json -f /home/labuser/jsystems-ai-programming-2026-11/.agent-briefs/T08-image-module.md > .agent-runs/T08.jsonl 2> .agent-runs/T08.err` (the message must come before `-f`, which takes several files and would swallow it)
3. From Claude Code, start it with Bash `run_in_background`; you are notified when it exits.
4. Read the final message in the JSON event log, then `git diff --stat` and re-run the row's checks.
5. Correction round in the same context: `opencode run -s <session id from the log> -m openrouter/openai/gpt-6-luna "<correction>"`.
6. `opencode models openrouter` lists model IDs; `--variant` sets reasoning effort (e.g. `low`, `medium`, `high`).

---

## 9. Decisions from the review of 2026-11-26

| # | Topic | Decision | Effect in this plan |
|---|---|---|---|
| 1 | Docs branch and PR | Branch from `design-system`; docs PR (PRD + ADRs + plan) targets `design-system` (PR #6); option A of 9.1 chosen | T00 |
| 2 | ADR-005, ADR-006 | Accepted | Status set to Accepted |
| 3 | Permissions | Pre-approve only the `pnpm` and `playwright-cli` subcommands the plan needs; auto mode keeps checking the rest | Exact list in ADR-005 §3.4, applied in T02 |
| 4 | Tracker | GitHub epic + issues | T01: 1 epic + 33 issues |
| 5 | API spend | USD 5 cap | ADR-006 §3.4, `docs/qa/spend.md`, stop at USD 4.50 |
| 6 | Recordings, evidence | Record real 401 and connection failure; other errors are gaps. Screenshots committed in the repo; final ffmpeg video in the implementation PR | ADR-006 §3.1, §3.5; G1–G4 reports; T30 |

### 9.1 Clean docs PR against `design-system` — option A chosen (2026-11-26)

`origin/design-system` does not have the 18 `main` commits that were merged locally, nor the PRD commit. If `docs/prd-adr-plan` is pushed as is, the PR against `design-system` will show all those `main` commits as noise. Options:
- **(Recommended) A — no history rewriting of pushed commits:**
  1. On a new branch from `origin/design-system`, merge `origin/main`; push it as `design-system` (fast-forward; PR #6 is unchanged in content because those commits are already on `main`).
  2. Rebuild `docs/prd-adr-plan` on top of it by cherry-picking `7d4c4b0` (PRD) and the T00 docs commit.
  3. Move the local `design-system` to the pushed tip with `git branch -f`.

  The docs PR then shows exactly PRD + ADRs + plan. This needs your OK to push `design-system`.
- **B — push local `design-system` as is:** the PRD lands in PR #6, and the docs PR shows only ADRs + plan.
- **C — keep the noise:** the docs PR shows `main` commits too.

## 10. First bounded task and review gate

- **Review gate:** passed — plan accepted and option A chosen on 2026-11-26. T00 is delivered by the docs PR.
- **First task of the implementation session:** **T01** — create the epic and 33 issues, fill the Issue column, create the session tasks; then T02.
