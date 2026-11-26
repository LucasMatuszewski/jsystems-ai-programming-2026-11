# Default path — built-in subagents, sized to the task

The orchestrator (strongest available model, main session) keeps decisions, shared contracts, integration, recordings, gates, review acceptance and commits. Bounded work goes to subagents whose **model size matches the difficulty**. Prefer ad hoc subagents with an exact brief over new role files; create a short custom role only for a recurring need with reusable tool restrictions. Inspect any existing named role (model, tools, permissions) before reusing it.

## Model sizing

| Difficulty | Typical tasks | Model tier | Examples (verify availability in your harness) |
|---|---|---|---|
| Mechanical | Config edits, renames, docs links, fixture metadata | Smallest fast model | Claude Haiku; small/mini GPT; Luna-class via OpenRouter |
| Bounded implementation | One module or component against a frozen contract, with given tests or test cases; test-writing from acceptance criteria | Small fast model | Claude Haiku; Luna / mini models |
| Cross-cutting | Integration of several modules, prompts, flaky-test debugging, refactors touching shared code | Mid/strong model | Claude Sonnet; larger GPT with high reasoning |
| Decisions and acceptance | Architecture, contradictions, gates, accepting worker output | Orchestrator | Strongest available (e.g. Claude Opus) |
| Independent review | Review of the finished branch | Fresh context, mid/strong, ideally another model family | Claude Sonnet in a new subagent; Codex `exec review`; another provider |

Escalate one tier after two failed attempts on the same brief; downgrade when a task turns out mechanical.

## How per harness

| Harness | Mechanism | Notes |
|---|---|---|
| Claude Code | `Agent` tool, `subagent_type: general-purpose`, `model: haiku` / `sonnet` / `opus`, `run_in_background: true` for parallel work | Workers inherit the session's permission rules. The brief is the only context they get. |
| Codex CLI | `multi_agent` feature (check `codex features list`); model per profile/config | Or use `codex exec` headless as in the external-CLI path. |
| Other agents (OpenCode, Antigravity, Gemini CLI, …) | Their built-in subagent/agent mechanism, if any — check their docs/`--help` | If none: external-CLI path or sequential execution. |
| No subagents | Execute the same matrix sequentially | Keep the same briefs, reports and acceptance steps. |

## Rules for every worker

- Gets a self-contained brief (pattern: `assets/brief-template.md`) with pasted contracts, excerpts, predecessor outputs and the exact recordings to replay.
- Knows which tasks run concurrently and their file sets; edits only its listed files.
- Never commits, pushes, installs dependencies, edits manifests/lockfiles/shared contracts/recordings, or reads secrets.
- Writes the failing test first and reports red and green output; reports contradictions instead of resolving them; cannot accept its own work.
- Max ~3 concurrent workers per orchestrator, so every diff gets reviewed.
