# ADR-005: Agent Execution Tooling (pnpm invocation, workers, briefs)

**Date:** 2026-11-25
**Status:** Accepted (user, 2026-11-26)
**Relates to:** `docs/ADR/004-project-setup-and-tooling.md`, `AGENTS.md` (Sub-agents, Commit Rules)

---

## 1. Scope

Fills gaps found while planning the implementation: how pnpm is invoked on the course VM, which worker mechanisms execute bounded tasks, how workers are restricted, and where briefs and run logs live. Application architecture is unchanged.

---

## 2. Technology Documentation References

| Tool | Context7 ID or official docs | Used for |
|---|---|---|
| Corepack | https://github.com/nodejs/corepack | Running pnpm without a global install |
| OpenCode CLI (`opencode run`) | https://opencode.ai/docs/cli/ · permissions: https://opencode.ai/docs/permissions/ | Headless external-model workers |
| Claude Code subagents | https://docs.claude.com/en/docs/claude-code/sub-agents | Haiku workers via the Agent tool |

Verified on the VM (2026-11-25): Node v24.22.3; `corepack pnpm --version` → 12.23.0 (downloaded on first use); `pnpm` not on PATH; `/usr/bin/corepack` is root-owned, so `corepack enable` (ADR-004 §3.1 step 1) would need root; OpenCode 1.19.0 with an OpenRouter credential, model `openrouter/openai/gpt-6-luna` listed; Claude Code 2.1.332.

---

## 3. Component Design

### 3.1 pnpm invocation (amends ADR-004 §3.1 step 1)
- Use `corepack enable --install-directory ~/.local/bin pnpm` (user-writable, already on PATH) so that plain `pnpm …` works; if that fails, prefix every command with `corepack pnpm`.
- Pin the version with `packageManager: "pnpm@12.23.0"` (or the version the template pins, whichever is newer and works).
- `.claude/settings.json` currently allows `pnpm install`, `pnpm run`, `pnpm test`; `pnpm exec`, `pnpm dlx`, `pnpm add/remove` and `corepack …` will prompt. Whether to extend the allow-list is the user's decision.

### 3.2 Worker mechanisms

| Mechanism | When | How |
|---|---|---|
| Orchestrator (Claude Code main session, Opus 5.5) | Shared contracts, lockfile, integration, prompts, real-API captures, review acceptance, commits | Directly |
| Claude Code ad hoc subagent, `model: haiku` (Haiku 5.5) | Bounded test-writing and implementation with an exact brief | Agent tool, `subagent_type: general-purpose`, `model: haiku`, foreground or background; no custom role file |
| OpenCode headless, `openrouter/openai/gpt-6-luna` | Bounded implementation of self-contained modules (external-model delegation requested by the user) | `opencode run` (3.3) |
| Independent reviewer | Once, on the finished branch | Fresh Claude Code subagent (`model: sonnet`), brief = diff + document links only, no orchestrator conclusions |

No custom role files are created: every worker task is one-off and the brief carries the expertise.

### 3.3 OpenCode headless usage
- Command shape (run from the repository root, one task per run):
  `opencode run -m openrouter/openai/gpt-6-luna --variant medium --title "<task-id>" --format json -f <abs path to .agent-briefs/<task>.md> "Execute the attached brief exactly. Edit only the files listed under Editable files. Do not commit. End with the Report section filled in." > .agent-runs/<task>.jsonl 2> .agent-runs/<task>.err`
- `--format json` gives a machine-readable event log for the orchestrator; `--variant` sets reasoning effort; `-c`/`-s <id>` continues the same session for a correction round.
- **Never use `--auto`.** Permissions come from a project-level `opencode.json` at the repository root: file edits allowed; shell limited to `pnpm test`, `pnpm typecheck`, `pnpm lint` (and their `corepack pnpm` forms); deny `git commit`, `git push`, package installs, network fetch tools, reading `.env*`. Exact schema to be taken from the OpenCode permissions docs and verified by a smoke run (plan task T02) in which a denied command must be refused.
- OpenCode loads the repository `AGENTS.md` (and `app/AGENTS.md` once it exists) — to be confirmed in the smoke run.

