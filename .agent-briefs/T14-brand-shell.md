# Brief T14 — DevPowers brand tokens and app shell

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/` (Next.js 16, Tailwind 4, shadcn variables in `app/app/globals.css`). Read `app/AGENTS.md`.

## Goal
The whole app uses the DevPowers brand through CSS variables: cream page, ink 3 px borders, hard offset shadows, red primary buttons, Bangers display font, Atkinson Hyperlegible body, and a sticky header with the logo and the product name.

Sources (read them): `docs/design-guidelines.md` (all), `assets/design-tokens.json`, `docs/ADR/003-frontend-chat-ui.md` §3.5, PRD §9 ("All screens share a header with the logo and the product name 'Hardware Service Decision Copilot'"). Visual references: `assets/homepage-desktop.png`, `assets/homepage-mobile.png`.

## Tasks
1. `app/app/globals.css`: define the brand variables on `:root` (light) and `.dark` (dark values from the tokens; light theme only is used in the PoC). Map shadcn semantic variables to them (`--background` ← `--surface`, `--foreground` ← `--on-surface`, `--card` ← `--surface-raised`, `--primary` ← `--accent`, `--primary-foreground` ← `--on-accent`, `--secondary` ← `--surface-raised`, `--muted-foreground` ← `--muted`, `--border`/`--input`/`--ring` ← `--hairline`, `--destructive` ← `--negative`, `--radius` 8px). Expose Tailwind 4 `@theme inline` tokens: colors (`surface`, `surface-raised`, `surface-strong`, `on-surface`, `accent-warm`, `on-accent-warm`, `positive`, `negative`, `chat-client`, `chat-agent`, `soft-red`, `soft-blue`, `hairline`), shadows (`shadow-brand-sm/md/lg` = hard offsets with `var(--shadow)`), radii (`rounded-button` 7px, `rounded-card` 10px, `rounded-bubble-client`, `rounded-bubble-agent`), fonts (`font-display` Bangers, `font-sans` Atkinson Hyperlegible). No raw hex outside the variable definitions.
2. Fonts through `next/font/google` in `app/app/layout.tsx`: Bangers 400 and Atkinson Hyperlegible 400/700 with the `latin-ext` subset (Polish glyphs). Set `<html lang="pl">`. Force the light theme (keep `ThemeProvider` if present, with `forcedTheme="light"` or remove dark switching). Metadata title "Hardware Service Decision Copilot", Polish description.
3. Base component styles: update `components/ui/button.tsx` variants to the brand (Bangers 20px, 3px ink border, `rounded-button`, `shadow-brand-md`, primary = accent red, secondary = raised white; pressed state translates by the shadow and removes it). Inputs/textarea/select: raised background, 3px ink border, radius 8px, Atkinson 16px, visible focus ring (2–3px yellow or ink outline). Card-like containers: `shadow-brand-lg`, `rounded-card`, 3px border. Never blurred shadows.
4. `app/components/site-header.tsx`: sticky, `bg-surface`, about 79px tall on desktop, `border-b-[3px] border-hairline`; the logo (inline SVG from `assets/logo.svg`, `fill="currentColor"`, colour `--on-surface`, ~35px high, link to `/`, `aria-label`) on the left and the product name next to it (Bangers, truncates or wraps cleanly at 360 px). Remove the template's "New Chat" button from the header (the "Nowe zgłoszenie" action lives in the case summary later).
5. `app/public/`: copy `assets/logo.svg` → `public/logo.svg`, `assets/favicon.svg` → `public/favicon.svg`; use the SVG favicon in metadata (`icons`). Move the template's `app/app/favicon.ico` to the scratchpad trash dir `/tmp/claude-1000/-home-labuser-jsystems-ai-programming-2026-11/b9124a30-ad4b-4dc6-8704-17d133be039b/scratchpad/trash/` (`rm` is not allowed).
6. Do not restyle the chat or form feature components themselves (other workers own them); only primitives in `components/ui/` and the global CSS/layout/header.

## Verification
`pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` (no regressions). Then start `pnpm start` in the background, and take screenshots with the Playwright CLI (`playwright-cli open http://localhost:3000`, `resize 1440 900`, `screenshot`, `resize 360 780`, `screenshot`; save them as `docs/qa/T14/desktop.png` and `docs/qa/T14/mobile.png`). Compare them with the reference PNGs, and list the matches and differences (header, colours, fonts, borders, shadows). Check that there is no horizontal scroll at 360 px. Kill the server and close the browser.

## Editable files
`app/app/globals.css`, `app/app/layout.tsx`, `app/components/site-header.tsx`, `app/components/ui/**`, `app/components/theme-provider.tsx`, `app/public/**`, `app/app/favicon.ico` (removal), `docs/qa/T14/**`. Nothing else.

## Forbidden
No commits/`git add`, no dependency changes, no `.env*`, no real chat messages (no model calls needed), no edits to `lib/**`, `components/case-form/**`, `components/chat*`.

## Report (≤ 30 lines)
Files · token mapping summary · checks · screenshot paths · brand comparison (matches/differences) · open issues.
