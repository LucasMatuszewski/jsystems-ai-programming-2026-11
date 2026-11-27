# Podsumowanie — dzień 5, 27 listopada 2026

Ostatni dzień pięciodniowego szkolenia JSystems „AI dla programistów - od pomysłu do MVP” poprowadził zdalnie Łukasz Matuszewski. Głównym narzędziem był Claude Code; omawiano też Codex CLI, GitHub Copilot i OpenCode jako alternatywy. Po wcześniejszej pracy nad PoC „Hardware Service Decision Copilot” z użyciem `/goal`, grupa zajęła się przeglądem kodu, automatyzacją CI, konfiguracją agentów i bezpieczeństwem, a następnie sposobami pracy ze starszym kodem na przykładzie projektu jFTP.

## Start dnia: gotowe aplikacje

Rano kilka osób potwierdziło, że agenci dokończyli aplikację w nocy i działa; uczestnicy pokazali zrzuty ekranu swoich formularzy zgłoszeń serwisowych. `/goal` może wznowić pracę po resecie 5-godzinnego limitu użycia: pomaga monitor, który co 5 godzin i 30 minut wznawia pracę agenta. Gdy cel czeka już tylko na scalenie PR-ów, można go usunąć poleceniem `/goal clear`. Działającą aplikację agent może też sprawdzić sam: uruchomić serwer deweloperski i otworzyć stronę we wbudowanej przeglądarce Claude.

## Przegląd kodu i automatyzacja CI

Przykładem automatycznego przeglądu pull requestów był open-source'owy PR-Agent (`The-PR-Agent/pr-agent`), który działa na dowolnej platformie Git, tu uruchamiany w GitHub Actions. Ćwiczenie polegało na przerobieniu workflow tak, aby korzystał z endpointu OpenRouter i modelu `openai/gpt-6-luna` (jako mocniejszy model pojawił się `openai/gpt-6.2-sol`), z tym samym kluczem API co w `.env`, zapisanym w sekretach repozytorium. Agent prowadził przez konfigurację po stronie GitHub: sekret `OPENROUTER_API_KEY`, ustawienie `PR_AGENT_MAX_TOKENS` oraz uprawnienie **Workflows** w fine-grained PAT, bez którego agent nie może wypchnąć zmian w plikach workflow. Efektem jest [PR #49](https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/pull/49) z workflow PR-Agent dla OpenRouter i workflow Claude Code headless.

Agent dostał też zadanie dodania workflow, który uruchamia testy aplikacji w CI z tym samym kluczem OpenRouter z sekretów. Gotowe przykłady CI/CD dla różnych platform i agentów znajdują się w materiałach kursowych. Wspomniano także komercyjne platformy do przeglądu kodu, Qodo i CodeRabbit, oraz Snyk do kontroli bezpieczeństwa aplikacji w CI/CD.

Poza własnymi workflow omówiono wbudowane przeglądy kodu: Claude Code Review (ogólnie dostępny), Codex Code Review w ustawieniach Codex Cloud oraz instrukcje repozytorium dla przeglądów GitHub Copilot. Dla Azure DevOps są przeglądy kodu z GitHub Copilot oraz przykłady z Azure CLI i MCP w materiałach kursu.

## Claude Code headless i ustawienia użytkownika

Tryb headless pozwala uruchamiać Claude Code z linii poleceń, m.in. przez `claude -p`, i włączać go do automatyzacji. Pokazano przykłady workflow GitHub Actions oraz użycie długotrwałego tokenu powiązanego z subskrypcją: token inicjuje się poleceniem `claude setup-token`, a w automatyzacji udostępnia jako `CLAUDE_CODE_OAUTH_TOKEN`. Wartości tokenów należy przechowywać w bezpiecznych sekretach, nigdy w kodzie repozytorium.

Ustawienia Claude Code i personalizację instrukcji użytkownika można skonfigurować w ustawieniach Claude. Instrukcje z personalizacji działają na poziomie całego konta, w chmurze i lokalnie. Pokazany przykład instrukcji globalnych dotyczył tonu, zwięzłości i preferowanego sposobu prezentowania odpowiedzi. Do oszczędzania tokenów pokazano skille Caveman (bardzo zwięzłe odpowiedzi) i Ponytail ("lazy developer").

## Hooks, uprawnienia i bezpieczeństwo

