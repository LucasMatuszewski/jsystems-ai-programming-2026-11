# Implementation plan — pattern

A **pattern, not a form**. Use it as the shape to follow for `docs/plans/<feature>-implementation-plan.md`: keep the intent and the general order (state → approach → matrix with gates → protocol → risks → decisions), but adapt freely — merge or drop sections that do not apply (say so in one line), add what the project needs, size phases and rows to the real work, and never copy placeholder rows blindly. Link to PRD/ADR/design sections instead of copying them.

````markdown
# Implementation Plan — <Product / Feature>

**Status:** DRAFT (rev. 1, <YYYY-MM-DD>) — awaiting review. Planning does not authorize execution, new agents, publication, issue creation or merge.
**Scope:** <whole application | vertical slice: …> defined by [PRD](../PRD.md) <criteria range>.
**Architecture:** [ADR-000](../ADR/000-….md) · … · <Proposed ADRs created for gaps>
**Design guidance:** <links to design guidelines and visual references>
**Agent instructions:** <links to root and nested AGENTS.md/CLAUDE.md that apply>

---

## 1. Current state (inspected <date>)

| Item | Observed |
|---|---|
| Branch / worktrees | <current branch, worktrees> |
| PR stack | <each open PR used: head → **actual base**, changed files> |
| Unpushed commits | <per relevant branch> |
| Working tree | <modified/untracked files; unrelated ones left untouched> |
| Application | <entry points, build descriptor, test folders> |
| Baseline | <build/test/startup results, or "no app yet — no baseline failures"> |
| Agent config | <instructions, named roles (if any), permission allow/ask/deny highlights> |
| Tracker | <issues/projects availability and permissions> |
| Missing tools | <tool → no-root install path> |

### Commands verified in this session

| Command | Result |
|---|---|
| `<tool> --version` | <…> |

Not verified yet: <items + the task that verifies them>

---

## 2. Delivery approach

- **Branches:** <docs branch / implementation branch / PR bases>. One checkout by default; worktree only for parallel edits of the same files (ask first).
- **Phases:** each ends with a runnable increment and a manual gate; the next phase starts only after the gate passes.
- **TDD:** behavioural test first (red evidence), then minimum implementation (green). Early acceptance specs are committed expected-to-fail; the wiring task removes the annotation.
- **Test doubles:** only replays of recorded real calls (external and own endpoints); derived variants change values only; uncapturable errors in `GAPS.md`. E2E and gates mock nothing. → <ADR link>
- **Task-level manual check:** every task that changes what the running app does ends with a short real check before commit.
- **Call budget and limits:** expected calls per user action (<ADR link>); limits/status command before and after real runs; spend cap <amount>, logged in `docs/qa/spend.md`, stop and ask at <threshold>.
- **Evidence:** screenshots committed in `docs/qa/<gate>/`; <final demo video: yes/no>.
- **Commits:** one per row after the orchestrator re-runs the checks; named paths only; format `<Area: summary>`. Workers never commit.
- **Commands:** <verified build/test/start/e2e/status/record commands>. Reports list build, tests (discovered/passed/skipped) and startup separately.

### Owners / models

| Label | Mechanism | Model | Used for |
|---|---|---|---|
| ORCH | Main session | <strongest> | Decisions, contracts, manifests, recordings, integration, gates, acceptance, commits |
| SMALL | Built-in subagent | <small model> | Bounded implementation and tests |
| MID | Built-in subagent | <mid model> | Cross-cutting tasks |
| EXT-<CLI> (optional) | `<verified headless command>` | <model> | Bounded self-contained modules |
| REVIEW | Fresh-context subagent / other model family | <model> | Independent review |

Fallback: unavailable external CLI → SMALL/MID; no subagents → ORCH sequentially.

---

## 3. Dependency matrix (authoritative)

Status: `todo` · `in-progress` · `review` · `done` · `cut`. Issue IDs are filled when the tracker task runs; session tasks are titled `#<issue> <ID> <name>`.

### Phase 0 — Docs and execution harness

| Task | Observable outcome | PRD/ADR links | Prerequisites | Owner/model | Editable files | Verification and handoff | Issue | Status |
|---|---|---|---|---|---|---|---|---|
| **T00** Docs content | <PRD/ADRs/plan committed> | … | User accepts plan | ORCH | `docs/**` | Link check 0 broken; commit `<…>`; PR only with OK | — | todo |
| **T01** Tracker | <epic + N issues; IDs in this table> | — | T00 | ORCH | this plan | `<tracker list>` count = N | — | todo |
| **T02** Harness smoke | <permission config, brief template, allow-list; one dry run per worker mechanism> | <ADR> | T01 | ORCH | <files> | Forbidden actions refused; logs show intended models | | todo |

### Phase 1 — Foundation (increment: <what runs>)

