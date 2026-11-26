# Implementation plans (temporary)

This folder holds implementation plans while they are being executed (`<feature>-implementation-plan.md`, created with the `write-plan` skill).

- **Temporary by design.** A plan is a working document for agents during implementation, not permanent documentation.
- **Delete after completion.** When the user confirms that a plan is fully implemented, the plan file and its briefs in `.agent-briefs/` are deleted in one commit (`Docs: remove completed <feature> plan and briefs`). This is the plan's last task.
- **History keeps them.** Deleted plans stay in Git history (`git log --all -- docs/plans/`) and can be restored at any time.
- **Why delete:** finished plans and briefs distract agents and lead them into work that is already done. Durable knowledge lives elsewhere: decisions in `docs/ADR/`, requirements in `docs/PRD.md`, verification evidence in `docs/qa/`.
- **Agents:** do not treat a plan here as current unless its status is DRAFT or ACCEPTED and its tasks are not all `done`.
