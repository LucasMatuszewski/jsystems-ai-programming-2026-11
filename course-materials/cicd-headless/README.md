# CI/CD, Headless Mode, Jenkins, Jira, Confluence

## Claude Code headless review w GitHub Actions (27 listopada 2026)

- [github-actions/claude-pr-review.yml](github-actions/claude-pr-review.yml): ten sam workflow, który działa w tym repozytorium (`.github/workflows/claude-pr-review.yml`). Uruchamia się przy każdym pushu do PR, który nie jest draftem, oraz po komentarzu `/claude-review` w PR (osoba z uprawnieniem write; działa też na draftach).
- Diff do ok. 500 tys. tokenów (`MAX_DIFF_BYTES: 1100000`; zmierzone w tym repo: ok. 2,2 bajta na token dla JSON i lockfile'ów). Sonnet 5.5 i Opus 5.5 mają domyślnie okno 1M tokenów. Lockfile'y, logi, fixture'y testów i pliki `.min`/`.map` są pominięte (`DIFF_EXCLUDES`). Ponad budżet wchodzą tylko całe pliki, a komentarz z review wymienia pominięte.
- Bezpieczeństwo: diff trafia na stdin, Claude nie ma narzędzi (`--tools ""`), działa poza checkoutem, więc `.claude/`, hooki i MCP z PR nie są ładowane. Reguły review pochodzą z `AGENTS.md` gałęzi bazowej.
- [scripts/claude_pr_review.sh](scripts/claude_pr_review.sh): ta sama logika do uruchomienia lokalnie albo w innym CI, z tokenem subskrypcji lub kluczem API.
- Token: sekcja [Token do CI: `claude setup-token`](#token-do-ci-claude-setup-token) niżej.

## Updated review examples (2 October 2026)

- [PR-Agent (Qodo) exercise: AI code review in your CI/CD](PR-Agent-Qodo/README.md): a hands-on exercise for the platform you use at work. Qodo's commercial product and community PR-Agent are separate; version 0.47.0 examples for GitHub Actions, GitLab CI, Bitbucket Cloud, Azure DevOps, Bitbucket Server/DC through Jenkins or Bamboo, Gitea, and a local run. Every example reads the same variables for any OpenAI-compatible model endpoint (default: OpenRouter with `gpt-6-luna`).
- [GitHub + Azure OpenAI setup](github-actions/README.md): participant/fork instructions, configurable endpoint/deployment/model, missing-key failure, and a live-tested community workflow.
- [Updated historical Qodo workflow](github-actions/qodo-pr-agent-review.yml): digest-pinned community runtime, automatic PR/comment handling and an explicit CLI path for manual PR-number dispatch.
- [Azure DevOps: agents with Azure Repos and Boards](azure-devops/README.md): `az repos pr` and `az boards work-item` workflow, PAT scopes vs Entra and `System.AccessToken`, the official Azure DevOps MCP server, and [a PR review pipeline with headless Claude Code](azure-devops/azure-pipelines-agent-review.yml).
- [Codex + Bitbucket Cloud + Jira Cloud](codex-bitbucket/README.md): three pipeline stages and a custom Python REST adapter for ticket context, schema-validated review and persistent bot comments.
- [Complete research handbook](../Research/ai-assisted-pull-requests-course-handbook.md): cross-platform PR automation, alternative reviewers, security, compatibility and rollout.

## GitLab (materiał opcjonalny)

- [PR-Agent i Codex CLI na własnym GitLabie](gitlab-review-jobs.md): oba joby review w [jednym pliku do `include`](gitlab-review-jobs.yml), reguły pipeline MR, zmienne, pułapki z próby na żywo i osobny job publikujący komentarz.
- [GitLab Self-Managed w ChatGPT i Codex](gitlab-self-managed-codex.md): połączenie ChatGPT/Codex z własną instancją GitLaba i wynik próby z 10.11.2026.
- [Tymczasowa sesja glab](glab-course-session.ps1): PowerShell z osobną konfiguracją `glab` i tokenem tylko na czas sesji, bez zmiany firmowego logowania.

> **Azure Pipelines, GitLab CI, Bitbucket Pipelines i cztery agenty (Copilot, Claude Code, Codex, OpenCode):** gotowy zestaw do code review i security review z komentarzem w PR i Jira jest w [agent-review/](agent-review/README.md).

Ten folder jest dodatkiem do dnia 4 i dnia 5. Zawiera:
- przewodnik jak realnie używać Claude Code w CI/CD,
- przykłady workflowów GitHub Actions,
- przykłady Jenkinsfile,
- skrypty do Bitbucket, Jira i Confluence,
- przykład konfiguracji Atlassian MCP do pracy z Jira i Confluence.

## Najważniejsze wnioski po analizie źródeł

### 1. “Headless mode” to dziś w praktyce `claude -p`

Oficjalna dokumentacja Claude nazywa to obecnie programmatic usage, a nie “headless mode”, ale komenda pozostaje ta sama:

```bash
claude -p "your prompt"
```

Źródła:
- Claude docs: `https://code.claude.com/docs/en/headless`
- SFEIR reference: `https://institute.sfeir.com/en/claude-code/claude-code-headless-mode-and-ci-cd/command-reference/`

### 2. Dla CI najbezpieczniejszy wzorzec to:

1. checkout kodu,
2. przygotowanie diffów, logów albo wyników testów,
3. uruchomienie `claude -p`,
4. wynik w `json`,
5. dalsze akcje zwykłym skryptem: komentarz do PR, task w Jira, update Confluence, PR z poprawkami.

### 3. `--bare` jest bardzo dobre do CI, ale nie zawsze

`--bare` wyłącza auto-load:
- CLAUDE.md,
- hooks,
- skills,
- plugins,
- MCP,
- auto memory.

To jest świetne dla:
- review diffów,
- generowania raportów,
- regularnych audytów konfiguracji.

To nie jest dobre, jeśli pipeline ma korzystać z:
- repozytoryjnego `.mcp.json`,
- pluginów,
- MCP do Jira i Confluence,
- custom skills.

Wtedy uruchamiaj bez `--bare`, ale tylko w kontrolowanym runnerze.

Ważne: `--bare` nie czyta `CLAUDE_CODE_OAUTH_TOKEN`, tylko `ANTHROPIC_API_KEY` albo `apiKeyHelper`. Z tokenem subskrypcji z `claude setup-token` uruchamiaj `claude -p` bez `--bare`, ale z pustego katalogu poza repozytorium, z `--tools ""` i `--strict-mcp-config`. Tak robi nasz [workflow](github-actions/claude-pr-review.yml) i [skrypt](scripts/claude_pr_review.sh).

### Token do CI: `claude setup-token`

1. Lokalnie uruchom `claude setup-token`. Otworzy się logowanie w przeglądarce (jak przy `/login`), a po akceptacji token pojawi się w terminalu. Claude go nigdzie nie zapisuje.
2. Skopiuj token jako jedną linię. Terminal łamie go na dwie linie, a skopiowany znak nowej linii psuje token (nasz workflow usuwa białe znaki i ostrzega, ale lepiej zapisać go poprawnie).
3. W repozytorium: **Settings → Secrets and variables → Actions → New repository secret**, nazwa `CLAUDE_CODE_OAUTH_TOKEN`. Albo w terminalu: `gh secret set CLAUDE_CODE_OAUTH_TOKEN` i wklej token, gdy CLI o niego poprosi (nie wpisuj go w poleceniu, bo zostanie w historii).
4. Nie ustawiaj w tym samym jobie `ANTHROPIC_API_KEY`: w trybie `-p` klucz API zawsze wygrywa z tokenem subskrypcji.
5. Token działa rok, na planach Pro, Max, Ultra, Team i Enterprise, i pozwala tylko na zapytania do modelu (bez Remote Control i connectorów claude.ai).
6. Token jest przypięty do subskrypcji osoby, która go wygenerowała. Do własnych repozytoriów i prywatnej automatyzacji to udokumentowane użycie. Do wspólnego CI w firmie dokumentacja zaleca klucz API z Claude Console albo workload identity federation (GitHub OIDC), bez długożyjącego sekretu.

Źródła:
- Claude docs: `https://code.claude.com/docs/en/authentication#generate-a-long-lived-token`
- Claude docs: `https://code.claude.com/docs/en/github-actions#set-up-for-an-organization`
- Nasz research: [tokeny do automatyzacji](../Research/automation-tokens-mcp-news-ide-acp-2026-11-26.md#1-long-lived-automation-tokens)

Źródło:
- Claude docs: `https://code.claude.com/docs/en/headless`

### 4. Atlassian MCP: do pracy interactive/local jest super, do CI trzeba uważać

Najważniejsze ustalenia:
- stare SSE/OAuth flow było problematyczne do automatyzacji,
- w artykule Builder jest ważna aktualizacja: do machine-to-machine lepsze jest API token auth,
- nowy endpoint to `/v1/mcp`,
- jeśli potrzebujesz stabilnej automatyzacji w CI, REST API albo MCP z API tokenem jest lepsze niż stare OAuth.

Źródła:
- Builder.io: `https://www.builder.io/blog/claude-code-with-jira`

### 5. Jenkins + Jira: build/deployment metadata najlepiej robić oficjalnym pluginem Atlassian

Do tego służą:
- `jiraSendBuildInfo()`
- `jiraSendDeploymentInfo(...)`

To nie jest komentarz do ticketu ani transition workflow. To jest przesyłanie build i deployment telemetry do Jira.

Jeśli chcesz:
- dodać komentarz do issue,
- przejść ticket do `In Review`,
- opublikować release notes w Confluence,

to najprościej robić to osobnym skryptem przez REST API.

Źródła:
- Atlassian article: `https://www.atlassian.com/blog/it-teams/how-we-built-the-jenkins-to-jira-cloud-integration-and-what-you-can-do-with-it`
- Jenkins plugin docs: `https://plugins.jenkins.io/atlassian-jira-software-cloud/`

### 6. “Claude by comment” jak GitHub Copilot?

Stan praktyczny (27.11.2026):
- GitHub Copilot ma oficjalne flow `@copilot` w PR commentach,
- oficjalna akcja `anthropics/claude-code-action@v1` reaguje na wzmianki `@claude` w komentarzach (trigger `issue_comment`), z tokenem `CLAUDE_CODE_OAUTH_TOKEN` albo kluczem API,
- Claude Code Review i reszta Claude Ship (`@claude review`, PR Steward, Claude Approvals) działają tylko w planach Team i Enterprise: włącza je Owner organizacji, a koszt idzie z kredytów organizacji, poza limitem planu,
- nasz [workflow](github-actions/claude-pr-review.yml) robi review po komentarzu `/claude-review` na dowolnym planie z `claude setup-token`; PR-Agent reaguje na `/review`, `/describe` i `/improve`,
- da się też pushować eventy do otwartej sesji przez Channels, ale to nie jest to samo co nowa cloud sesja CI/CD.

Wniosek:
- w firmie z planem Team lub Enterprise najprościej poprosić administratora o włączenie Claude Code Review,
- na planach indywidualnych i prywatnych repozytoriach: własny workflow z `claude -p`, PR-Agent, GitHub Copilot code review albo Codex code review.

Źródła:
- GitHub Copilot docs
- Claude channels docs: `https://code.claude.com/docs/en/channels`
- Claude Code GitHub Actions: `https://code.claude.com/docs/en/github-actions`
- Claude Ship: `https://code.claude.com/docs/en/claude-ship`, Code Review: `https://code.claude.com/docs/en/code-review`

### 7. `/schedule` i cotygodniowe utrzymanie CLAUDE.md, rules i skills

Tak, to warto robić.

Oficjalne fakty:
- `/loop` jest session-scoped i znika po zamknięciu sesji,
- docs wprost mówią, że dla trwałego schedulingu trzeba używać:
  - Cloud scheduled tasks,
  - Desktop scheduled tasks,
  - albo GitHub Actions.
- Cloud scheduled tasks działają w chmurze, bez otwartej lokalnej sesji, na świeżym clone repo.

Ale:
- publiczna dokumentacja, którą zweryfikowałem, nie opisuje szczegółowo centralnego, admin-managed org-wide flow typu “admin ustawia jeden weekly task dla wszystkich repo i wszystkich userów”.
- dlatego jako wzorzec zespołowy polecam GitHub Actions `schedule`.
- Cloud scheduled tasks potraktuj jako świetną opcję dla konkretnego repo i zadania, ale nie będę udawał, że mam publicznie zweryfikowaną instrukcję na org-wide admin rollout.

Źródło:
- Claude docs: `https://code.claude.com/docs/en/scheduled-tasks`

## Kiedy używać czego

### Wariant A — bez MCP, czysty CI/CD

Najlepszy do:
- review PR diffów,
- audytów jakości,
- generowania changelogów,
- tygodniowego przeglądu konfiguracji agentów.

Przykłady:
- [github-actions/claude-pr-review.yml](github-actions/claude-pr-review.yml)
- [github-actions/claude-weekly-config-curation.yml](github-actions/claude-weekly-config-curation.yml)
- [scripts/claude_pr_review.sh](scripts/claude_pr_review.sh)
- [scripts/weekly_claude_config_audit.sh](scripts/weekly_claude_config_audit.sh)

### Wariant B — CI/CD + Jira/Confluence przez REST API

Najlepszy do:
- dodawania komentarzy do Jira,
- transition ticketu,
- publikacji release notes do Confluence,
- niezawodnej automatyzacji machine-to-machine.

Przykłady:
- [scripts/jira_comment_and_transition.py](scripts/jira_comment_and_transition.py)
- [scripts/confluence_upsert_page.py](scripts/confluence_upsert_page.py)
- [jenkins/Jenkinsfile.build-deploy-jira](jenkins/Jenkinsfile.build-deploy-jira)

### Wariant C — Jira/Confluence przez Atlassian MCP

Najlepszy do:
- interactive development,
- planowania i implementacji ticketów w terminalu,
- pobierania kontekstu z Jira i Confluence przed kodowaniem.

Dobre także do automatyzacji, ale tylko jeśli:
- używasz nowego `/v1/mcp`,
- używasz API token auth,
- kontrolujesz konfigurację runnera,
- nie używasz `--bare`.

Przykład:
- [mcp/atlassian-rovo-mcp.json.example](mcp/atlassian-rovo-mcp.json.example)

## Gotowe materiały

### GitHub Actions

- [github-actions/claude-pr-review.yml](github-actions/claude-pr-review.yml)
- [github-actions/claude-weekly-config-curation.yml](github-actions/claude-weekly-config-curation.yml)

### Jenkins

- [jenkins/Jenkinsfile.claude-bitbucket-pr-review](jenkins/Jenkinsfile.claude-bitbucket-pr-review)
- [jenkins/Jenkinsfile.build-deploy-jira](jenkins/Jenkinsfile.build-deploy-jira)

### Scripts

- [scripts/claude_pr_review.sh](scripts/claude_pr_review.sh)
- [scripts/weekly_claude_config_audit.sh](scripts/weekly_claude_config_audit.sh)
- [scripts/bitbucket_post_pr_comment.py](scripts/bitbucket_post_pr_comment.py)
- [scripts/jira_comment_and_transition.py](scripts/jira_comment_and_transition.py)
- [scripts/confluence_upsert_page.py](scripts/confluence_upsert_page.py)

### MCP

- [mcp/atlassian-rovo-mcp.json.example](mcp/atlassian-rovo-mcp.json.example)

### Cloud schedule prompt

- [cloud-schedule/weekly-claude-config-curation-prompt.md](cloud-schedule/weekly-claude-config-curation-prompt.md)

## Minimalne wymagania do przykładów

### GitHub Actions

- secret `CLAUDE_CODE_OAUTH_TOKEN` z `claude setup-token` (własne repozytoria) albo `ANTHROPIC_API_KEY` (wspólne CI w firmie), nigdy oba naraz
- możliwość pisania komentarzy do PR
- brak fork-secrets exposure albo odpowiednie zabezpieczenie workflow

### Jenkins + Bitbucket

- agent z `git`, `node`, `npm`, `python3`
- credential:
  - `anthropic-api-key`
  - `bitbucket-api-credentials` jako `usernamePassword`
- webhook albo multibranch PR build z `CHANGE_ID`, `CHANGE_TARGET`

### Jenkins + Jira i Confluence

- Jenkins plugin `Atlassian Jira Software Cloud`
- Jira app `Jenkins for Jira`
- credential:
  - `jira-cloud-api-user` jako `usernamePassword`
  - `confluence-api-user` jako `usernamePassword`

## Źródła przeanalizowane przed przygotowaniem materiałów

- SFEIR command reference:
  `https://institute.sfeir.com/en/claude-code/claude-code-headless-mode-and-ci-cd/command-reference/`
- SFEIR tutorial:
  `https://institute.sfeir.com/en/claude-code/claude-code-headless-mode-and-ci-cd/tutorial/`
- SFEIR common mistakes:
  `https://institute.sfeir.com/en/claude-code/claude-code-headless-mode-and-ci-cd/errors/`
- SFEIR examples:
  `https://institute.sfeir.com/en/claude-code/claude-code-headless-mode-and-ci-cd/examples/`
- Angelo Lima:
  `https://angelo-lima.fr/en/claude-code-cicd-headless-en/`
- Medium Jenkins + Bitbucket:
  `https://medium.com/@sayan.nandi/building-an-ai-powered-automated-code-reviewer-with-claude-code-jenkins-and-bitbucket-b0e600d27b25`
- Reddit discussion:
  `https://www.reddit.com/r/ClaudeCode/comments/1rpweoy/using_jira_mcp_with_claude_code_completely/`
- Builder Jira + MCP:
  `https://www.builder.io/blog/claude-code-with-jira`
- Atlassian Jenkins ↔ Jira:
  `https://www.atlassian.com/blog/it-teams/how-we-built-the-jenkins-to-jira-cloud-integration-and-what-you-can-do-with-it`
- Official Claude docs:
  `https://code.claude.com/docs/en/headless`
  `https://code.claude.com/docs/en/scheduled-tasks`
  `https://code.claude.com/docs/en/channels`
- Atlassian / Bitbucket / Confluence API docs:
  `https://plugins.jenkins.io/atlassian-jira-software-cloud/`
  `https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/`
  `https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/`
  `https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/`
