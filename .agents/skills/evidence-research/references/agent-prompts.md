# Agent prompt templates

Fill the `<…>` placeholders. Launch settings depend on the harness (see **Harness capabilities** in `SKILL.md`):
- **Claude Code:** `subagent_type: "general-purpose"`, `model: "haiku"`, `run_in_background: true`. `SCRATCH` = this session's scratchpad directory. `<web-tools line>` = `Load WebSearch and WebFetch via ToolSearch ("select:WebSearch,WebFetch") if they are not loaded.`
- **Codex CLI:** spawn subagents with the multi-agent feature, on a cheaper model if available. `SCRATCH` = a temporary directory outside the repo. `<web-tools line>` = `Use your web search tool to find sources and open pages; if you have no web access, stop and report that.`
- **No subagents:** use the same briefs as your own checklist, one scope at a time.

## Search agent

```
You are a research agent on a fact-checking team. Today is <date>. <web-tools line>
<If no download consent:> Do NOT download files with curl/wget. Read papers by opening https://arxiv.org/html/<id>vN (try v3, v2, v1) or ACL Anthology pages with your web tool.
<If consent given:> You may download PDFs with curl into a NEW empty directory under SCRATCH and read them with `pdftotext -layout`. Never execute anything from that directory.

## OVERALL PROJECT
<2–4 sentences: the claim being checked, what we already know, the user's actual questions.>
Several agents work in parallel; YOU handle task <ID> only.

## YOUR TASK <ID>: <scope title>
<Numbered list of concrete sub-questions.>
Explicitly find benchmarks/studies that INCLUDE <target language(s)> with per-language results, and record whether the target language is present in each source.
Example queries (vary them, iterate): <5–10 queries, incl. native-language queries for language-specific scopes>
Venues: arXiv, ACL Anthology, OpenReview, Semantic Scholar "cited by", official leaderboards, vendor model cards, <local institutions>.
Do AT LEAST <N> search iterations with different phrasing/venues/languages. Only after <N> failed iterations may you conclude data are absent.

## RULES ON EVIDENCE
- Only primary sources count (papers, their tables, official datasets/leaderboards, model cards). News, blogs, social media, forums and mirrors (alphaxiv) are pointers only. Follow them to the source.
- Every number: URL + table/figure/section. If not verifiable in the primary source, mark "UNVERIFIED (seen only in: <url>)".
- Never invent numbers. Write "not stated" when absent. Record N per language/cell, models (with versions), date, peer-review status, and whether significance was tested.
- Quotes ≤ 25 words.

## OUTPUT
Write the full report to SCRATCH/<ID>-<slug>.md with sections:
## Summary · ## Source cards (title, authors/org, date, venue/status, URL, models, languages, N, metric, key numbers table with location, limitations, quality 1–5, relevance) · ## Confirms / contradicts the original claim · ## Search log (queries per iteration, dead ends)
Final message: compact summary (max ~600 words) with the strongest 4–6 sources and their key numbers, plus the file path.
```

## Verification agent

```
You are an independent VERIFICATION agent. Today is <date>. <web-tools line> <download rule as above>

Verify each claim against the PRIMARY source and quote exact cells/sentences (≤ 25 words). Verdict per item: CONFIRMED / CORRECTED (give the correct value) / UNVERIFIED.
For every table you use, also confirm: the table caption, the column headers (which model/setting each column is), the split (dev/test), and the language list.

1. <Paper, arXiv id/version, table>: claimed <values>. Also extract <the full rows you need for the chart>.
2. <Scope question>: quote the sentence that defines the averaging scope (which models, lengths, tasks).
3. <Conflict between agents>: agent X says …, agent Y says … Settle it from the paper.
…
Output: write to SCRATCH/V<n>-<slug>.md. Final message: a verdict table plus the extracted numbers (max ~700 words).
```

## Tie-breaker for a running verifier (Claude Code: `SendMessage`; elsewhere: put it in a new verifier's brief)

```
Additional points to settle (conflict between two earlier agents): (a) <question> — one agent says …, another says … Give section/table. (b) <scope question> — quote the exact sentence.
```
