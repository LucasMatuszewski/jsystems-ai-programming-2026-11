---
name: write-plan
description: Use when the user wants an implementation plan, execution plan, task breakdown, dependency matrix or agent work plan for an application or feature that already has (or is about to get) a PRD and ADRs — typically the step after write-prd and write-adr. Produces a reviewable docs/plans/<feature>-implementation-plan.md with phased runnable increments, automated and manual verification at every phase, recorded-call test doubles, model sizing per task, optional delegation to subagents or external CLI agents (OpenCode, Codex, Antigravity, others), tracker linkage, critical path, rollback and fallback. Also use to review or repair an existing plan for contradictions. Do not use to implement the plan.
---

# Write an implementation plan

You are the **orchestrator**: you inspect, decide, write the plan and later accept results. Planning never authorizes execution, new agents, pushes, issue creation, PRs or merges — each needs the user's explicit OK.

Read when you reach the step:
- `assets/plan-template.md` — pattern for the plan file
- `assets/brief-template.md` — pattern for the self-contained worker brief compiled just before dispatch
- `assets/plans-readme.md`, `assets/briefs-readme.md` — README files for `docs/plans/` and `.agent-briefs/` (create them when missing)
- `references/verification-methodology.md` — automated + manual checks at every task and phase, recorded test doubles, call budget, limits, evidence
- `references/delegation-subagents.md` — default path: built-in subagents and model sizing by difficulty
- `references/delegation-external-cli.md` — optional path: external CLI agents (OpenCode, Codex, Antigravity, others)
- `references/plan-review-checklist.md` — consistency checks to run before presenting the plan
- `scripts/check_links.py` — relative link and anchor checker for the plan, PRD and ADRs

**Templates are patterns, not forms.** Follow their structure and intent, but adapt them to the project: rename, merge or drop sections that do not apply (say so in one line), add sections the project needs, and size the matrix to the work. Do not copy placeholders or rows blindly. The same applies to briefs: a small mechanical task needs a short brief, a cross-cutting one a full brief.

## Harness capabilities

Steps name a capability, not a tool. Check which tools you actually have before Step 1.

| Capability | Claude Code | Codex CLI | Other harness / none |
|---|---|---|---|
| Ask the user | `AskUserQuestion` (max 4 questions per call) | One chat message with numbered questions; wait | Same as Codex |
| Subagents | `Agent` tool with `model: haiku/sonnet/opus` | `multi_agent` feature (`codex features list`); model per profile | Run the matrix sequentially yourself |
| Session task list | `TaskCreate`/`TaskUpdate` | Plan/todo tool if present | Status column in the plan |
| Library docs | Context7 (`ctx7` CLI or MCP) → official docs | Same | Same |

## Process

### Step 1 — Read the inputs, not the examples
Read the repository's agent instructions (`AGENTS.md`/`CLAUDE.md`, nested ones too), the PRD, every ADR, design guidance and fixture READMEs. Course or teaching examples are not requirements. If PRD or ADRs are missing, offer `write-prd` / `write-adr` first.

### Step 2 — Inspect the real state and verify every command you will put in the plan
Record what exists, not what should exist. Mandatory checks (see the "Current state" section of the template):
- `git status`, current branch, `git worktree list`, unpushed commits per relevant branch (`git log origin/<b>..<b>`).
- **For every open PR you will build on: its base branch** (`gh pr view <n> --json baseRefName,headRefName,changedFiles`). Never assume a PR targets `main`; stacked PRs are common.
- Application entry points, build descriptors, existing tests; run the existing build/test commands to get the **baseline** (or state that none exist).
- Tool availability with `--version`/`--help` for every CLI the plan uses (package manager, browser CLI, video tools, agent CLIs). A tool that is missing, or needs root/sudo, needs an install path that works without them.
- Permission rules of the harness (allow/ask/deny lists). Do not plan commands the settings deny (for example `rm`, `curl`, `sudo`, `git reset --hard`); plan an allowed alternative.
- Tracker availability (`gh issue list`, permissions) and model/provider availability for any delegated model (`opencode models <provider>`, harness model list). Check that credentials exist without printing them.

### Step 3 — Ask only consequential questions
Ask before writing when the answer changes the plan. Typical ones (skip what is already decided):
1. **Scope:** one vertical slice or the whole application? (Do not assume — users change this.)
2. **Branches and PRs:** base branch, stacking on open PRs, one docs PR vs implementation PR.
3. **Tracker:** issues, session tasks, plan status column — and how their IDs link.
4. **Real-endpoint spend cap** and whether to stop or continue when it is reached.
5. **Evidence:** screenshots committed in the repo? final demo video?
6. **Permissions:** which commands may be pre-approved (only what the plan needs).
7. **Delegation:** subagents only, or also external CLI agents and which models.

