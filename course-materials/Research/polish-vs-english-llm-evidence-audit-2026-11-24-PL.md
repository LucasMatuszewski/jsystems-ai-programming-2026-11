# Czy polski to najlepszy język dla LLM? Audyt dowodów (2025–2026)

Data: 2026-11-24 · Metoda: 6 agentów wyszukujących i 5 agentów weryfikujących (Claude Haiku). Koordynację i kontrolę jakości prowadził Claude Opus. Wersja angielska: [polish-vs-english-llm-evidence-audit-2026-11-24-EN.md](polish-vs-english-llm-evidence-audit-2026-11-24-EN.md)

## W skrócie

1. Artykuł na cryps.pl („nasz język zdeklasował angielski w najnowszym rankingu”, 25.10.2025) opiera się na jednej publikacji: **OneRuler** (Kim, Russell, Karpinska, Iyyer; UMD, Microsoft, UMass Amherst; COLM 2025; [arXiv 2503.01996](https://arxiv.org/abs/2503.01996)).
2. Publikacja rzeczywiście podaje, że **polski jest 1. z 26 języków (88%), a angielski 6. (83,9%)**. Wynik dotyczy jednak **syntetycznego zadania „igła w stogu siana”**. To średnia z **6 modeli z początku 2025 r., które mają wyniki wielojęzyczne** (autorzy testowali 7, ale DeepSeek-R1 tylko po angielsku), liczona **tylko dla kontekstów 64K i 128K**. Badanie nie mierzyło ani „wyszukiwania informacji” ogólnie, ani RAG, ani jakości promptowania.
3. Współautorka, Marzena Karpińska, powiedziała, że różnica PL–EN **nie była istotna statystycznie**. Jej zdaniem badanie **nie pozwala stwierdzić, że polski jest najlepszy do promptowania**. Zwróciła też uwagę, że każdy język miał **inną książkę** jako „stóg siana” ([Science in Poland, 27.11.2025](https://scienceinpoland.pl/en/news/news,110407)).
4. **Żadne badanie z lat 2025–2026 nie powtórzyło wyniku „polski > angielski”.** Tam, gdzie te same pytania zadano po polsku i po angielsku, zwykle wygrywa angielski:
   - wielojęzyczny RAG (MKQA, 4 otwarte modele): polski **o 8–22 pkt niżej**;
   - egzaminy medyczne: angielski wyżej w małych modelach, w GPT-4o mniej więcej remis;
   - zadania typu PISA na GPT-5.1 i Claude Opus 4.5: polski **o 0,8–5,6 pkt niżej**, z wyjątkiem jednego ustawienia, w którym jest o 1,6 pkt wyżej.
5. **Język wpływa na rozumowanie, ale w modelach czołowych efekt jest mały, a w małych modelach duży.** Wymuszenie *rozumowania* w języku innym niż angielski obniża trafność. Na MATH-500 spadek wynosi: rosyjski −5 pkt, hiszpański −15, japoński −19, suahili −32. W najnowszych modelach czołowych różnica EN vs języki słowiańskie to **0–6 pkt**, często w granicach szumu.
6. Polski jest droższy: ten sam tekst zajmuje **1,3–1,8× więcej tokenów** niż po angielsku w popularnych tokenizerach.

**Wniosek praktyczny dla pracy z agentami:** prompty systemowe, instrukcje dla agentów i opisy narzędzi pisz po angielsku i pozwól modelowi rozumować po angielsku. Treści dla użytkownika i dane domenowe zostaw po polsku, jeśli zadanie wymaga polskiej wiedzy.

---

## 1. Audyt źródła: co naprawdę zmierzył OneRuler

| Element | Ustalenie | Status |
|---|---|---|
| Publikacja | „One ruler to measure them all: Benchmarking multilingual long-context language models”, Kim, Russell, Karpinska, Iyyer | Zweryfikowane (arXiv v1 3.03.2025, v2 8.08.2025, v3 30.09.2025) |
| Konferencja | COLM 2025 (nagłówek PDF: „Published as a conference paper at COLM 2025”) | Zweryfikowane w nagłówku PDF; nie znaleziono strony OpenReview |
| Afiliacje | University of Maryland, Microsoft, UMass Amherst | Zweryfikowane w nagłówku HTML |
| Zadania | 7 syntetycznych zadań na bazie RULER: warianty NIAH (pojedyncza igła, wiele kluczy, wiele wartości, wiele zapytań, wariant „brak igły”) oraz ekstrakcja najczęstszych słów (agregacja) | Zweryfikowane |
| Języki | 26 | Zweryfikowane |
| Modele | 7: Gemini 1.5 Flash, o3-mini-high, DeepSeek-R1, Llama 3.3 70B, Llama 3.1 8B, Qwen2.5-72B, Qwen2.5-7B (Tabela 5, Dodatek B.1). DeepSeek-R1 testowano tylko po angielsku (rozdz. 3, przypis 11), więc wyniki w pozostałych 25 językach ma 6 modeli. | Zweryfikowane |
| Długości kontekstu | 8K, 32K, 64K, 128K | Zweryfikowane |
| Liczebność próby | 50 przykładów na zadanie × język × długość | Zweryfikowane |
| Tekst-wypełniacz | Inna książka z domeny publicznej dla każdego języka (PL: *Noce i dnie*, EN: *Little Women*) | Zweryfikowane |
| Statystyka | Brak przedziałów ufności i testów istotności dla różnic między językami. Jedyna statystyka to tau Kendalla = 0,82, a dotyczy ona rankingu modeli. | Zweryfikowane |

### Kluczowe liczby (rozdz. 3.1)

| Ustawienie | Polski | Angielski | Inne |
|---|---|---|---|
| Średnia NIAH z 6 modeli wielojęzycznych, **64K + 128K** (praca pisze „all models”, nie wymieniając ich) | **88%** (1. miejsce) | **83,9%** (6. z 26) | chiński 62,1% (4. od końca) |
| o3-mini-high, tylko 128K | 92% | 67% | ukraiński 89% |
| Wpływ instrukcji „odpowiedz none, jeśli brak”, EN, 128K | — | trafność S-NIAH spada o 32% | — |

Rosyjski, czeski, ukraiński i serbski są w czołówce, ale ich dokładne średnie są tylko na mapach ciepła (rys. 4 i 25). Bez pobrania PDF nie dało się ich odczytać, więc **ich nie cytujemy**.

### Co artykuł przekręcił lub wyolbrzymił

| Teza artykułu | Publikacja | Ocena |
|---|---|---|
| Polski jest najlepszym językiem dla AI / do promptowania | Badano wyszukiwanie w długim kontekście na zadaniach syntetycznych, a nie promptowanie. Współautorka zaprzecza takiej interpretacji. | **Wyolbrzymione** |
| Polski pokonał angielski | 88% vs 83,9%, czyli 4,1 pkt różnicy. Brak testu istotności; według współautorki różnica nie była istotna. | **Wyolbrzymione** |
| Polski wygrał mimo małej ilości danych treningowych | Tego nie ma w publikacji. Polski nie należy w niej do języków niskozasobowych. | **Bez pokrycia** |
| Wynik dotyczy „najnowszych modeli” | 7 modeli z początku 2025 r., w tym 6 testowanych poza angielskim. Żaden nie jest modelem obecnej generacji (stan na XI 2026). | **Nieaktualne** |

### Dlaczego polski mógł wygrać: trzy czynniki zakłócające

1. **Każdy język miał inną książkę jako wypełniacz.** Trudność tekstu nie była kontrolowana. Współautorka sama wskazała ten czynnik.
2. **Jeden model może przesunąć średnią.** o3-mini-high uzyskał 67% po angielsku wobec 92% po polsku przy 128K. Autorzy piszą, że ten model często błędnie odpowiadał „none”. *To nasz rachunek, nie teza autorów:* 25 pkt różnicy w jednym z sześciu modeli z wynikami po polsku daje około 4,2 pkt (25 / 6) w średniej z sześciu modeli dla tej długości. To tyle, ile cała różnica 4,1 pkt z nagłówka.
3. **Małe komórki.** Przy 50 przykładach 95-procentowy przedział ufności wokół 85% to około ±10 pkt na komórkę. Interaktywny artefakt zawiera kalkulator, który to pokazuje.

Autorzy **nie podają przyczyny** pierwszego miejsca polskiego. Stawiają jedynie hipotezę, że różnice wynikają z „dostępności danych pretreningowych, pisma, rodziny językowej i tokenizera”.

**Ocena jakości danych:** projekt benchmarku 3/5; teza „polski najlepszy” 1–2/5.

---

## 2. Nowsze dowody: wyszukiwanie i RAG

| Źródło | Modele | Polski/słowiańskie vs angielski | Jakość |
|---|---|---|---|
| **On the Consistency of Multilingual Context Utilization**, [arXiv 2504.00597v4](https://arxiv.org/abs/2504.00597) (XI 2025), tab. 15 i 18 | Aya-Expanse-8B, Llama-3.2-3B, Gemma-2-9B, Qwen2.5-7B | MKQA z jednym poprawnym fragmentem w języku pytania. **PL vs EN:** Aya 79,2 vs 87,5 · Llama 60,6 vs 82,4 · Gemma 67,8 vs 79,8 · Qwen 68,9 vs 86,0. GMMLU-Choice: PL 68,9/55,2/75,1/71,6 vs EN 77,3/76,6/83,3/84,3. N(PL): 3594 dla MKQA, 1462 dla GMMLU. | 4/5 (pytania równoległe, duże N; tylko małe modele) |
| **CUS-QA**, Libovický i in., [arXiv 2507.22752v3](https://arxiv.org/abs/2507.22752) (II 2026), tab. 11 i 17 | GPT-5, Llama 3.3 70B | Pytania o wiedzę regionalną, trafność oceniana przez LLM. **GPT-5 bez RAG:** CS 83,1 vs EN 80,7 · SK 73,3 vs 70,2 · UK 73,2 vs 72,2. **Llama 3.3 70B bez RAG:** CS 60,0 vs 63,1 · SK 47,7 vs 48,3 · UK 52,2 vs 54,9. **Llama z RAG (zbiór dev):** CS 65,9 vs 59,8 · SK 76,9 vs 73,4 · UK 58,7 vs 51,2. N: 370–550 na język i podzbiór. | 3/5. Pytania dotyczą lokalnej wiedzy, co faworyzuje język natywny. |
| **Linguistic Nepotism**, [arXiv 2509.13930v2](https://arxiv.org/abs/2509.13930), tab. 1 | Qwen-3 14B, Llama-3.3 70B, Gemma-3 27B | Trafność cytowań w RAG, EN vs RU: 83,0 vs 74,8 · 85,9 vs 74,5 · 86,2 vs 77,1. Brak polskiego. | 3/5 (preprint) |
| **All Languages Matter (LAURA)**, [arXiv 2604.20199](https://arxiv.org/abs/2604.20199) | reranker BGE i LLM | Ponad 70% z 5 najwyżej ocenionych dokumentów pochodzi z angielskiego lub z języka zapytania (13 języków, w tym rosyjski; bez polskiego) | 3/5 |
| **DELTA**, [arXiv 2601.02956](https://arxiv.org/abs/2601.02956) | — | Angielski ma poprawne dowody dla 73,29% pytań, inne języki dla znacznie mniejszej części. Ta nierównowaga korpusu sprzyja angielskiemu w RAG. | 3/5 |

**Wniosek:** żadne nowe badanie nie pokazuje przewagi polskiego nad angielskim w wyszukiwaniu. Przy równoległych pytaniach i podanym poprawnym fragmencie małe otwarte modele tracą po polsku 8–22 pkt. Modele czołowe (GPT-5 w CUS-QA) są blisko parytetu, a język natywny pomaga, gdy pytanie dotyczy lokalnej wiedzy.

---

## 3. Nowsze dowody: rozumowanie, logika, wiedza

| Źródło | Modele | Wynik | Jakość |
|---|---|---|---|
| **mmPISA-bench**, Sapenov i Savelka, [arXiv 2606.07069](https://arxiv.org/abs/2606.07069) (5.06.2026), tab. 1 | GPT-5.1, Claude Opus 4.5 (Haiku 4.5 w wariancie bez rozumowania) | 25 zadań PISA × 5 powtórzeń, 43 języki. **PL vs EN:** Haiku 4.5 87,2 vs 90,4 · Opus 4.5 high 94,4 vs 100,0 · GPT-5.1 none 78,4 vs 76,8 · GPT-5.1 high 96,0 vs 96,8. Inne języki słowiańskie przy high: 94,4–99,2. | 2/5. Tylko 25 unikalnych zadań (1 zadanie ≈ 0,8 pkt). Zadania PISA są publiczne, więc model mógł je widzieć w treningu. Preprint. |
| **MMLU-ProX**, [arXiv 2503.10497](https://arxiv.org/abs/2503.10497), tab. 3 (potwierdzone przez dwóch agentów) | DeepSeek-R1, Qwen3-235B, GPT-4.1 | EN / CS / RU / UK / SR. **DeepSeek-R1:** 79,5 / 76,8 / 76,4 / 76,8 / 80,9. **Qwen3-235B-Thinking:** 80,7 / 80,5 / 77,0 / 78,8 / 80,2. **GPT-4.1:** 79,8 / 77,5 / 71,2 / 76,4 / 76,9. Brak polskiego i słowackiego. | 4/5 (tłumaczenie równoległe, duże N) |
| **PolyMath**, [arXiv 2504.18428v4](https://arxiv.org/abs/2504.18428) (NeurIPS 2025 D&B), tab. 5a, najwyższy poziom trudności | Qwen3-235B-Thinking, Gemini 2.5 Pro, DeepSeek-R1 | EN vs RU: 40,0 vs 38,4 · 39,2 vs 38,4 · 35,2 vs 37,6. 125 zadań na poziom i język, bez polskiego. | 4/5 |
| **Grzybowski i in.**, Polish–English medical knowledge transfer, [arXiv 2412.00559v2](https://arxiv.org/abs/2412.00559) (IX 2025), tab. 4 | 15–16 modeli | LEK, PL vs EN: **GPT-4o 89,96 vs 88,69** · Bielik-11B-v2.2 62,36 vs 56,98 · Meditron3-70B 68,37 vs 66,75 · **Llama-3.1-8B 51,25 vs 64,69** · **Qwen2.5-7B 51,92 vs 67,73**. LEK: 4312 pytań, LDEK: 4309. | 3/5 (oficjalne tłumaczenia, duże N; starsze modele; preprint) |
| **Rosoł i in.**, Sci Rep 2023 ([PMC10665355](https://pmc.ncbi.nlm.nih.gov/articles/PMC10665355/)) | GPT-4, GPT-3.5 | LEK: GPT-4 79,7% PL = 79,7% EN; GPT-3.5 54,8% vs 60,3%. N = 585 na język. | 4/5 (recenzowane; stare modele) |

### Czy język rozumowania ma znaczenie?

| Źródło | Ustawienie | Wynik |
|---|---|---|
| **Tam i in., „Language Matters”**, [arXiv 2505.17407](https://arxiv.org/abs/2505.17407), tab. 1 | MATH-500. Początek toku rozumowania wymuszony po angielsku albo w języku docelowym. Średnia z 4 otwartych modeli rozumujących (R1-Distill-Llama-8B, R1-Distill-Qwen-14B, QwQ-32B, Qwen3-30B-A3B). | Myślenie po angielsku vs w języku docelowym: **RU 86,7 vs 81,6** · ES 88,0 vs 72,5 · JA 84,9 vs 66,3 · SW 57,4 vs 25,9 |
| **PolyMath**, tab. 7 (QwQ-32B) | Instrukcja sterująca językiem | Bez sterowania 45,9 · „rozumuj w języku pytania” 43,4 · „rozumuj po angielsku” **47,9** |
| **Shi i in.**, MGSM, [arXiv 2210.03057](https://arxiv.org/abs/2210.03057) (ICLR 2023) | CoT po angielsku vs w języku natywnym, PaLM-540B | 51,3 vs 48,1 |
| **Kang i in.**, [arXiv 2510.27269](https://arxiv.org/abs/2510.27269) (2026) | Qwen3-4B | Tok rozumowania jest konsekwentnie zdominowany przez angielski. Luka wynika głównie z *rozumienia* pytania w innym języku. |

### Agenci i wywoływanie narzędzi

Nie ma benchmarku agentowego ani benchmarku wywoływania narzędzi dla polskiego ani żadnego innego języka słowiańskiego. Najbliższe jest badanie **„Lost in Execution”** ([arXiv 2601.05366](https://arxiv.org/abs/2601.05366), I 2026). Testuje GPT-5, DeepSeek V3.2 i Qwen3 na BFCL v4 w językach EN/ZH/HI/igbo. Główny błąd polega na tym, że **wartości parametrów są podawane w języku użytkownika**, choć narzędzie oczekuje angielskich lub kanonicznych wartości. Pełne tłumaczenie zapytań zwiększało liczbę błędów, a żadna mitygacja nie przywróciła w pełni poziomu angielskiego. Liczby są tylko na wykresach, więc ich nie cytujemy.

### Mechanizm: dlaczego angielski zwykle wygrywa

- **Wewnętrzna przestrzeń pojęć zbliżona do angielskiego:** Wendler i in. ([arXiv 2402.10588](https://arxiv.org/abs/2402.10588), ACL 2024) oraz Wu i in. („semantic hub”, [arXiv 2411.04986](https://arxiv.org/abs/2411.04986), ICLR 2025). Prace Anthropic o śledzeniu obwodów (2025) pokazują wspólne cechy niezależne od języka, z angielskim jako domyślnym językiem wyjścia.
- **Udział języka w danych treningowych i tokenizacja** (następna sekcja).

**Wniosek dotyczący rozumowania:** język ma znaczenie. W modelach czołowych z lat 2025–2026 różnica EN vs języki słowiańskie wynosi około 0–6 pkt i często mieści się w szumie. W małych i średnich modelach otwartych to około 8–22 pkt. Wymuszanie *rozumowania* w języku innym niż angielski konsekwentnie obniża trafność. **Żaden benchmark rozumowania ani agentowy nie pokazuje przewagi polskiego nad angielskim.**

---

## 4. Koszt: tokenizacja

Raport techniczny Bielik v3 ([arXiv 2604.10799](https://arxiv.org/abs/2604.10799), IV 2026), tab. 1: liczba tokenów dla preambuły Konstytucji RP i jej angielskiego tłumaczenia (**pomiar na jednym tekście**).

| Tokenizer | Tokeny PL | Tokeny EN | PL/EN |
|---|---|---|---|
| Bielik 11B v3 (oryginalny, oparty na Mistralu) | 747 | 408 | 1,83× |
| Llama 3.2 / SmolLM3 | 653 | 371 | 1,76× |
| Qwen3 | 625 | 373 | 1,68× |
| Apertus / Mistral Small 3.1 | 547 | 377 | 1,45× |
| Gemma 3 | 510 | 383 | 1,33× |
| EuroLLM | 437 | 404 | 1,08× |
| Bielik APT4 (zoptymalizowany pod polski) | 375 | 631 | 0,59× |

Nie znaleziono źródła pierwotnego z danymi dla polskiego w tokenizerach OpenAI o200k ani Claude. Petrov i in. ([NeurIPS 2023](https://arxiv.org/abs/2305.15425)) raportują, że długość tekstu po tokenizacji może się różnić między językami nawet 15-krotnie.

---

## 5. Co to oznacza dla pracy z Claude Code i innymi agentami

1. **CLAUDE.md, AGENTS.md, skille, prompty subagentów i opisy narzędzi pisz po angielsku.** Kosztują mniej tokenów, a dane wskazują na równe lub lepsze przestrzeganie instrukcji.
2. **Nie wymuszaj rozumowania po polsku.** Pozwól modelowi myśleć w domyślnym języku.
3. **Wprost określ język odpowiedzi**, np. „Odpowiadaj po polsku”, „teksty UI po polsku”. Tak robi już AGENTS.md w tym repozytorium.
4. **Dane domenowe zostaw w oryginale.** Polskie teksty prawne i medyczne niech zostaną po polsku, bo język natywny pomaga przy lokalnej wiedzy (CUS-QA, Bielik na LEK). Wartości parametrów narzędzi utrzymuj w formie kanonicznej (angielskie enumy, kody ISO), żeby uniknąć błędu opisanego w „Lost in Execution”.
5. **Nie ufaj nagłówkom opartym na jednym benchmarku.** Sprawdzaj N, przedziały ufności, ustawienia badania i datę modeli.

---

## 6. Luki i elementy niezweryfikowane

- Wartości OneRuler dla RU/UK/CS/SR są tylko na mapach ciepła. Odczytanie ich wymaga pobrania PDF, czego nie zrobiono bez zgody użytkownika.
- Nie ma polskiego benchmarku generatywnego dla długiego kontekstu ani polskiego benchmarku agentowego (stan na XI 2026).
- Global-MMLU i INCLUDE zawierają polski, ale nie znaleziono tabeli PL vs EN dla poszczególnych modeli. Raport Qwen3 wymienia polski w zakresie MT-AIME24/INCLUDE, ale nie udało się dotrzeć do tych wierszy.
- Ranking PLCC (2026) pokazuje 95–97% dla najnowszych modeli w pytaniach o polską kulturę, ale nie ma wersji angielskiej, a wartości odczytano tylko częściowo. **NIEZWERYFIKOWANE.**
- Trojsten (EMNLP 2025, słowacki): według abstraktu trafność spada na angielskich tłumaczeniach. Liczby dla poszczególnych modeli nie są zweryfikowane.
- Drobne niespójności wewnątrz źródeł (średnia R1 w MMLU-ProX 75,5 vs 75,2; Tam i in. tab. 1 vs tab. 11 dla hiszpańskiego; CUS-QA tab. 10 vs 15) nie zmieniają wniosków.

## 7. Metoda

- **Agenci wyszukujący:**
  - A1: audyt źródła;
  - A2: długi kontekst i RAG;
  - A3: rozumowanie i agenci;
  - A3b: polski w benchmarkach rozumowania;
  - A4: polskie źródła (wyszukiwanie po polsku);
  - A5: inne języki słowiańskie (wyszukiwanie po czesku, słowacku, ukraińsku, rosyjsku, chorwacku, serbsku, bułgarsku i słoweńsku).
- **Agenci weryfikujący:**
  - V1: OneRuler;
  - A2b: komórki tabel RAG;
  - V4: polskie źródła;
  - V5: mmPISA i CUS-QA.

  Dodatkowo koordynator sprawdził, czy publikacja ukazała się na COLM. Każdą liczbę w raporcie potwierdził drugi agent na podstawie HTML lub tabeli źródła pierwotnego, chyba że zaznaczono inaczej.
- **Liczba iteracji:** każdy agent wyszukujący wykonał 11–18 iteracji zapytań, po angielsku i w językach narodowych, zanim sformułował wnioski.
- **Korekty wprowadzone podczas weryfikacji:**
  - CulturALL nie zawiera polskiego, więc źródło zostało usunięte;
  - teza o MKQA („fragment w innym języku wygrywa”) okazała się odwrotna;
  - kolumna „none” w mmPISA dotyczy Haiku 4.5, a nie Opusa;
  - 88% w OneRuler dotyczy tylko kontekstów 64K i 128K;
  - średnia wielojęzyczna w OneRuler obejmuje 6 modeli, nie 7, bo DeepSeek-R1 testowano tylko po angielsku. Wkład jednego modelu przeliczono z 25 / 7 ≈ 3,6 na 25 / 6 ≈ 4,2 pkt (znalezione w przeglądzie PR, 2026-11-25).
- **Ograniczenia:** liczby wyodrębniono z HTML arXiv za pomocą narzędzia opartego na LLM, a nie z surowych plików PDF. Przed cytowaniem w publikacjach sprawdź wybrane komórki ręcznie.
