# App

This folder will contain the application built during the course.

## How to start

The app is scaffolded live during the course through a structured process:

1. **Research** — use agents to research and validate the project idea
2. **PRD** — generate a Product Requirements Document (`../docs/PRD.md`)
3. **ADR** — generate Architecture Decision Records (`../docs/ADR/`) to choose the tech stack
4. **Scaffold** — use the chosen boilerplate (`create-next-app`, AI SDK starter, Mastra, etc.)
5. **Implement** — build features with agents using TDD

## Checklist

Use this checklist during scaffolding. Some items are provided by the boilerplate (e.g. `create-next-app` ships `tsconfig.json`, ESLint config). Others you add explicitly.

### Project setup
- [x] Choose framework (Next.js, Express+Vite, Mastra, other) — record in ADR
- [x] Initialize project (e.g. `npx create-next-app@latest` or equivalent)
- [x] TypeScript config (`tsconfig.json`)
- [x] Package manager chosen (npm / pnpm / bun)

### Code quality
- [x] ESLint config (`eslint.config.js`)
- [x] Prettier config (`.prettierrc`, `.prettierignore`)
- [ ] `.editorconfig` (optional but recommended)

### Testing
- [x] Unit/integration test runner (Vitest / Jest)
- [x] E2E test runner (Playwright)
- [x] Test setup file (e.g. `test-setup.ts` with Testing Library matchers)

### Environment
- [x] `.env.example` with required env vars (API keys, ports)
- [x] `.env` created locally (gitignored; the real key is in the repository-root `.env`)
- [x] `.gitignore` (node_modules, .env, build output, etc.)

### AI integration
- [x] Vercel AI SDK (`ai` package) or equivalent
- [x] API route / endpoint for chat
- [x] Model configuration (provider, model name, API key from env)

### Design
- [ ] Design tokens (`../assets/design-tokens.json`)
- [x] Tailwind CSS or equivalent
- [ ] Logo and favicon (`../assets/`)
- [ ] Design system doc (`../docs/design-guidelines.md`)

### Documentation
- [ ] PRD (`../docs/PRD.md`)
- [ ] ADRs (`../docs/ADR/`)
- [x] AGENTS.md in `app/` with stack-specific rules

## Notes

- Don't create config files manually if the boilerplate provides them — it leads to conflicts.
- Let the agent research and recommend the right boilerplate based on the ADR decisions.
- Keep this folder organized: separate routes, components, domain logic, and tests.

## Current setup (scaffold from `shadcn-ui/chatbot-template`)

Next.js 16, React 19, AI SDK 7 with `@openrouter/ai-sdk-provider`, shadcn/ui, shadcn/typeset and Tailwind 4. The template chat at `app/api/chat/route.ts` streams from OpenRouter (`LLM_MODEL`, default `openai/gpt-6-luna`) and is temporary. Rules for agents are in [AGENTS.md](AGENTS.md).

### Local development

```bash
pnpm install
cp .env.example .env.local   # optional: the root ../.env is loaded automatically
pnpm dev                      # http://localhost:3000
```

Set `OPENROUTER_API_KEY` in `.env.local` or in the repository-root `.env` (`app/.env.local` wins). All variables are described in `.env.example`.

### Useful commands

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, `pnpm openrouter:status` (credit, usage and model availability for the configured key).

### Chat structure (from the template)

- `app/api/chat/route.ts` streams with `streamText` and validates messages with `validateUIMessages`.
- `components/chat.tsx` renders the conversation with `useChat` and shadcn chat primitives; assistant text is rendered by `components/parts/text-part.tsx` (react-markdown + shadcn/typeset).
- Add shadcn components with `pnpm dlx shadcn@latest add <name>`.

### Security note

`/api/chat` is public and unauthenticated and every request spends OpenRouter credits. Keep the key's credit limit low and add rate limiting and authentication before real traffic.

Template licence: MIT, see [LICENSE](LICENSE).