### Step 4 — Turn gaps into proposed ADRs, contradictions into fixes
- Missing architecture or tooling decisions → a **Proposed ADR**, not a plan assumption. The plan links to it.
- Contradictions between PRD, ADRs, plan and agent instructions → fix the documents (state what changed) or ask the user. Never leave the worker to choose.

### Step 5 — Design phases as runnable increments
Each phase ends with something a person can run and use, followed by a **manual verification gate**. Order tasks so every input exists before it is needed:
- Foundation (scaffold, tooling, shared contracts, real-call recordings of external APIs) → feature increments → hardening and delivery.
- Recordings come **before** the tests that replay them; own endpoints are recorded only after they exist (via real HTTP requests to the running app, not via a UI that is not wired yet).
- Risky external APIs get an early capture/spike task with an explicit **stop-and-ask gate** if reality contradicts the ADR.

### Step 6 — Write the dependency matrix
One authoritative matrix (per phase), columns exactly as in the template. Rules for every row:
- Bounded deliverable with an **observable outcome**, links (not copies) to exact PRD criteria and ADR sections, prerequisites, owner/model, **exhaustive editable files**, verification and handoff, commit boundary, issue, status.
- Tests first: the behavioural test is written and seen failing before the implementation.
- Acceptance specs written early are committed **as expected-to-fail** (e.g. `test.fail()`), never as red tests, because commit rules require green verification; the task that wires the flow removes the annotation.
- Every task that changes what the running app does includes a **task-level manual check**; each phase ends with a **gate row** (G1, G2, …).
- Shared contracts, lockfiles, dependency manifests (incl. script entries), runner configs and recordings are orchestrator-only; register all scripts/dependencies in the setup task so workers never edit them.
- Test inputs must exist and be allowed by the repository's fixture rules; if a case cannot be produced with real inputs, it is a documented gap, not a generated file.

### Step 7 — Plan verification (see `references/verification-methodology.md`)
Automated and manual at every phase, against real endpoints, with call-budget and provider-limit checks. Endpoint doubles only from recorded real calls. A green build alone proves nothing about startup or the user flow.

### Step 8 — Plan delegation
- **Default:** built-in subagents with model size matched to task difficulty (`references/delegation-subagents.md`).
- **Optional:** external CLI agents in headless mode (`references/delegation-external-cli.md`), only after a permission smoke test.
- Parallelize only independent inputs with disjoint files; cap concurrent workers so the orchestrator can review every diff; serialize shared contracts and integration. One checkout by default; a worktree only when agents must edit the same files in parallel (ask first).

### Step 9 — Self-review, then present
Run `references/plan-review-checklist.md` and `python3 <skill>/scripts/check_links.py <plan> <PRD> <ADR files…>`. Fix every finding. Save to `docs/plans/<feature>-implementation-plan.md` (or the harness's configured plans directory) with status **DRAFT — awaiting review**. If `docs/plans/README.md` or `.agent-briefs/README.md` is missing, create it from `assets/plans-readme.md` / `assets/briefs-readme.md`. Present: saved path, verified commands and baseline, resolved and open decisions, the first bounded task, the review gate. Stop.

### Step 10 — After the user accepts
Set status **ACCEPTED** with the date, record the decisions, mark the docs task done, commit on the docs branch (named paths only), and — only with the user's OK — push and open the PR. Before pushing in a PR stack, re-check bases and merge bases; after pushing, verify each PR's `changedFiles` matches expectations. Never stage unrelated local changes; if one blocks a branch switch, stash only that path and restore it afterwards.

### Step 11 — Lifecycle: plans and briefs are temporary
- Briefs in `.agent-briefs/` are **committed** with the task they belong to (traceability during implementation). The folder must not be git-ignored; if it is, propose removing that ignore rule instead of keeping briefs local.
- Every plan ends with a **cleanup task**: after the user confirms that the whole plan is implemented, delete the plan file and all its briefs in one commit (`Docs: remove completed <feature> plan and briefs`). Git history keeps them; stale plans and briefs otherwise distract later agents and pull them into finished work.
- Keep the durable outcome elsewhere: decisions stay in ADRs, requirements in the PRD, evidence in `docs/qa/`.

## Rules learned the hard way

- Verify, then write: every command, flag, version, model ID and PR base in the plan was checked in this environment or is marked unverified.
- No forward references: a verification step may only use things that exist at that point of the dependency graph.
- Reconcile with agent instructions (commit rules, Manual QA after every runtime task, mock rules, fixture rules) row by row.
- After any change to the plan, recount derived numbers (issue counts, task ranges, critical path) and re-run the link check.
- When a rule changes (for example "mocks only from recordings"), update every ADR test section that contradicts it in the same change.
- Never use permission-bypass flags (`--auto`, `--dangerously-*`) for workers; restrict them with a project permission file.
- What the plan promises to commit (briefs, recordings, screenshots, videos) must not be git-ignored; raw worker logs (`.agent-runs/`) stay ignored.
- The plan document is English unless the project agrees otherwise; talk to the user in their language.
