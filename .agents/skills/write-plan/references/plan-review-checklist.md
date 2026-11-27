# Plan review checklist (run before presenting, and when asked to review a plan)

Each item comes from a real mistake. Fix every hit; list what you changed in the plan's revision log.

## Inputs and environment
- [ ] Every command, flag, version and model ID in the plan was run/checked here (`--version`, `--help`, model list) or is marked unverified.
- [ ] No planned command is denied by the harness settings (`rm`, `curl`, `sudo`, `git reset --hard`, …) or needs root; an allowed alternative is given.
- [ ] Missing tools (package manager shim, ffmpeg, browsers) have a no-root install step in a task.
- [ ] Every PR the plan builds on has its **actual** base branch recorded; unpushed commits per branch are known; the planned PR diff contains only the intended files (check after pushes with `gh pr view <n> --json changedFiles`; criss-cross merges create noise).

## Dependency graph
- [ ] No cycles and no forward references: every verification method in a row uses only things that exist at that point (e.g. recording an endpoint by hand through a UI that is wired later is a cycle).
- [ ] Recordings precede the tests that replay them; own-endpoint recordings come after the endpoint exists.
- [ ] Critical path, waves and prerequisites agree with each other.
- [ ] Parallel tasks have disjoint editable files; hotspots (manifests, lockfiles, shared contracts, runner configs, recordings, layout/entry files, the plan's status columns) are orchestrator-only.
- [ ] Script entries and dependencies are registered in the setup task, so no worker edits manifests.

## Agent instructions and repository rules
- [ ] Commit rules: nothing red is committed — early acceptance specs are expected-to-fail annotated.
- [ ] Manual QA rule: every runtime-changing task has a task-level manual check; every phase has a gate.
- [ ] Mock rule: every endpoint double replays a recording; uncapturable errors are gaps; ADR test sections say the same.
- [ ] Fixture rules (e.g. "use only real photos, never generated files") are respected by every test input; impossible cases are documented gaps.
- [ ] Language, commit format, branch and worktree rules match the repository's instructions.
- [ ] What the plan says will be committed (briefs, recordings, screenshots, videos) is not git-ignored, and large binaries fit the repository's size limits.
- [ ] The plan ends with a cleanup task that deletes the plan and its briefs after the user confirms full implementation; `docs/plans/README.md` and `.agent-briefs/README.md` exist.

## PRD ↔ ADR ↔ plan consistency
- [ ] Every AC referenced exists; ordering/placement requirements (e.g. where a disclaimer appears) are the same in PRD, ADR data structures and UI design.
- [ ] Policy/business rules used by automation (fast paths, thresholds) include every condition of the source policy (e.g. packaging for goodwill returns).
- [ ] UI promises have the data to back them (e.g. "click to enlarge" needs an image larger than the thumbnail).
- [ ] "Nothing stored" style criteria are reconciled with logs/telemetry the ADRs add.
- [ ] Cross-references point to the right section numbers (flows, ADR sections); the link checker reports 0 broken links/anchors.
- [ ] Error codes and names are mapped consistently between modules.
- [ ] Architecture added by the plan lives in a Proposed ADR, not in plan assumptions.

## Numbers and status
- [ ] Issue count = number of rows that get issues (+ epic); task ranges in the text match the matrix.
- [ ] Status line, decisions table and "first task" reflect the latest user answers.
- [ ] Spend cap, evidence requirements (screenshots, video) and permission allow-list are written down with the user's decisions.
