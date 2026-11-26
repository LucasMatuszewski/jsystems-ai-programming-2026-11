# Worker brief — pattern

A **pattern, not a form**: keep the intent of each section, scale the brief to the task (a mechanical task may need only Goal, Editable files, Steps and Report), and add sections when the task needs them.

Compile right before dispatch and save as `.agent-briefs/<task-id>-<slug>.md` (a durable project path, not a temp file). Commit it with the task result; it is deleted together with the plan after the user confirms full implementation. The worker must not need to rediscover the architecture: paste what it needs, link the rest for traceability.

```markdown
# Brief <task-id> — <title>

## Goal
<one paragraph: the observable outcome from the matrix row>

## Concurrent work
<other tasks running now, their owners and file sets — do not touch them>

## Authoritative links (traceability only)
- PRD: <exact criteria IDs + links>
- ADR: <exact sections + links>
- Plan row: <link>

## Current contracts and excerpts (pasted)
<types/schemas/interfaces, relevant source excerpts, predecessor outputs, API notes for the installed versions>

## Recordings to replay
<exact fixture files and what each represents; derived variants allowed: which fields>

## Editable files (exhaustive)
- <path>
- <path>

## Forbidden
- Editing any other file, manifests, lockfiles, shared contracts or recordings
- Installing dependencies, committing, pushing, reading secrets
- Hand-written or scripted endpoint responses; generated test images/files
- Permission-bypass flags

## Steps
1. Write the behavioural test(s): <cases with inputs and expected results>
2. Run `<command>` and confirm they fail for the expected reason; keep the output.
3. Implement the minimum to pass.
4. Run `<scoped test command>`, `<typecheck>`, `<lint>`.
5. <task-level manual check, if the task changes the running app>

## Test inputs and expected results
| Input | Expected |
|---|---|

## Report (fill in at the end)
- Files changed:
- Red run (command + output excerpt):
- Green run (command + counts):
- Manual check (if any):
- Contradictions / open questions:
```
