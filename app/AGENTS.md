<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# App rules (Hardware Service Decision Copilot)

Stack-specific rules for `app/`. Universal rules (TDD, Manual QA, commits) are in the root `../AGENTS.md`; specs are in `../docs/PRD.md` and `../docs/ADR/`.
Stack: Next.js 16 (App Router, Turbopack), React 19, AI SDK 7 (`ai`, `@ai-sdk/react`), `@openrouter/ai-sdk-provider` 3.x, shadcn/ui + Base UI, Tailwind 4, Zod 4, pnpm, Vitest, Playwright.

## Commands (run inside `app/`)

| Command | Purpose | Before commit |
|---|---|---|
| `pnpm typecheck` | `tsc --noEmit` (strict + `noUncheckedIndexedAccess`) | Yes |
| `pnpm lint` | ESLint, zero warnings in changed files | Yes |
| `pnpm test` | Vitest: `node` + `jsdom` projects, no network | Yes |
| `pnpm build` | Production build | Runtime changes |
| `pnpm build` then `pnpm test:e2e` | Playwright projects `desktop` (1440 px), `mobile` (360 px), `failure` (invalid-key server, port 3001); real stack incl. OpenRouter. Playwright starts both servers itself (no reuse, log in `test-results/server.log` or `E2E_SERVER_LOG`), global timeout 40 min | Flow changes |
| `pnpm test:e2e --project=<p> <spec> --global-timeout=900000` | One spec per run (slow, paid); run in the background with a log and watch it | Flow changes |
| `pnpm dev` / `pnpm start` | Manual QA with the Playwright CLI (port 3000) | Yes |
| `pnpm openrouter:status` | Key credit, usage, rate limit, model availability (never prints the key) | Before real-endpoint runs |
| `pnpm record:openrouter` / `pnpm record:app` | Record real responses into `tests/fixtures/` (ADR-006) | When fixtures drift |
| `pnpm eval:decisions` | Fast-path vs escalation evaluation (costs credits) | Manual |
| `pnpm format` | Prettier (Tailwind class sorting) | Optional |

Append every real OpenRouter run to `../docs/qa/spend.md` (cap USD 5 in total).

## Folder map (template conventions kept)

The Next.js router lives in `app/app/` (outer `app/` = course project folder).

| Path | Role |
|---|---|
| `app/` | Routes, `layout.tsx`, `globals.css`; `api/cases/route.ts` (multipart → NDJSON), `api/chat/route.ts` (case chat agent, SSE) |
| `components/ui/` | shadcn primitives (add from the shadcn registry only) |
| `components/` | Feature components (`chat`, `prompt-form`, `parts/text-part`); markdown via `react-markdown` + `remark-gfm` (not Streamdown) |
| `lib/` | Shared code: `utils.ts` (`cn`), `chat-types.ts` (`ChatUIMessage = UIMessage`), later `schemas/`, `i18n/`, `ndjson` |
| `server/` | Server-only code (planned): `env`, `image/`, `ai/` — start files with `import "server-only"` |
| `scripts/` | tsx scripts; `load-env.ts` loads env files without printing values |
| `tests/` | `unit/`, `integration/`, `component/`, `smoke/`, `e2e/`, `setup/`, `fixtures/` (recorded real responses, ADR-006) |
| `public/` | Logo and favicon copied from `../assets/` |
| `.data/` | Decision log (git-ignored) |

## Rules

- **OpenRouter only.** Models come from `createOpenRouter` (`@openrouter/ai-sdk-provider`). No Vercel model router, no other provider packages, no bare string model IDs. There is no mock mode or env flag that replaces a model (ADR-006 §3.3).
- **Env:** variables are listed in `.env.example`. The real `OPENROUTER_API_KEY` lives in the repository-root `.env`; `next.config.ts` and `scripts/load-env.ts` load it (`app/.env.local` wins). **Never read, cat, grep or print any `.env` file** — only `.env.example`.
- **Tests:** write them first (root TDD rules). The `node` project blocks any `fetch` to `openrouter.ai`. Endpoint doubles are replays of recordings in `tests/fixtures/` (ADR-006), never hand-written responses.
- **Upload tests and QA use only `../assets/example-images/`.**
- **Client input that reaches a prompt** has a Zod length/format limit and an allow-list of message roles and part types. The server recomputes derived values (such as `daysSincePurchase`) and never trusts the client copy.
- UI text is Polish; follow `../docs/design-guidelines.md` and `../assets/design-tokens.json`.
- Context7 for libraries: match docs to the version in `pnpm-lock.yaml` (`ai` 7.x, Next 16, Zod 4).

## AI SDK 7 cheat-sheet (verified with Context7 `/vercel/ai/ai_7.0.0`)

- `instructions`, not `system`, in `streamText` / `generateText` / agents.
- `generateText({ output: Output.object({ schema }) })` and read `result.output`; `generateObject` is deprecated.
- Chat route: `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })`, not `result.toUIMessageStreamResponse()`. `sendReasoning` defaults to true in ai 7.0.118, so we pass `false` explicitly (no reasoning parts reach the client).
- Multi-step limit: `stopWhen: isStepCount(n)`.
- Files/images in messages are parts with `mediaType` (e.g. `{ type: "file", mediaType: "image/jpeg", data }`).
- `onEnd` replaces `onFinish` for core calls (`generateText`, `streamText`, agents).
- Validate incoming UI messages with `validateUIMessages`; convert with `await convertToModelMessages(messages)`.
- Test doubles: `MockLanguageModelV4` from `ai/test` (only for tests built from recordings, ADR-006).
- Client: `useChat` from `@ai-sdk/react`, typed with `ChatUIMessage`.