### 3.4 Permission allow-list (user decision 2026-11-26)

Only what the plan needs is pre-approved in `.claude/settings.json` (added in plan task T02); everything else, incl. other `pnpm` and `playwright-cli` subcommands, stays under auto-mode checks / prompts.

- **pnpm:** `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm start`, `pnpm dev`, `pnpm openrouter:status`, `pnpm record:openrouter:*`, `pnpm record:app:*`, `pnpm eval:decisions`, `pnpm --version` (existing: `pnpm install:*`, `pnpm run:*`, `pnpm test:*`). Not added: `pnpm add`, `pnpm remove`, `pnpm dlx`, `pnpm exec`, `corepack …`.
- **playwright-cli (interactive QA and video):** `open`, `goto`, `close`, `list`, `snapshot`, `find`, `click`, `fill`, `type`, `select`, `check`, `uncheck`, `upload`, `press`, `reload`, `go-back`, `resize`, `screenshot`, `console`, `request*` (request inspection), `network-state-set`, `sessionstorage-list`, `sessionstorage-get`, `dialog-accept`, `dialog-dismiss`, `video-start`, `video-stop`, `video-chapter`, `video-show-actions`. Not added: `run-code`, `eval`, `route`, `unroute`, `state-load`, `delete-data`, `install*`, `kill-all`.
- `opencode run` is not pre-approved (not requested); each worker dispatch is checked.

### 3.5 Briefs and run logs
- `.agent-briefs/<task-id>-<slug>.md` — compiled by the orchestrator just before dispatch, committed with the task's result for traceability.
- `.agent-runs/` — raw worker logs, git-ignored.
- Brief sections: Goal, Concurrent work, Authoritative links, Source excerpts and current contracts, Predecessor outputs, Editable files (exhaustive), Forbidden actions, Ordered steps, Test inputs and expected results, Commands, Report format (files changed, red run output, green run output, contradictions, open questions).

---

## 4. Technical Decisions

### Corepack-shimmed pnpm in the user's bin directory
**Status:** Accepted · **Date:** 2026-11-26
**Context:** `corepack enable` targets a root-owned directory; `sudo` is denied by repository settings.
**Decision:** Install the shim into `~/.local/bin`; fall back to `corepack pnpm`.
**Rejected alternatives:** `npm i -g pnpm` (unpinned, writes to global prefix); `sudo corepack enable` (denied).
**Consequences:** (+) no root, pinned version; (−) per-user setup step on each VM.
**Review trigger:** VM image ships pnpm or Corepack is removed from Node.

### Two worker pools with one orchestrator
**Status:** Accepted · **Date:** 2026-11-26
**Context:** The user wants cheap workers (Claude Haiku) and external-model delegation (OpenCode + `gpt-6-luna` via OpenRouter).
**Decision:** As 3.2; shared files and integration stay with the orchestrator.
**Rejected alternatives:** Custom named roles (no recurring need yet); worktrees per worker (disjoint files make them unnecessary).
**Consequences:** (+) parallel waves on disjoint files; (−) two log formats to read; OpenCode permission config must be verified before use.
**Review trigger:** A worker edits a file outside its list, or the same role is needed in a second project.

---

## 5. Testing Strategy

| Scenario | Type | Expected |
|---|---|---|
| pnpm shim | Smoke | `pnpm --version` prints the pinned version from a new shell |
| OpenCode permissions | Smoke (T02) | read-only prompt succeeds; an attempted `git commit` and a read of `.env` are refused; JSON log shows model `openai/gpt-6-luna` |
| Haiku subagent | Smoke (T02) | subagent reports the brief's checksum line without editing files |

- TAC-005-01: No worker run log shows a commit, push, dependency install or `.env` read.
- TAC-005-02: Every committed task has its brief in `.agent-briefs/`.
