# Report structure (both languages, same structure)

File names: `<topic-slug>-<YYYY-MM-DD>-EN.md` / `-PL.md` (+ `.html` with the same base name). Each file links to its counterpart in the other language.

1. **Title + metadata line.** Date, method (N search agents + M verification agents, models), link to the other language.
2. **TL;DR (5–7 points).**
   - Answer the user's question in the first point.
   - Identify the original source and say what it actually measured.
   - Add expert or author commentary, if any.
   - State whether newer evidence confirms or contradicts the claim, with numbers.
   - End with a practical takeaway.
3. **Source audit.**
   - A table: item | finding | status (paper, venue, affiliations, tasks, languages, models, lengths/conditions, N, statistics).
   - Headline numbers with their exact scope.
   - Claim vs paper: claim | what the paper says | verdict (Accurate / Overstated / Unsupported / Outdated / Wrong).
   - Confounders, kept separate as "authors' explanation" vs "our arithmetic/analysis (labelled)".
   - A data quality score.
4. **Newer evidence, one section per area.** A table: source | models | numbers (target vs baseline) | quality 1–5 with a reason. End each section with a one-paragraph conclusion.
5. **Mechanisms and costs**, if relevant.
6. **Practical implications** for the user's work.
7. **Gaps and unverified items.** Say what would unlock each one.
8. **Method.**
   - Agents and their scopes.
   - Iterations used.
   - Search languages.
   - **Corrections made during verification.**
   - Limitations, e.g. extraction from HTML via an LLM fetch rather than raw PDF.

## Quality rubric (1–5)

| Score | Meaning |
|---|---|
| 5 | Peer-reviewed; parallel items across conditions; large N; significance tested; current models |
| 4 | Two of: peer-reviewed, large N with parallel items, current models; no major confound |
| 3 | Preprint or medium N or older models; known confound acknowledged |
| 2 | Small N (< ~100 unique items), likely contamination, or unclear methodology |
| 1 | Media/secondary claim without traceable primary data |

## Writing rules

- Numbers use the locale's decimal separator (PL: comma).
- Mark every number that a second agent did not confirm as **UNVERIFIED**.
- Label your own calculations as "our arithmetic, not the authors' claim".
- Do not reproduce long passages; quotes stay at 25 words or fewer.
