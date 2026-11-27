---
name: evidence-research
description: Use when the user wants a claim, headline, article, statistic or ranking checked against primary sources, or wants a research report backed by verified data rather than a quick answer. Typical triggers include "is this true?" with a link to a news or popular-science article; "find the original study/report behind this"; "is there newer data on X?"; "compare A vs B based on studies/benchmarks"; "what does the research say about X?"; "check the methodology and sample size of this study"; or any request for a sourced literature review, benchmark comparison or fact-check, in any domain (AI/LLMs, health, economics, technology, policy). Also use when the user asks for multi-agent or delegated research with iterations, or wants the findings as a shareable report or interactive artifact. Do not use for a single factual lookup answerable in one search.
---

# Evidence research audit

Coordinator workflow. **You manage, delegate, validate and write. Subagents search.** Do not run the searches yourself except quick one-off checks (e.g. a venue or date).

Reference files (read when you reach that step):
- `references/agent-prompts.md`: prompt templates for search and verification agents
- `references/report-structure.md`: Markdown report outline and quality rubric
- `assets/report-template.html`: working bilingual artifact (PL/EN toggle, dumbbell chart, significance and CI calculators, cost calculator, filterable source cards). Adapt it; do not start from scratch.

## Harness capabilities

This skill is shared by Claude Code and Codex CLI (`.claude/skills/` links to `.agents/skills/`). The steps name a capability, not a tool. Use the column for the harness you run in, and check which tools you actually have before Step 1.

| Capability | Claude Code | Codex CLI | No subagents available |
|---|---|---|---|
| Ask the user before starting | `AskUserQuestion` (one call) | One chat message with all questions; wait for the answer | Same as Codex |
| Parallel search and verify agents | `Agent` tool, `subagent_type: "general-purpose"`, `model: "haiku"`, `run_in_background: true` | Subagents via the `multi_agent` feature (on by default since 0.162.1; check with `codex features list`). Pick a cheaper model if your setup allows it | Run the scopes one by one yourself. Keep the verification pass separate from the search pass |
| Web search and page reading | `WebSearch` / `WebFetch` (load via `ToolSearch` if deferred) | Start Codex with `--search` for live web search. Without it, ask the user to restart with search or to provide sources | Whatever web tools exist |
| Follow-up to a running agent | `SendMessage` | Send the follow-up to the subagent if the harness allows it; otherwise start a new verifier with the conflict in its brief | New verification pass |
| Scratch files | Session scratchpad directory | A temporary directory outside the repo (`mktemp -d`) | Same as Codex |
| Shareable page | `Artifact` tool (Step 5) | No artifact tool: skip publishing, save the HTML in the repo and tell the user its path | Same as Codex |

If a capability is missing, use the fallback and say so in the final summary (Step 7). Do not stop the workflow because one tool is unavailable.

## Step 0: Ask first, in one message

Ask everything that blocks later steps **before** launching agents (Claude Code: one `AskUserQuestion` call; Codex: one chat message):
1. **Target folder** in the repo for reports and HTML (e.g. `course-materials/Research/`). Offer the folders that already exist.
2. **Languages** of the deliverables (default: EN + PL).
3. **PDF downloads**: may agents download PDFs with curl to read tables and figures? In auto mode the classifier blocks downloads without explicit consent. If the user agrees, record it and pass it to the agents. If not, use arXiv HTML only and mark figure-only values as UNVERIFIED.
4. **Max iterations** (default **5**).

Then check the target folder and `git status` for files on the same topic, so you do not duplicate earlier work. If the repo's AGENTS.md forbids reading that folder, list the filenames only and ask the user.

## Step 1: Decompose and launch the search agents in parallel

Split the question into 5–7 non-overlapping scopes and launch them **in parallel**, each on a cheap, fast model (see **Harness capabilities**: Claude Code uses `model: "haiku"` and `run_in_background: true`). Without subagents, work through the scopes in order. Typical scopes:
- **A1 Source audit:** the article, then the primary paper. Extract methodology, N, models and exact numbers with their table or section, and compare the article's claims with the paper's findings.
- **A2 Newer evidence, area 1** (e.g. retrieval/RAG)
- **A3 Newer evidence, area 2** (e.g. reasoning/agents)
- **A4 Target language/country sources**, searched **in that language**, including local institutions and expert commentary
- **A5 Related languages/regions**, searched in their native languages
- **A6 Mechanisms and costs** (e.g. tokenization, explanations)

**Lesson from the first run:** generic scopes (A2, A3) returned studies that did not include the target language, and a follow-up agent was needed. Put **"which benchmarks include <target language>, with per-language tables"** explicitly into A2/A3 from the start.

Use the template in `references/agent-prompts.md`. Every brief must contain:
- the overall project context;
- the agent's own scope;
- example queries and venues;
- the rule of **at least N search iterations** before concluding "no data";
- the evidence rules;
- an output file path in the scratch directory (see **Harness capabilities**) with a fixed section schema;
- a compact final message.

## Step 2: Triage each report as it arrives