Hooks uruchamiają polecenia w określonych momentach pracy agenta, np. `PreToolUse`, `PostToolUse`, `Stop` i `PostModelSwitch`. Przykłady obejmowały hooki ochronne dla różnych agentów oraz uruchomienie osobnego agenta, który przegląda zmiany zależności w `pom.xml`. Na żywo powstał hook dla modelu Fable: Fable potrafi długo pracować bez odpowiedzi, więc hook dołącza mu instrukcje, aby najpierw odpowiedział, opisał plan, raportował postęp i używał zadań. Pierwsza wersja agenta była zbyt rozbudowana, więc ograniczono ją do zdarzenia `PostModelSwitch` z warunkiem na poziomie hooka, aby instrukcje trafiały tylko do rozmowy bezpośrednio z Fable. Wynik jest w [PR #49](https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/pull/49) (`.claude/hooks/fable-instructions.md`).

W Claude Code ustawienia `allow`, `deny` i `ask` w `settings.json` określają, które działania są dozwolone, blokowane lub wymagają potwierdzenia; tryb auto nie powinien zastępować przemyślanych ograniczeń. Szczególnie ryzykowne są szerokie reguły `allow`, takie jak `Bash(node:*)`, `Bash(python:*)` czy `Bash(python3:*)`: pozwalają uruchomić dowolny skrypt Node lub Python bez sprawdzenia przez tryb auto, więc usunięto je z ustawień repozytorium.

Codex stosuje odmienny model uprawnień i sandboxingu. Jego reguły pozwalające wychodzić poza sandbox działają inaczej niż reguły Claude Code, a Codex Auto Review omówiono jako odpowiednik trybu automatycznego. Reguły Claude mogą natomiast zawierać instrukcje specyficzne dla ścieżek. Warto dobierać mechanizm do konkretnego narzędzia, a nie przenosić ustawień między agentami bez sprawdzenia ich znaczenia.

## Praca ze starszym kodem: jFTP

Ćwiczenie z jFTP dotyczyło czternastoletniego projektu Java bez testów i dokumentacji. Celem pracy z takim repozytorium jest najpierw zbudowanie użytecznego obrazu systemu i zabezpieczenie jego istniejącego zachowania, a dopiero później planowanie refaktoryzacji.

Omawiane narzędzia i praktyki:

- **legacy-codebase-workflows** z repozytorium EdukeyTeam/agent-toolbox: skill wspierający rozpoznanie projektu; instalacja była demonstrowana poleceniem `npx --yes skills@latest add EdukeyTeam/agent-toolbox --skill '*'`.
- **Repo Map** z Aider: skrótowa mapa struktury i powiązań w repozytorium.
- **RepoMix**: pakowanie kodu do kontekstu dla agenta; ćwiczenie obejmowało wariant skompresowany i nieskompresowany, bez komentarzy.
- **Graphify**: graf kodu, który można uzupełnić opisem społeczności i przedstawić w wizualizacji HTML.
- **Lokalny Context7/RAG**: indeks semantyczny i leksykalny kodu, aby agent mógł wyszukiwać informacje lokalnie. Agent dodał serwer MCP `context7-local` dla Claude Code oraz hooki odświeżające indeks po zmianach.
- **AGENTS.md i dokumentacja architektury**: krótkie instrukcje, ewentualne zwięzłe pliki zagnieżdżone dla części repozytorium oraz diagramy UML w Mermaid.
- **Testy charakteryzacyjne (regresyjne)**: zabezpieczenie najważniejszych zachowań przed refaktoryzacją; zmiany warto zapisywać w małych, tematycznych commitach.

Do audytu instrukcji projektu wskazano `/doctor prompt-audit` w Claude Code 2.1.283 lub nowszym: sprawdza `CLAUDE.md`, `AGENTS.md`, reguły, skille i subagentów pod kątem nieaktualnych faktów i sprzeczności, a poprawki proponuje jako diffy. Skill legacy do diagramów architektury korzysta wewnętrznie z `design-doc-mermaid`.

Wynik ćwiczenia jest w gałęzi [`codebase-context`](https://github.com/LucasMatuszewski/jftp-23-11-2026/tree/codebase-context), zapisany w osobnych, małych commitach: mapa repozytorium, paczki RepoMix, graf kodu Graphify z opisanymi społecznościami i przewodnikiem po architekturze, lokalny Context7 z hookami odświeżania, `AGENTS.md` w katalogu głównym i zagnieżdżone, widoki architektury w Mermaid/UML, testy charakteryzacyjne oraz poprawki builda, dzięki którym projekt kompiluje się poza macOS, a spakowana aplikacja się uruchamia.

## Środowisko pracy i narzędzia

Wśród terminali do pracy z agentami wymieniono WezTerm, Ghostty, Windows Terminal i Rex. Przydatne mogą być także Nerd Fonts, np. JetBrains Mono, oraz `eza` jako alternatywa dla `ls` i `tree`.

Wspomniano connector Azure dostępny w katalogu Claude. Pracę wielu agentów wspierać mogą narzędzia do ich zarządzania; przykłady zebrano w materiałach kursowych.

## Projektowanie interfejsów i dodatkowe narzędzia

Wśród narzędzi do szybkiego prototypowania interfejsów wymieniono v0, Lovable, Bolt i Replit. Zwrócono uwagę, że popularne skille projektowe mogą prowadzić do podobnych, generycznych rezultatów. Warto świadomie dobierać inspiracje i komponenty: GLM na Z.ai jako alternatywne podejście do generowania projektu, shadcn/ui oraz AI Elements jako gotowe komponenty, a Behance jako źródło przykładów UI/UX.

Wśród dodatkowych tematów pojawiły się autonomiczne agenty OpenClaw i nieco prostszy Hermes Agent oraz synchronizacja plików przez Syncthing i notatki w Markdown w Obsidianie. Udostępniono także materiał Anthropic o przeprojektowaniu systemu kontroli wersji oraz materiały o bezpieczeństwie AI: opis incydentu Hugging Face od OpenAI, wywiad z Aleksandrem Mądrym i dokument „Instadocs: AI Gone Wild”. Na zakończenie wrócił slajd o tym, że AI sprzyja generalistom bardziej niż wąskim ekspertom.

## Materiały i linki

**Rezultaty ćwiczeń opublikowane przez prowadzącego:**

- Implementacja aplikacji i code review: https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/pull/46
- PR-Agent i Claude Code headless w GitHub Actions: https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/pull/49
- Wyniki ćwiczenia z jFTP: https://github.com/LucasMatuszewski/jftp-23-11-2026/tree/codebase-context

**CI/CD, agenci i bezpieczeństwo:**

- Workflow PR-Agent z OpenRouter: https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/blob/main/.github/workflows/pr-agent-openrouter-review.yml
- Workflow Claude Code headless: https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/blob/main/.github/workflows/claude-pr-review.yml
- PR-Agent: https://github.com/The-PR-Agent/pr-agent
- Przykłady CI/CD i headless: https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/tree/main/course-materials/cicd-headless
- Przykład skryptu Claude Code headless: https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/blob/main/course-materials/cicd-headless/scripts/claude_pr_review.sh
- Materiał o tokenach automatyzacyjnych: https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/blob/main/course-materials/Research/automation-tokens-mcp-news-ide-acp-2026-11-26.md#1-long-lived-automation-tokens
- Materiały headless: https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/blob/main/course-materials/Research/Headless%20agents%20-%20CLI%20automation%2C%20JSON%20streaming%2C%20subscriptions%20and%20CI-CD.md
- Hooks: https://code.claude.com/docs/en/hooks
- Uprawnienia Claude Code: https://code.claude.com/docs/en/permissions
- Uprawnienia Codex: https://learn.chatgpt.com/docs/permissions
- Reguły Codex: https://learn.chatgpt.com/docs/agent-configuration/rules
- Codex Auto Review: https://learn.chatgpt.com/docs/sandboxing/auto-review
- Qodo: https://www.qodo.ai/ ; CodeRabbit: https://www.coderabbit.ai/ ; Snyk: https://snyk.io/
- Azure DevOps z agentami: https://devpowers.com/szkolenia/jsystems/ai-programming-2026-11/pytania.html#azure-devops
- Azure CLI i MCP: https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/tree/main/course-materials/cicd-headless/azure-devops
- GitHub Copilot Code Review w Azure DevOps: https://learn.microsoft.com/en-us/azure/devops/repos/git/copilot-code-reviews?view=azure-devops
- Przykładowy connector Azure: https://claude.ai/directory/ant.dir.gh.microsoft.mcp-win-x64
- Code Review w Claude: https://claude.com/resources/articles/code-review-is-now-generally-available
- Codex Code Review: https://chatgpt.com/codex/cloud/settings/code-review
- Instrukcje repozytorium GitHub Copilot: https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions
- Claude Ship: https://claude.com/resources/articles/introducing-claude-ship

**Legacy code i narzędzia developerskie:**

- Repozytorium jFTP: https://github.com/sai-pullabhotla/jftp
- Repo Map (Aider): https://aider.chat/docs/repomap.html
- RepoMix: https://github.com/yamadashy/repomix
- Graphify: https://github.com/Graphify-Labs/graphify
- Skill legacy-codebase-workflows: https://github.com/EdukeyTeam/agent-toolbox/tree/main/skills/legacy-codebase-workflows
- Lokalny Context7: https://github.com/EdukeyTeam/agent-toolbox/tree/main/skills/legacy-codebase-workflows/assets/context7
- Private Retrieval RAG: https://github.com/EdukeyTeam/agent-toolbox/blob/main/skills/legacy-codebase-workflows/references/private-retrieval.md
- Konfiguracja local Context7: https://github.com/EdukeyTeam/agent-toolbox/blob/main/skills/legacy-codebase-workflows/references/local-context7-setup.md
- Przykłady hooks: https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/tree/main/course-materials/hooks-example
- Przykład review zmian w `pom.xml`: https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/blob/main/.claude/settings.json#L132
- `design-doc-mermaid`: https://github.com/SpillwaveSolutions/design-doc-mermaid
- Nerd Fonts: https://www.nerdfonts.com/font-downloads ; eza: https://github.com/eza-community/eza
- WezTerm: https://wezterm.org/install/windows.html#installing-on-windows ; Ghostty: https://ghostty.org/ ; Windows Terminal: https://apps.microsoft.com/detail/9n0dx20hk701
- Rex CLI: https://www.mindstudio.ai/blog/rex-terminal-mitchell-hashimoto ; https://www.superlogical.com/rex/docs/automate/cli

**Skille, projektowanie, zarządzanie wiedzą i dalsza nauka:**

- Caveman: https://github.com/JuliusBrussee/caveman/tree/main ; Ponytail: https://github.com/DietrichGebert/ponytail/tree/main
- Checklisty kursowe: https://devpowers.com/szkolenia/jsystems/ai-programming-2026-11/checklisty.html#harness
- Ankieta JSystems: https://ankiety.jsystems.pl/
- Osoby i konta do śledzenia: https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/blob/main/course-materials/Course%20INDEX%20-%20AI%20in%20Programming.md#people-and-accounts-to-follow-in-ai
- Indeks materiałów kursowych: https://devpowers.com/szkolenia/jsystems/ai-programming-2026-11/index.html
- Zarządzanie wieloma agentami: https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/blob/main/course-materials/Research/agent-managers-and-remote-agents.md
- Prezentacja o pracy generalistów: https://devpowers.com/szkolenia/jsystems/ai-programming-2026-11/Prezentacja_02_Podstawy_AI.html#11
- v0: https://v0.app/templates ; Lovable: https://lovable.dev/dashboard ; Bolt: https://bolt.new/ ; Replit: https://replit.com/
- Frontend Design: https://www.skills.sh/anthropics/skills/frontend-design
- GLM: https://z.ai/blog/glm-5.3 ; Z.ai: https://z.ai/chat ; shadcn/ui: https://ui.shadcn.com/ ; AI Elements: https://vercel.com/academy/ai-sdk/ai-elements ; Behance UI/UX: https://www.behance.net/galleries/ui-ux
- Claude Academy: https://academy.claude.com/ ; OpenClaw: https://openclaw.ai/ ; dokumentacja OpenClaw: https://docs.openclaw.ai/ ; Hermes Agent: https://hermes-agent.nousresearch.com/
- Syncthing: https://syncthing.net/ ; Obsidian: https://obsidian.md/
- Anthropic o przeprojektowaniu kontroli wersji: https://www.anthropic.com/research/redesigning-source-control
- Kanały: https://www.youtube.com/@theo ; https://www.youtube.com/@NateBJones ; https://www.youtube.com/@mattpocockuk ; https://www.youtube.com/@MateuszChrobok
- Materiał o incydencie Hugging Face i bezpieczeństwie: https://openai.com/pl-PL/index/hugging-face-incident-and-the-road-ahead/ ; wywiad Aleksandra Mądrego: https://www.youtube.com/watch?v=qaT3MXdBXDo ; dokument „Instadocs: AI Gone Wild”: https://www.netflix.com/pt-en/title/82772145
- Koszty środowisk chmurowych: https://devpowers.com/szkolenia/jsystems/ai-programming-2026-11/pytania.html#agent-w-chmurze

## Co dalej po kursie

- Przejrzeć checklisty po szkoleniu i materiały kursowe.
- Wybrać osoby i kanały do dalszego śledzenia.
- Przećwiczyć konfigurację CI/code review oraz wybrane skille i narzędzia we własnym repozytorium.
