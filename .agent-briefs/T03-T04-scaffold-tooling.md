# Brief T03+T04 — Finish scaffold with OpenRouter, add tooling and nested agent instructions

Repo root: `/home/labuser/jsystems-ai-programming-2026-11` (branch `feat/app-implementation`). App: `app/`.
Use `pnpm` (on PATH, 12.23.0). Run commands inside `app/`.

## Goal
1. **T03:** `app/` is a working Next.js app from `shadcn-ui/chatbot-template` whose template chat streams from OpenRouter `gpt-6-luna`. No AI Gateway, Anthropic or OpenAI provider leftovers.
2. **T04:** strict TS, Vitest (node + jsdom projects), Playwright (1440 + 360 px projects), all scripts registered, `openrouter:status` script, env examples, `app/AGENTS.md` + `app/CLAUDE.md`, one smoke test per runner, `docs/qa/spend.md` started.

## Already done (do not redo)
- Template copied into `app/` (original `app/README.md` kept). Template README is at `/tmp/claude-1000/-home-labuser-jsystems-ai-programming-2026-11/b9124a30-ad4b-4dc6-8704-17d133be039b/scratchpad/template-README.md`. Copy useful setup notes from it into `app/README.md`, keeping the existing checklist (tick the items that are now done).
- `pnpm install` done. Removed: `@ai-sdk/gateway`, `@ai-sdk/anthropic`, `@ai-sdk/openai`. Added: `@openrouter/ai-sdk-provider@3.1.0`, `sharp`, `server-only`, `react-hook-form`, `@hookform/resolvers`. Dev: vitest, @vitejs/plugin-react, jsdom, @testing-library/{react,user-event,jest-dom,dom}, @playwright/test, @axe-core/playwright, tsx. `pnpm-workspace.yaml` allows esbuild/sharp builds.
- Installed: next 16.3.6, ai 7.0.118, zod 4.6.5, vitest 5.1.1.