Do not wait for all agents. For each report:
- List the claims you will rely on.
- Flag **conflicts between agents**, figure-only numbers, "UNVERIFIED" items, and surprising or headline numbers.
- Launch a **verification agent** (same cheap model) for each cluster of such claims, with exact cells to confirm and the instruction CONFIRMED / CORRECTED / UNVERIFIED. When two agents disagree, send the conflict to a verifier. If a relevant verifier is already running, send it a follow-up (Claude Code: `SendMessage`); otherwise start a new one.

Never read a subagent's raw transcript (in Claude Code, the `.output` file), because it floods your context. Read only the report files they write, and only when the summary is not enough.

## Step 3: Iterate (max N rounds, default 5)

One iteration = search → verify → gap analysis. After each round, list open questions. Launch another round only for gaps that matter to the user's question; use different phrasings, venues and languages. Stop early when the core questions are answered. Report the number of rounds used. Only after N rounds with nothing found may you state "no data exists", and list where you looked.

## Step 4: Write the reports (you, not agents)

Write the Markdown files into the user's folder: `<topic-slug>-<YYYY-MM-DD>-EN.md` and `-PL.md`, using `references/report-structure.md`.
- Include only numbers that a second agent confirmed, or mark them UNVERIFIED.
- Give each number its source location (table/section).
- Keep a "Corrections made during verification" list. It shows the reader why verification mattered.
- Quotes stay short (≤ 25 words) and attributed.

## Step 5: Build the artifact

Steps 1, 2 and 5 use the Claude Code `Artifact` tool and its `artifact-design` skill. In Codex or any harness without them, skip those three steps: write the page directly as a complete HTML document from the template (steps 3, 4 and 6 still apply) and give the user the file path instead of a link.

1. Load the `artifact-design` skill before writing the page.
2. Copy `assets/report-template.html` to the scratchpad and **strip its skeleton**: delete everything up to and including `<head>` except `<title>`, `<link>` and `<style>`, plus the `</head><body>` and `</body></html>` tags. The Artifact tool adds its own skeleton. Then replace its data arrays (`DS`, `TH`, `TK`, `SRC`) and texts. Keep the bilingual pattern: every text exists twice as `<span class="en">` and `<span class="pl">`, the body class sets the default language, and buttons toggle it.
3. Make the PL copy with a script (swap `<title>` and the default class) instead of writing the page twice.
4. Check the script with `node --check` on the extracted `<script>`. **Lesson:** the built-in browser cannot inspect local files outside the project, so do not spend a round trip trying.
5. Publish both pages with the Artifact tool (`icon` on first publish, one-sentence `description`).
6. **Save to the repo:** wrap each page with `<!doctype html><html lang><head><meta charset><meta viewport>…</head><body>…</body></html>`, because the artifact source has no skeleton. Save it next to the Markdown files under the same name with the `.html` extension.

## Step 6: Commit

Follow the repo's commit rules (AGENTS.md):
- Check `git status`.
- Stage **named paths** only; never `git add -A` or `git add .`.
- Message format `Docs: <summary>`, with the attribution line from the system reminder.

Do **not** push unless the user asks. Report the commit hash.

## Step 7: Summarise for the user

Answer the user's question directly in the first sentence. Then give:
- links to both artifacts, noting that they are private until shared;
- links to the files;
- 4–6 key findings with numbers;
- the corrections made during verification;
- what remains unverified and what would unlock it (e.g. PDF download consent).

## Pitfalls seen in practice (avoid them)

| Problem | Prevention |
|---|---|
| A verifier using `curl` for a PDF was blocked by the auto-mode classifier, and one round was lost | Ask for download consent in Step 0. Otherwise instruct agents: "read `arxiv.org/html/<id>vN` with your web tool (Claude Code: WebFetch); no curl/wget". |
| Haiku reversed a finding (claimed out-language passages beat in-language; the table showed the opposite) | Verify every number you will publish against the table with a second agent. |
| Wrong model attribution (a "no reasoning" column belonged to a different model) | Ask verifiers to confirm column headers and table captions, not only the cells. |
| Wrong scope of a headline number (88% was 64K+128K only) | Ask for the exact sentence that defines scope, model set and averaging. |
| A source assumed to include the target language did not | Ask verifiers to confirm the language list explicitly. |
| Two agents gave contradictory model lists | Send the conflict to a verifier (Claude Code: `SendMessage` to the running one) instead of guessing. |
| A headline average was described as "across N models" although one model ran in English only (found in PR review) | Ask verifiers which models have results in **every** compared language, not only which models the paper evaluated. Recompute any per-model arithmetic with that count. |
| Values exist only in figures or heatmaps | Do not estimate from images. Mark UNVERIFIED and offer the PDF route. |
| Agents cite mirrors (alphaxiv, aggregators) | Accept them only as pointers. The final citation must be arXiv, ACL Anthology, a journal or an official leaderboard. |
| Small-N "rankings" presented as facts | Report N per cell and whether significance was tested; use the CI calculator in the artifact. |
| Repo rule forbids reading a folder that holds related work | List filenames only and ask the user whether to merge or keep separate. |
