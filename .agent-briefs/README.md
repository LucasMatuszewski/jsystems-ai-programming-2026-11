# Agent briefs (temporary)

Self-contained briefs that the orchestrator compiles just before dispatching a task to a worker agent (`<task-id>-<slug>.md`). The pattern is in the `write-plan` skill (`assets/brief-template.md`).

- **Committed during implementation.** Each brief is committed with the result of its task, so reviewers can see exactly what the worker was told. Raw worker logs go to `.agent-runs/` (git-ignored).
- **Temporary by design.** When the user confirms that the related plan in `docs/plans/` is fully implemented, all of its briefs are deleted together with the plan in one commit (`Docs: remove completed <feature> plan and briefs`).
- **History keeps them.** Deleted briefs stay in Git history (`git log --all -- .agent-briefs/`) and can be restored at any time.
- **Why delete:** old briefs describe finished tasks with outdated contracts; agents that find them may follow stale instructions.
- **Agents:** a brief is an instruction only for the task and worker it was dispatched to; never execute a brief you were not given.
