# Agent brief template

Briefs are compiled by the orchestrator (ORCH) right before a worker dispatch (ADR-005 §3.5).
File name: `.agent-briefs/<task-id>-<slug>.md`. Raw worker logs go to `.agent-runs/` (git-ignored).

Checksum line (used by harness smoke runs): `BRIEF-TEMPLATE-CHECKSUM: hsdc-7f3a`

## Goal
<one paragraph: observable outcome of the plan row>

## Concurrent work
<other running tasks and the files they own — do not touch them>

## Authoritative links
<PRD / ADR sections>

## Source excerpts and current contracts
<pasted schemas, types, function signatures the worker must use>

## Predecessor outputs
<files produced by earlier tasks; exact recording files to replay>

## Editable files (exhaustive)
<paths; nothing else may be changed>

## Forbidden actions
- No `git commit`, `git push`, dependency installs, reading `.env*`, network calls.
- No hand-written or scripted endpoint responses: test doubles load recordings from `app/tests/fixtures/**` only.
- No generated images: upload tests use `assets/example-images/` only.

## Ordered steps
1. Write the failing test(s); run them and keep the red output.
2. Implement the minimum code; run until green.
3. Run the commands below.

## Test inputs and expected results
<table>

## Commands
`pnpm test -- <path>` · `pnpm typecheck` · `pnpm lint` (inside `app/`)

## Report format
Files changed · red run output · green run output · contradictions · open questions

Built-in subagents may not write report files ("return findings as text"). A worker writes code, logs and screenshots, and returns its report as text in its final message. The orchestrator saves gate reports to `docs/qa/<gate>/report.md`. The `qa-tester` agent type (`.claude/agents/qa-tester.md`) is meant to write them itself; verify that in a fresh session.
