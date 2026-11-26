# Long-running processes: timeouts and monitoring

This is the project-level example. These rules normally belong at the user level (`~/.claude/rules/`). Claude Code loads every `.md` file in `.claude/rules/`; other agents reach this file through `AGENTS.md`.

The rules say *what* must hold. *How* is up to the agent and the shell (Bash, PowerShell, …) and the tools at hand (the agent's monitor/background-task tools, the test runner's own options, a small script).

## Principles
1. **Every long run has a deadline.** Before a build, server, E2E run, recording or eval starts, estimate its normal duration and enforce a hard limit at about 2–3× that. Use the tool's own option where one exists (for example a test runner's global timeout or a request abort signal), otherwise a shell or agent timeout.
2. **Every long run leaves a log** that can be read while it runs. That includes the app server's output.
3. **Clean start, clean finish.** Check for leftover processes and busy ports from earlier runs before starting, and stop what you started when done. Start servers yourself, and don't let a test runner silently reuse an unknown running server.
4. **Small units.** Run slow or paid work (real model calls) one spec or scenario at a time, so a hang or failure costs one unit.
5. **Background work is watched.** The coordinating agent keeps a periodic check (a monitor/watchdog, scheduled wake-up, or similar) on every background run and subagent: is the process still progressing, has it passed its limit, is it idle but busy on CPU? "Still waiting" is not progress.
6. **An overrun is a defect.** When a limit is passed, collect evidence (log tail, process state), stop the run, find the cause and report it. Never just wait longer or retry the same setup.
7. **Briefs carry the limits.** Every subagent brief that runs such work states the concrete limits, the log locations, and "report, don't wait".

## Project reference values
- Build: about 5 min.
- One E2E spec: about 15 min, because each submission takes 10–40 s.
- Recording or eval: about 10 min.
- The server should answer within 60 s.
- Watchdog: check every 5 min, flag anything older than 25 min.
- Evidence goes in `docs/qa/<task>/` (server log, run logs).

## Pitfalls seen here
- Waiting on a process by matching its command line can match the waiting command itself and never end. Wait on a PID or a deadline instead.
- Playwright's `webServer` with `reuseExistingServer` picked up an orphaned server whose output was discarded.

## Why this exists
On 2026-11-26 an E2E run and an orphaned server hung for more than an hour without anyone noticing. The cause was an endless wait loop plus a reused server, and nothing was watching for overruns.
