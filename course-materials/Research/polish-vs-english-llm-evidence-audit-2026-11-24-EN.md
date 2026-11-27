# Is Polish the best language for LLMs? Evidence audit (2025–2026)

Date: 2026-11-24 · Research method: 6 search agents + 5 verification agents (Claude Haiku), coordinated and quality-checked by Claude Opus. Polish version: [polish-vs-english-llm-evidence-audit-2026-11-24-PL.md](polish-vs-english-llm-evidence-audit-2026-11-24-PL.md)

## TL;DR

1. The cryps.pl article ("Polish beat English in the newest ranking", 25 Oct 2025) is based on one paper: **OneRuler** (Kim, Russell, Karpinska, Iyyer; UMD, Microsoft, UMass Amherst; COLM 2025; [arXiv 2503.01996](https://arxiv.org/abs/2503.01996)).
2. The paper does report **Polish 1st of 26 languages (88%) and English 6th (83.9%)**. The test was a **synthetic needle-in-a-haystack task**, averaged over **the 6 early-2025 models with multilingual results** (the paper evaluated 7, but ran DeepSeek-R1 in English only) and **only the 64K and 128K context lengths**. It did not measure "information retrieval" in general, RAG, or prompting quality.
3. Co-author Marzena Karpińska said the Polish–English difference was **not statistically significant** and that the study **does not show Polish is the best language for prompting**. She also noted that each language used a **different book** as the haystack ([Science in Poland, 27 Nov 2025](https://scienceinpoland.pl/en/news/news,110407)).
4. **No 2025–2026 study replicates "Polish > English".** Where Polish is measured against English on the same questions, English usually wins:
   - Multilingual RAG (MKQA, 4 open models): Polish **8–22 points lower** than English.
   - Medical exams: English higher for small models; roughly equal for GPT-4o.
   - PISA-style reasoning on GPT-5.1 and Claude Opus 4.5: Polish **0.8–5.6 points lower**, except one setting where it is 1.6 points higher.
5. **Language does affect reasoning, but the effect is small for frontier models and large for small models.** Forcing a model to *reason* in a non-English language lowers accuracy (Russian −5 pts, Spanish −15, Japanese −19, Swahili −32 on MATH-500). For the newest frontier models the gap between English and Slavic languages shrinks to **0–6 points**, often within noise.
6. Polish costs more: the same text takes **1.3–1.8× more tokens** in Polish than in English with mainstream tokenizers.

**Practical takeaway for agent work:** write system prompts, agent instructions and tool descriptions in English, and let the model reason in English. Keep user-facing content and domain data in Polish when the task depends on Polish-specific knowledge.

---

## 1. Source audit: what OneRuler actually measured

| Item | Finding | Status |
|---|---|---|
| Paper | "One ruler to measure them all: Benchmarking multilingual long-context language models", Kim, Russell, Karpinska, Iyyer | Verified (arXiv v1 3 Mar 2025, v2 8 Aug 2025, v3 30 Sep 2025) |
| Venue | COLM 2025 (PDF header "Published as a conference paper at COLM 2025") | Verified via PDF header; no OpenReview page found |
| Affiliations | University of Maryland, Microsoft, UMass Amherst | Verified from HTML header |
| Tasks | 7 synthetic tasks adapted from RULER: needle-in-a-haystack variants (single, multi-key, multi-value, multi-query, "none" needle) + common-word extraction (aggregation) | Verified |
| Languages | 26 | Verified |
| Models | 7: Gemini 1.5 Flash, o3-mini-high, DeepSeek-R1, Llama 3.3 70B, Llama 3.1 8B, Qwen2.5-72B, Qwen2.5-7B (Table 5, App. B.1). DeepSeek-R1 was run in English only (Sec. 3, fn. 11), so 6 models have results in the other 25 languages. | Verified |
| Context lengths | 8K, 32K, 64K, 128K | Verified |
| Sample size | 50 examples per task × language × length | Verified |
| Haystack text | A different public-domain book per language (Polish: *Noce i dnie*; English: *Little Women*) | Verified |
| Statistics | No confidence intervals or significance tests for language differences. The only reported statistic is Kendall τ = 0.82, which concerns model rankings. | Verified |

### Headline numbers (Sec. 3.1)

| Setting | Polish | English | Other |
|---|---|---|---|
| NIAH average across the 6 multilingual models, **64K + 128K** (the paper says "all models" without listing them) | **88%** (rank 1) | **83.9%** (rank 6 of 26) | Chinese 62.1% (4th worst) |
| o3-mini-high, 128K only | 92% | 67% | Ukrainian 89% |
| Effect of the "answer none if absent" instruction, English, 128K | — | S-NIAH accuracy drops by 32% | — |

Russian, Czech, Ukrainian and Serbian appear in the top group, but their exact averages are shown only in heatmap figures (Fig. 4/25). We could not extract those values without downloading the PDF, so they are **not quoted**.

### What the article got wrong or overstated

| Article claim | Paper | Verdict |
|---|---|---|
| Polish is the best language for AI / prompting | The paper measures long-context retrieval on synthetic tasks, not prompting. The co-author denies the prompting interpretation. | **Overstated** |
| Polish beat English | 88% vs 83.9%: a 4.1-point gap. No significance test; the co-author says the gap was not significant. | **Overstated** |
| Polish wins despite having little training data | Not in the paper. Polish is not among its low-resource languages. | **Unsupported** |
| Applies to the "newest models" | 7 models from early 2025, 6 of them tested beyond English. None are current-generation models as of Nov 2026. | **Outdated** |

### Why Polish might have come first: three confounders

1. **Different haystack book per language.** Difficulty of the filler text is not controlled. The co-author named this as a possible reason.
2. **One model can move the average.** o3-mini-high scored 67% in English vs 92% in Polish at 128K, and the authors report it often wrongly answered "none". *Our arithmetic, not the authors' claim:* a 25-point gap in one of the six models with Polish results alone contributes about 4.2 points (25 / 6) to the six-model average at that length. That is as much as the whole 4.1-point headline gap.
3. **Small cells.** With 50 items per cell, the 95% interval around 85% is roughly ±10 points per cell. The interactive artifact includes a calculator for this.

The authors give **no causal explanation** for Polish's rank. They hypothesise that differences between languages "stem from factors such as pretraining data availability, script, language family, and tokenizer specifications".

**Data quality score:** benchmark design 3/5; the claim "Polish is best" 1–2/5.

---

## 2. Newer evidence: retrieval and RAG

| Source | Models | Polish/Slavic vs English | Quality |
|---|---|---|---|
| **On the Consistency of Multilingual Context Utilization**, [arXiv 2504.00597v4](https://arxiv.org/abs/2504.00597) (Nov 2025), Table 15/18 | Aya-Expanse-8B, Llama-3.2-3B, Gemma-2-9B, Qwen2.5-7B | MKQA, single in-language gold passage. **PL vs EN:** Aya 79.2 vs 87.5 · Llama 60.6 vs 82.4 · Gemma 67.8 vs 79.8 · Qwen 68.9 vs 86.0. GMMLU-Choice: PL 68.9/55.2/75.1/71.6 vs EN 77.3/76.6/83.3/84.3. N(PL) = 3,594 MKQA, 1,462 GMMLU. | 4/5 (parallel questions, large N; small models only) |
| **CUS-QA**, Libovický et al., [arXiv 2507.22752v3](https://arxiv.org/abs/2507.22752) (Feb 2026), Tables 11, 17 | GPT-5, Llama 3.3 70B | Regional-knowledge QA, LLM-judge accuracy. **GPT-5 closed-book:** CS 83.1 vs EN 80.7 · SK 73.3 vs 70.2 · UK 73.2 vs 72.2. **Llama 3.3 70B closed-book:** CS 60.0 vs 63.1 · SK 47.7 vs 48.3 · UK 52.2 vs 54.9. **Llama + RAG (dev):** CS 65.9 vs 59.8 · SK 76.9 vs 73.4 · UK 58.7 vs 51.2. N = 370–550 per language/split. | 3/5. The questions concern local knowledge, which favours the native language. |
| **Linguistic Nepotism**, [arXiv 2509.13930v2](https://arxiv.org/abs/2509.13930), Table 1 | Qwen-3 14B, Llama-3.3 70B, Gemma-3 27B | RAG citation accuracy EN vs RU: 83.0 vs 74.8 · 85.9 vs 74.5 · 86.2 vs 77.1. No Polish. | 3/5 (preprint) |
| **All Languages Matter (LAURA)**, [arXiv 2604.20199](https://arxiv.org/abs/2604.20199) | BGE reranker + LLMs | Over 70% of top-5 retrieved documents come from English or the query language (13 languages, incl. Russian; no Polish) | 3/5 |
| **DELTA**, [arXiv 2601.02956](https://arxiv.org/abs/2601.02956) | — | English has gold evidence for 73.29% of questions; other languages have far less coverage. This is a corpus imbalance that favours English in multilingual RAG. | 3/5 |

**Conclusion:** no new study shows Polish beating English on retrieval. With parallel questions and the gold passage supplied, small open models lose 8–22 points in Polish. Frontier models (GPT-5 on CUS-QA) are near parity, and native language helps when the knowledge itself is local.

---

## 3. Newer evidence: reasoning, logic, knowledge

| Source | Models | Result | Quality |
|---|---|---|---|
| **mmPISA-bench**, Sapenov & Savelka, [arXiv 2606.07069](https://arxiv.org/abs/2606.07069) (5 Jun 2026), Table 1 | GPT-5.1, Claude Opus 4.5 (+ Haiku 4.5 for "no reasoning") | 25 PISA items × 5 runs, 43 languages. **PL vs EN:** Haiku 4.5 87.2 vs 90.4 · Opus 4.5 high 94.4 vs 100.0 · GPT-5.1 none 78.4 vs 76.8 · GPT-5.1 high 96.0 vs 96.8. Other Slavic languages at high effort: 94.4–99.2. | 2/5. Only 25 unique items (1 item ≈ 0.8 pt). PISA items are public, so contamination is likely. Preprint. |
| **MMLU-ProX**, [arXiv 2503.10497](https://arxiv.org/abs/2503.10497), Table 3 (cross-checked by two agents) | DeepSeek-R1, Qwen3-235B, GPT-4.1 | EN / CS / RU / UK / SR. **DeepSeek-R1:** 79.5 / 76.8 / 76.4 / 76.8 / 80.9. **Qwen3-235B-Thinking:** 80.7 / 80.5 / 77.0 / 78.8 / 80.2. **GPT-4.1:** 79.8 / 77.5 / 71.2 / 76.4 / 76.9. No Polish or Slovak. | 4/5 (parallel translation, large N) |
| **PolyMath**, [arXiv 2504.18428v4](https://arxiv.org/abs/2504.18428) (NeurIPS 2025 D&B), Table 5a, top difficulty | Qwen3-235B-Thinking, Gemini 2.5 Pro, DeepSeek-R1 | EN vs RU: 40.0 vs 38.4 · 39.2 vs 38.4 · 35.2 vs 37.6. 125 problems per level per language, no Polish. | 4/5 |
| **Grzybowski et al.**, Polish–English medical knowledge transfer, [arXiv 2412.00559v2](https://arxiv.org/abs/2412.00559) (Sep 2025), Table 4 | 15–16 models | LEK exam PL vs EN: **GPT-4o 89.96 vs 88.69** · Bielik-11B-v2.2 62.36 vs 56.98 · Meditron3-70B 68.37 vs 66.75 · **Llama-3.1-8B 51.25 vs 64.69** · **Qwen2.5-7B 51.92 vs 67.73**. LEK 4,312 questions, LDEK 4,309. | 3/5 (official translations, large N; older models; preprint) |
| **Rosoł et al.**, Sci Rep 2023 ([PMC10665355](https://pmc.ncbi.nlm.nih.gov/articles/PMC10665355/)) | GPT-4, GPT-3.5 | LEK: GPT-4 79.7% PL = 79.7% EN; GPT-3.5 54.8% vs 60.3%. N = 585 per language. | 4/5 (peer-reviewed; old models) |

### Does the language of reasoning matter?

| Source | Setup | Result |
|---|---|---|
| **Tam et al., "Language Matters"**, [arXiv 2505.17407](https://arxiv.org/abs/2505.17407), Table 1 | MATH-500; reasoning trace prefilled in English vs in the target language; average of 4 open reasoning models (R1-Distill-Llama-8B, R1-Distill-Qwen-14B, QwQ-32B, Qwen3-30B-A3B) | English thinking vs target-language thinking: **RU 86.7 vs 81.6** · ES 88.0 vs 72.5 · JA 84.9 vs 66.3 · SW 57.4 vs 25.9 |
| **PolyMath** Table 7 (QwQ-32B) | Language-control instruction | No control 45.9 · "reason in the question's language" 43.4 · "reason in English" **47.9** |
| **Shi et al.**, MGSM, [arXiv 2210.03057](https://arxiv.org/abs/2210.03057) (ICLR 2023) | English CoT vs native CoT, PaLM-540B | 51.3 vs 48.1 |
| **Kang et al.**, [arXiv 2510.27269](https://arxiv.org/abs/2510.27269) (2026) | Qwen3-4B | Reasoning traces are consistently English-dominant. Gaps come mostly from *understanding* the non-English question. |

### Agents and tool use

No benchmark measures agent or tool-use performance in Polish or any Slavic language. The closest is **"Lost in Execution"** ([arXiv 2601.05366](https://arxiv.org/abs/2601.05366), Jan 2026: GPT-5, DeepSeek V3.2, Qwen3 on BFCL v4 in EN/ZH/HI/Igbo). Its dominant failure is **parameter values written in the user's language** where the tool expects English or canonical values. Translating the queries fully increased errors, and no mitigation fully recovered English-level accuracy. Its numbers are only in figures, so none are quoted here.

### Mechanism (why English tends to win)

- **Latent "English-ish" concept space:** Wendler et al. ([arXiv 2402.10588](https://arxiv.org/abs/2402.10588), ACL 2024) and Wu et al. ("semantic hub", [arXiv 2411.04986](https://arxiv.org/abs/2411.04986), ICLR 2025). Anthropic's circuit-tracing work (2025) finds shared language-independent features, with English as the default output.
- **Training-data share and tokenization** (next section).

**Conclusion on reasoning:** language matters. For frontier models in 2025–2026 the English vs Slavic gap is about 0–6 points and often within noise. For small and mid-size open models it is about 8–22 points. Making the model *reason* in a non-English language consistently costs accuracy. **No reasoning or agent benchmark shows Polish outperforming English.**

---

## 4. Cost: tokenization

Bielik v3 technical report ([arXiv 2604.10799](https://arxiv.org/abs/2604.10799), Apr 2026), Table 1: tokens for the Polish Constitution preamble and its English translation (**one text only**).

| Tokenizer | PL tokens | EN tokens | PL/EN |
|---|---|---|---|
| Bielik 11B v3 (original, Mistral-based) | 747 | 408 | 1.83× |
| Llama 3.2 / SmolLM3 | 653 | 371 | 1.76× |
| Qwen3 | 625 | 373 | 1.68× |
| Apertus / Mistral Small 3.1 | 547 | 377 | 1.45× |
| Gemma 3 | 510 | 383 | 1.33× |
| EuroLLM | 437 | 404 | 1.08× |
| Bielik APT4 (Polish-optimised) | 375 | 631 | 0.59× |

No primary source with Polish numbers was found for OpenAI o200k or Claude tokenizers. Petrov et al. ([NeurIPS 2023](https://arxiv.org/abs/2305.15425)) report tokenization length differences of up to 15× between languages.

---

## 5. What this means for working with Claude Code and other agents

1. **Write CLAUDE.md, AGENTS.md, skills, subagent prompts and tool descriptions in English.** They cost fewer tokens, and the evidence points to equal or better adherence.
2. **Let the model reason in its default language.** Do not force Polish chain-of-thought.
3. **Tell the agent the output language explicitly** ("Reply in Polish", "UI copy in Polish"). This is what this repo's AGENTS.md already does.
4. **Keep domain data in its original language.** Polish legal and medical text should stay Polish, since native language helps for local knowledge (CUS-QA, Bielik on LEK). Keep tool parameter values canonical (English enums, ISO codes) to avoid the "Lost in Execution" failure.
5. **Treat single-benchmark headlines with suspicion.** Check N, confidence intervals, the setting, and the model vintage.

---

## 6. Evidence gaps and unverified items

- OneRuler per-language values for RU/UK/CS/SR (heatmap only). Extracting them requires downloading the PDF, which was not done without user consent.
- No Polish long-context generative benchmark and no Polish agent or tool-use benchmark exists (as of Nov 2026).
- Global-MMLU and INCLUDE include Polish, but no per-model PL vs EN table was found. The Qwen3 tech report lists Polish in MT-AIME24/INCLUDE coverage, but those rows were not reached.
- The PLCC leaderboard (2026) shows the newest models at 95–97% on Polish cultural questions, but it has no English arm and the values were only partly read. **UNVERIFIED.**
- Trojsten (EMNLP 2025, Slovak): accuracy drops on English translations according to the abstract. Per-model numbers are unverified.
- Known inconsistencies inside sources (MMLU-ProX R1 average 75.5 vs 75.2; Tam et al. Table 1 vs Table 11 Spanish; CUS-QA Table 10 vs 15) are minor and do not change the conclusions.

## 7. Method

- **Search agents:** A1 source audit, A2 long-context/RAG, A3 reasoning/agents, A3b Polish in reasoning benchmarks, A4 Polish sources (searched in Polish), A5 other Slavic languages (searched in CS/SK/UK/RU/HR/SR/BG/SL).
- **Verification agents:** V1 OneRuler, A2b RAG cells, V4 Polish sources, V5 mmPISA/CUS-QA, plus a coordinator check of the COLM venue. Every number in this report was confirmed by a second agent reading the primary HTML/table, except where marked.
- **Search volume:** each search agent ran 11–18 query iterations, in English and the national languages, before concluding.
- **Corrections made during verification:**
  - CulturALL does not include Polish, so it was removed.
  - The MKQA "out-language beats in-language" claim was reversed.
  - The mmPISA "none" column is Haiku 4.5, not Opus.
  - The OneRuler 88% figure covers only 64K+128K.
  - The OneRuler multilingual average covers 6 models, not 7: DeepSeek-R1 ran in English only. The one-model contribution was recalculated from 25 / 7 ≈ 3.6 to 25 / 6 ≈ 4.2 points (found in PR review, 2026-11-25).
- **Limitations:** numbers were extracted from arXiv HTML through an LLM-based fetch, not from raw PDFs. Spot-check cells before citing in publications.
