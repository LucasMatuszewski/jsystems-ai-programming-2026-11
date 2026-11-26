# Optional path — external CLI agents in headless mode

Use when the user wants work delegated to other agents or model providers. Any agent CLI with a non-interactive mode can be a worker; the pattern is the same. **Verify flags with `<cli> --help` and `<cli> <subcommand> --help` in the current environment before writing them into a plan** — the examples below were verified on 2026-11-26 and may change.

## Pattern

1. **Permission smoke test first** (its own plan task): restrict the worker with the tool's project-level permission/sandbox configuration; run one read-only prompt and confirm that a forbidden action (commit, reading `.env`, installing packages) is refused and that the log shows the intended model. Never use permission-bypass flags (`--auto`, `--dangerously-*`, full-access sandboxes).
2. Compile the brief to a durable path (`.agent-briefs/<task-id>-<slug>.md`); it is committed with the task result and deleted with the plan after full implementation.
3. Run headless from the repository root, one task per run, logs to a git-ignored folder (`.agent-runs/`). In Claude Code start it with Bash `run_in_background` and wait for the completion notification instead of polling.
4. Read the final message from the JSON/event log, then `git diff --stat`, then re-run the task's checks yourself.
5. Correction round in the same worker session if the CLI supports resume; after two failures take over or escalate the model tier.

## OpenCode (verified: `opencode` 1.19.0)

- Models: `opencode models <provider>` (e.g. `opencode models openrouter` lists `openrouter/openai/gpt-6-luna`). Credentials: `opencode auth list` (prints provider names, not keys).
- Run: `opencode run -m <provider/model> --variant <low|medium|high> --title "<task-id>" --format json -f <absolute path to brief> "Execute the attached brief exactly. Edit only the files listed under Editable files. Do not commit. End with the Report section filled in." > .agent-runs/<task-id>.jsonl 2> .agent-runs/<task-id>.err`
- Continue: `opencode run -s <session id from the log> -m <model> "<correction>"`.
- Restrict with a project `opencode.json` permission block (take the schema from https://opencode.ai/docs/permissions/ and confirm it in the smoke test). Do not use `--auto`.

## Codex CLI (verified: `codex-cli` 0.162.1)

- Run: `codex exec -m <model> -s workspace-write -C <repo root> --json -o .agent-runs/<task-id>.last.md - < .agent-briefs/<task-id>.md > .agent-runs/<task-id>.jsonl`
  - `-s read-only` for review/analysis tasks; never `danger-full-access` or `--dangerously-bypass-approvals-and-sandbox`.
  - `--output-schema <file>` can force a structured report.
- Continue: `codex exec resume <session id> "<correction>"` (or `--last`).
- Independent review: `codex exec review` against the current repository (read-only sandbox).

## Google Antigravity (`agy`) and other CLIs (Gemini CLI, Aider, …)

Not installed in the environment where this skill was written, so no flags are given. Before planning with them, check: the non-interactive/headless command, model selection, permission or sandbox mode, JSON/log output, session resume, and how it loads `AGENTS.md`. Write the verified command into the plan's quick-instruction section; if a capability is missing (e.g. no sandbox), keep that CLI for read-only tasks or do not use it.

## What goes into the plan

- An "Owners/models" table with one label per mechanism (e.g. ORCH, SMALL-SUBAGENT, EXT-OPENCODE, EXT-CODEX, REVIEW) and the exact model.
- A smoke-test task before the first external dispatch.
- A short quick-instruction section with the verified commands for each external CLI used.
- Fallback: if the external CLI or its provider is unavailable, its rows move to built-in subagents; if those are unavailable, the orchestrator executes sequentially.
