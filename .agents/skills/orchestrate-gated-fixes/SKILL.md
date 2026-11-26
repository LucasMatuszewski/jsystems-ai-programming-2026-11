---
name: orchestrate-gated-fixes
description: >-
  Orchestrate fixes for review or QA findings with subagents while an
  independent manual QA gate uses the shared app server. Use when an orchestrator
  must triage findings, brief fix workers, avoid build/server conflicts with a
  running tester, and close with an independent gate re-run before "done".
---

# Orchestrate gated fixes

The orchestrator only briefs, reviews and commits. Workers implement, and independent testers verify. This skill covers the loop:

findings → triage → fix (phase 1, code only) → gate finishes → fix (phase 2, build and real checks) → independent re-gate.

## 1. Triage the findings
- For every finding, reproduce it or reject it with a reason. Record the decision for each one: accept, reject, or defer, with the exact expected behaviour.
- Prefer server-side truth over client values: recompute derived data, and use allow-lists for roles and message parts.
- Group the accepted findings into **one** fix brief per disjoint set of files.

## 2. Respect the shared server (phase gate)
A running QA gate owns port 3000 and the current build output (`.next/`), until the orchestrator releases it.
- **Phase 1** (while a gate runs): source code and unit/integration tests only. No build, no server, no E2E, and no writes to build output. The worker reports "phase 1 done" and stops.
- **Phase 2** (after the orchestrator says "gate done, start phase 2"):
  - the build;
  - its own server with a log file;
  - a short real check of the touched flows;
  - the full E2E suite per project;
  - the spend record.
- Add the findings from the just-finished gate to the phase-2 message, so they are fixed in the same pass.

## 3. Brief every worker with
- the goal per finding, the sources (PRD/ADR sections), and the **editable files** (nothing else);
- tests first (red, then green), and named derived variants of real recordings, never hand-written bodies;
- limits from `.claude/rules/long-running-processes.md`: a timeout per command, logs, "report, don't wait", and never waiting on a process by matching its command line;
- "no commits, no `git add`, never read `.env*`";
- "return the report as text": built-in subagents cannot write report files, so the orchestrator saves them.

## 4. Review before committing (orchestrator)
- Re-run the unit tests, typecheck and lint yourself.
- Read the diff of the risky files, and look at one or two screenshots.
- Move temporary files out of the repo with `mv`, never `rm`.
- Commit named paths only, one logical change per commit (`Area: summary`), and update the plan status.

## 5. Close with an independent gate
- After a fix lands, a **fresh** tester (not the fix worker) re-runs the affected scenarios in the real app. A worker's own check is not a gate.
- Every acceptance criterion ends in exactly one of these states:
  - **verified in a real run**, with evidence;
  - **covered only by tests**, with the reason a real run was impossible and the attempts made;
  - **needs a physical device / external party**.

  Record the last two in the plan as a revision, with links to the evidence.
- Use verification-only configuration (for example a lowered threshold through env) to exercise rare real paths. Label it clearly, and never change production defaults.

## 6. Keep watch
While any worker or tester runs, keep a watchdog that checks process age every 5 minutes, and re-arm it when it expires. Check each worker's logs when it is notified as "waiting on background work".