## Authoritative docs (read these sections yourself)
- `docs/ADR/004-project-setup-and-tooling.md` §3 (all), §8
- `docs/ADR/000-main-architecture.md` §7 (env vars)
- `docs/ADR/006-real-endpoint-verification.md` §3.3–3.4 (no mock mode; `openrouter:status`)
- `docs/ADR/005-agent-execution-tooling.md` §3.1
- Root `AGENTS.md` (TDD, commit rules). Do NOT read `course-materials/`.
- Library facts: use `npx ctx7@latest library <name> "<q>"` then `npx ctx7@latest docs <id> "<q>"` (AI SDK 7: `/vercel/ai/ai_7.0.0`; Next 16; OpenRouter provider). For the OpenRouter key/limits endpoint, check the OpenRouter docs (ctx7 or https://openrouter.ai/docs/api-reference/limits) before coding.

## Tasks
### T03
1. Rewrite `app/app/api/chat/route.ts` to use `createOpenRouter` from `@openrouter/ai-sdk-provider` with model `process.env.LLM_MODEL ?? "openai/gpt-6-luna"`. Keep `validateUIMessages`, abort signal and `maxDuration`. No tools, no reasoning sent to the client, masked `onError`. This is a temporary template chat; T23 replaces it later.
2. Delete Gateway-only parts: `lib/models.ts`, `components/model-select.tsx`, the `tools/` directory (web_search, github_repo, ask_user), `components/parts/{github-repo,web-search,ask-user,sources,reasoning}-part.tsx`, `components/question-card.tsx`, `components/suggestions.tsx` if unused, and any Vercel OIDC / `vercel env pull` / `AI_GATEWAY_API_KEY` references (incl. README notes). `rm` is not allowed in this environment. Use `git rm` only for tracked files (none are tracked yet), otherwise empty the file list via `mv <file> /tmp/claude-1000/-home-labuser-jsystems-ai-programming-2026-11/b9124a30-ad4b-4dc6-8704-17d133be039b/scratchpad/trash/`. Make the chat components compile with a local `ChatUIMessage = UIMessage` type.
3. **Env loading without reading secrets:** you must NOT read, cat, grep or print `/home/labuser/jsystems-ai-programming-2026-11/.env` or any `.env*` except `.env.example` files. The real key lives in the repo-root `.env`. Make the app load it at runtime: in `app/next.config.ts` call `loadEnvConfig` from `@next/env` on the repo root (`path.resolve(__dirname or import.meta.dirname, "..")`) so `OPENROUTER_API_KEY` from the root `.env` is available, while `app/.env.local` (if any) still wins. Scripts (tsx) do the same via a tiny `app/scripts/load-env.ts` helper using `process.loadEnvFile` with existence checks (never printing values).
4. `app/.gitignore` additions: `.env*.local`, `.data/`, `test-results/`, `playwright-report/`, `.next/`.
5. The template's `app/.claude/launch.json`: keep it only if harmless (dev on port 3000). Delete nothing else from `.claude`.
6. Verify: `pnpm typecheck`, `pnpm lint`, `pnpm build` pass. `pnpm start` (background, port 3000) then `curl` is denied. Use `node -e "fetch('http://localhost:3000/').then(r=>console.log(r.status))"` to show `/` returns 200, then stop the server (kill by PID from `$!`; `kill` is allowed). `grep -rn "gateway\|AI_GATEWAY\|@ai-sdk/anthropic\|@ai-sdk/openai\|vercel env" app --exclude-dir=node_modules --exclude-dir=.next` must be empty (TAC-004-04).
7. Then bump `next` and `eslint-config-next` to the latest 16.4.x (`pnpm add next@16.4 eslint-config-next@16.4`) and re-run typecheck/lint/build. If it breaks and you can't fix it in a few minutes, revert to 16.3.6 and report.
8. **Real-endpoint smoke:** with the server running, send ONE real chat request using node fetch to `/api/chat`, with body `{"messages":[{"id":"m1","role":"user","parts":[{"type":"text","text":"Odpowiedz jednym słowem: działa?"}]}]}`. Show the first ~400 chars of the SSE body. One request only (spend cap).

### T04
1. `tsconfig.json`: keep `strict: true`, add `noUncheckedIndexedAccess: true`. Fix resulting errors.
2. `vitest.config.ts` with two projects: `node` (`tests/unit/**`, `tests/integration/**`, `tests/smoke/node*.test.ts`, environment node) and `jsdom` (`tests/component/**`, `tests/smoke/component*.test.tsx`, environment jsdom, setup file with `@testing-library/jest-dom/vitest`). `@` alias. Exclude `tests/e2e/**`. Add a setup for the node project that makes any `fetch` to `openrouter.ai` throw (TAC-02: no network in unit/integration).
3. `playwright.config.ts`: `testDir: tests/e2e`, webServer `pnpm build && pnpm start` on port 3000 (reuseExistingServer), projects `desktop` (Desktop Chrome, viewport 1440×900) and `mobile` (viewport 360×780, isMobile, hasTouch), timeout 120 s. Run `pnpm exec playwright install chromium` (if it prompts or fails, report).
4. `package.json`: `"packageManager": "pnpm@12.23.0"`, `"engines": {"node": ">=24"}`; scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `format`, `test` (`vitest run`), `test:watch`, `test:e2e` (`playwright test`), `eval:decisions` (`tsx scripts/eval-decisions.ts`), `openrouter:status` (`tsx scripts/openrouter-status.ts`), `record:openrouter` (`tsx scripts/record-openrouter.ts`), `record:app` (`tsx scripts/record-app.ts`). The last three files are created later; register the entries now.
5. `scripts/openrouter-status.ts`: GET the OpenRouter key endpoint (verify the path and fields in the docs first) and the models list for `LLM_MODEL` and `DECISION_MODEL` (defaults `openai/gpt-6-luna`, `openai/gpt-6-luna-decisions`). Print the credit limit, usage, remaining credit, free-tier flag, rate limit and whether each model is listed. Never print the key. Run it once and paste the output.
6. `docs/qa/spend.md`: a table (date, activity, usage before USD, after USD, delta, cumulative). Add the first row from the status output: "T03/T04 baseline".
7. Env examples: `app/.env.example` with every variable from ADR-000 §7 and example values (no real key). Add the same names to the root `.env.example` (keep its existing lines).
8. `app/AGENTS.md` (< 150 lines): replace the template's content but keep its Next.js "read node_modules/next/dist/docs" warning. Include: the commands table (ADR-004 §5), the folder role map (ADR-004 §3.2, noting the template conventions actually used, e.g. react-markdown instead of Streamdown), an AI SDK 7 cheat-sheet (ADR-004 §3.5; verify each item via Context7 `/vercel/ai/ai_7.0.0`), OpenRouter-only rule, "upload tests use only `../assets/example-images/`", "endpoint doubles are replays of recordings in `tests/fixtures/` (ADR-006)", env loading from the root `.env`, and "never read `.env`". `app/CLAUDE.md` = `@AGENTS.md`.
9. Root `AGENTS.md`: add exactly one pointer line in the Repository Layout area: `app/AGENTS.md` holds the stack-specific rules for the application.
10. Smoke tests (write them first, run red, then make green): `tests/smoke/node.test.ts` (imports `@/lib/utils` `cn` and asserts output), `tests/smoke/component.test.tsx` (renders `components/ui/button` and finds it by role), `tests/e2e/smoke.spec.ts` (opens `/`, expects HTTP 200 and a visible `header`). Run `pnpm test` and `pnpm test:e2e --project=desktop --project=mobile -g smoke`, and report discovered/passed/skipped counts.

## Editable files
Everything under `app/` except `app/README.md`'s existing checklist content (only extend it), plus `docs/qa/spend.md`, the root `.env.example`, and one line in the root `AGENTS.md`. Nothing else.

## Forbidden
- No `git commit`, `git push` or `git add`. The orchestrator commits.
- Never read or print `.env` contents (root or app). Never put a key in any file.
- No mock mode or flag in app code (ADR-006 §3.3).
- No more than 2 real OpenRouter calls total (one chat smoke, plus a retry only if the first failed for a code reason).
- Do not touch `.mcp.json`, `.claude/settings.json` or `course-materials/`.
- Leave no server running at the end.

## Report (final message, concise; max ~60 lines)
Files changed/deleted (summary) · versions (next, ai, provider) · typecheck/lint/build results · test counts per runner (red then green) · E2E smoke result · `/` status · chat smoke excerpt · `openrouter:status` output (no key) · deviations from ADRs and why · open questions.