| Task | Observable outcome | PRD/ADR links | Prerequisites | Owner/model | Editable files | Verification and handoff | Issue | Status |
|---|---|---|---|---|---|---|---|---|
| **T03** Scaffold | … | … | T02 | ORCH | … | build, start, task-level manual check | | todo |
| **T04** Tooling | <strict types, runners, all script entries, limits command, nested agent instructions> | … | T03 | ORCH | manifests, configs | smoke test per runner red → green | | todo |
| **T05** Shared contracts | … | … | T04 | ORCH | contracts | boundary tests red → green; contract frozen | | todo |
| **T06** Record external APIs | <recording script, fixtures with metadata, error recordings, GAPS.md> | … | T05 | ORCH | fixtures, script | metadata scan; **stop-and-ask gate** if reality contradicts ADR | | todo |
| **G1** Manual gate | <increment works against real endpoints> | <gate ADR> | T03–T06 | ORCH | `docs/qa/G1/**` | §4 protocol; call budget; limits before/after | | todo |

### Phase <n> — <Feature increment> (increment: <what a user can do>)

| Task | Observable outcome | PRD/ADR links | Prerequisites | Owner/model | Editable files | Verification and handoff | Issue | Status |
|---|---|---|---|---|---|---|---|---|
| **Tnn** <name> | … | … | … | SMALL | <exhaustive> | red → green with recordings; <task-level manual check if runtime> ; commit `<…>` | | todo |
| **Tnn** Record own endpoint | <real HTTP requests to the running app → fixtures> | … | <endpoint task> | ORCH | fixtures, script | metadata scan; call budget | | todo |
| **Gn** Manual gate | … | … | … | ORCH | `docs/qa/Gn/**` | §4 protocol | | todo |

### Phase <last> — Hardening and delivery

| Task | Observable outcome | PRD/ADR links | Prerequisites | Owner/model | Editable files | Verification and handoff | Issue | Status |
|---|---|---|---|---|---|---|---|---|
| **Tnn** E2E green | … | … | last feature gate | ORCH | owning areas | counts per viewport/platform | | todo |
| **Gn** Final manual regression | … | … | E2E green | ORCH | `docs/qa/Gn/**` | all flows, desktop + mobile, visual reference | | todo |
| **Tnn** Independent review | verified findings | … | final gate | REVIEW | none | ORCH reproduces or rejects each finding | | todo |
| **Tnn** Review fixes | … | … | review | ORCH (+SMALL) | named by findings | full verification; recordings refreshed if shapes changed | | todo |
| **Tnn** Demo video + PR | <video in docs/qa/final, PR without merge> | … | fixes | ORCH | `docs/qa/final/**` | push only with OK | | todo |
| **Tnn** Cleanup | Plan file and all its briefs deleted after the user confirms full implementation | — | User confirms the plan is fully implemented | ORCH | this plan, `.agent-briefs/<this plan's briefs>` | One commit `Docs: remove completed <feature> plan and briefs`; decisions remain in ADRs, evidence in `docs/qa/` | | todo |

---

## 4. Manual verification gate protocol

1. Limits/status command; abort if limits block; log usage.
2. Real configuration only; no mock mode; no network mocking.
3. Recording drift check (`--compare`).
4. Interactive use, one CLI command at a time; conversational features driven in real time.
5. Call budget per action vs expected table.
6. Console errors, UI language, screenshots at desktop and mobile, visual comparison.
7. Report in `docs/qa/<gate>/report.md`; defects → fix tasks; repeat until pass.

---

## 5. Parallel waves, critical path and hotspots

- **Waves:** <serial foundation; waves with ≤ 3 workers; integration serial on ORCH>
- **Critical path:** <T… → G… → …>
- **Hotspots (ORCH-only):** <manifests, lockfiles, shared contracts, runner configs, recordings, entry/layout files, this plan's status columns>

---

## 6. Failure, rollback and fallback

- Worker failure: reject; `git restore --source=HEAD -- <listed paths>`; untracked files removed only with user confirmation; retry with corrected brief; after two failures escalate tier or ORCH does it.
- Committed regression: `git revert <sha>`.
- Gate failure: fix tasks in the same phase; refresh recordings if shapes change; repeat gate.
- Limits/spend: stop and ask; never switch to mocks.
- Model/tool access: external → subagents → sequential.
- Contradictions: worker stops and reports; ORCH resolves against PRD/ADR or asks.
- **Cut order:** <optional items first>. **Minimum demonstrable cut:** <rows>. Gates and the recorded-mock rule are never cut.

---

## 7. Execution protocol

1. Mark row `in-progress` (plan, session task, issue).
2. Compile `.agent-briefs/<ID>-<slug>.md` just before dispatch (brief pattern); commit it with the task result.
3. Worker executes and reports; cannot change scope or accept its own work.
4. ORCH reads the diff, checks doubles load recordings, re-runs checks, commits named paths + brief, sets `done`.

---

## 8. External CLI quick instruction (optional)

<verified headless commands per CLI: run, continue, logs, permission config, forbidden flags>

---

## 9. Decisions

| # | Topic | Decision | Effect in this plan |
|---|---|---|---|

### Open
<only decisions that still block; with options and a recommendation>

## 10. First bounded task and review gate

- **Review gate:** <what the user must approve>
- **First task after approval:** <ID — exact deliverable>

## Revision log

| Rev | Date | Changes |
|---|---|---|
| 1 | <date> | Initial draft |
````
