# Design Guidelines — DevPowers brand

Extracted from <https://devpowers.com/> on 2026-11-25 with the Playwright CLI (`create-design-system` skill). The site exposes its own semantic CSS custom properties, so the colour tokens below are the brand's real tokens, not approximations. Machine-readable source: [`../assets/design-tokens.json`](../assets/design-tokens.json).

## Assets

| File | Purpose |
|---|---|
| [`../assets/homepage-desktop.png`](../assets/homepage-desktop.png) | Header + hero, desktop viewport 1440×900. **Primary visual QA reference** |
| [`../assets/homepage-mobile.png`](../assets/homepage-mobile.png) | Header + hero, mobile (iPhone 15, 393×659 CSS px captured at 3×) |
| [`../assets/homepage.png`](../assets/homepage.png) | Full-page screenshot (very long). Use it for whole-page section structure only |
| [`../assets/logo.svg`](../assets/logo.svg) | Wordmark + mascot, single-colour SVG using `fill="currentColor"` |
| [`../assets/favicon.svg`](../assets/favicon.svg) | Mascot icon; `#004581` in light mode, white under `prefers-color-scheme: dark` |
| [`../assets/design-tokens.json`](../assets/design-tokens.json) | All tokens (colours for both themes, type, spacing, radii, shadows, components) |

> **Licence note:** the logo and favicon are DevPowers brand assets. Confirm usage rights before using them in a product or redistributing them.

## Colours

The brand defines semantic variables on `:root` and overrides them on `html.dark`. **Always use the variables in code**, never raw hex values, so dark mode works for free.

| Variable | Light | Dark | Usage |
|---|---|---|---|
| `--surface` | `#fff9eb` | `#17121d` | Page background (warm cream) |
| `--surface-raised` | `#ffffff` | `#241c2e` | Cards, buttons (light variant), panels |
| `--surface-strong` | `#004581` | `#0d3b66` | Full-width brand bands (navy), emphasis sections |
| `--on-surface` | `#101820` | `#f7efe1` | Body text, headings, ink |
| `--on-surface-strong` | `#ffffff` | `#ffffff` | Text on `--surface-strong` |
| `--muted` | `#4c5b66` | `#c3b4a6` | Secondary text, captions |
| `--accent` | `#d30f10` | `#ff3b30` | Primary CTA (red), key highlights |
| `--on-accent` | `#ffffff` | `#1a0d0c` | Text on accent |
| `--accent-warm` | `#ffd447` | `#ffd233` | Eyebrow labels, active nav underline, badges (yellow) |
| `--on-accent-warm` | `#101820` | `#191016` | Text on yellow |
| `--positive` | `#167a3e` | `#6bdd97` | Success, "yes" checkmarks |
| `--negative` | `#d30f10` | `#ff5a4d` | Errors, "no" crosses |
| `--chat-client` | `#fff1b8` | `#4a3a12` | Chat bubble — client/user |
| `--chat-agent` | `#d9ecff` | `#14395c` | Chat bubble — agent/AI |
| `--soft-red` | `#fff0ed` | `#3b1a1a` | Tinted "problem" panels |
| `--soft-blue` | `#eaf5ff` | `#132c44` | Tinted "solution/info" panels |
| `--hairline` | `#101820` | `#f7efe1` | All borders (ink outlines) |
| `--hairline-strong` | — | `#ffffff` | Dark-theme emphasis borders |
| `--shadow` | `#101820` | `#000000` | Hard offset shadows |

Other observed colours: footer `#002d52` (deeper navy), info blue `#038bfe`, modal overlay `rgba(0, 31, 57, 0.88)`.

Inline text links use the ink colour (`--on-surface`) with no separate link blue.

## Typography

Both fonts come from **Google Fonts** (SIL Open Font License). Nothing is self-hosted, and no font files were downloaded into `assets/`.

```html
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Bangers&display=swap" rel="stylesheet">
```

| Role | Family | Notes |
|---|---|---|
| Display: headings, buttons, eyebrows, CTAs | `Bangers, sans-serif` | Comic-book caps, single weight 400, slanted. Letter-spacing ≈ `0.02em` |
| Body: paragraphs, nav, forms | `"Atkinson Hyperlegible", sans-serif` | 400 regular, 700 bold (nav links are 700) |
| Code / prompts | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace` | 14px / 22.75px |

**Size scale (desktop):**

| Token | Size / line-height | Element |
|---|---|---|
| `h1` | 53.87px / 1.0 | Hero headline (Bangers, fluid) |
| `h3` | 29.6px / 1.08 | Card titles (Bangers) |
| `h2` | 28px / 32px | Section titles (Bangers) |
| `lead` | 21.6px / 35.1px | Hero intro paragraph |
| `button` | 20px / 20px | Buttons and eyebrows (Bangers) |
| `base` | 16px / 24px | Body |
| `sm` | 14px / 20px | Nav, captions, fine print |

Bangers is **display only**. Never set paragraphs or form inputs in Bangers. It is hard to read at length. Google Fonts ships a `latin-ext` subset for both families, but check how `ą ę ł ż ź ć ń ó ś` render in Polish UI text and fall back to Atkinson Hyperlegible 700 if any glyph looks wrong.

## Spacing

The base unit is 4px, and layouts mostly use multiples of 8.

| Token | Value | Typical use |
|---|---|---|
| 1 | 4px | Icon gaps |
| 2 | 8px | Tight gaps |
| 3 | 12px | Button icon gap |
| 4 | 16px | Button horizontal padding, grid gaps |
| 6 | 24px | Card padding, paragraph spacing, heading margins |
| 8 | 32px | Column gaps |
| 12 | 48px | Footer padding |
| 16 | 64px | Section vertical padding |

Breakpoints: `max-width: 1023px` (tablet) and `max-width: 767px` (mobile). Content sits in a centred container about 1160px wide.

## Borders, radius and shadows

The signature of the style is **thick ink outlines plus hard, unblurred offset shadows**, like comic panels.

| Token | Value | Usage |
|---|---|---|
| `borderWidth.default` | 3px solid `--hairline` | Cards, buttons, eyebrows, header bottom |
| `borderWidth.thin` | 2px | Small chips, inner list items |
| `borderWidth.heavy` | 4px | Rare emphasis |
| `radius.sm` | 6px | Small chips |
| `radius.button` | 7px | Buttons |
| `radius.md` | 8px | Inputs, small panels |
| `radius.card` | 10px | Cards, eyebrow labels |
| `radius.lg` | 16px | Large panels |
| `radius.bubbleClient` | `14px 14px 4px 14px` | Client chat bubble (tail bottom-right) |
| `radius.bubbleAgent` | `14px 14px 14px 4px` | Agent chat bubble (tail bottom-left) |
| `radius.circle` | 50% | Step numbers, avatars |

| Shadow | Value | Usage |
|---|---|---|
| `sm` | `3px 3px 0 0 var(--shadow)` | Chips, small elements |
| `md` | `4px 4px 0 0 var(--shadow)` | Buttons |
| `lg` | `6px 6px 0 0 var(--shadow)` | Cards, panels |
| `accent` / `warm` | `6px 6px 0 0 var(--accent)` / `var(--accent-warm)` | Highlighted card |
| `navActive` | `inset 0 -3px 0 0 var(--accent-warm)` | Active nav item underline |

Never use blurred or soft shadows (`box-shadow: 0 4px 12px rgba(...)`). They break the style.

## Components

**Header.** Sticky, background `--surface`, 79px tall, `border-bottom: 3px solid var(--hairline)`. The logo sits on the left. Nav links are centred (Atkinson 14px bold), and the active link gets a yellow inset underline. On the right are square icon buttons (theme toggle, palette) and the primary red CTA "Get a quote".

**Buttons.** All buttons share Bangers 20px, `padding: 10.4px 16px`, `border-radius: 7px`, `border: 3px solid var(--hairline)` and `box-shadow: 4px 4px 0 0 var(--shadow)`. They often carry a leading line icon.
- *Primary:* `--accent` background, `--on-accent` text.
- *Light / secondary:* `--surface-raised` background, `--on-surface` text.
- *Icon:* square light button with only an icon.

**Card.** `--surface-raised` background, 3px ink border, `border-radius: 10px`, `padding: 24px`, `box-shadow: 6px 6px 0 0 var(--shadow)`. The title is set in Bangers.

**Eyebrow / chapter label.** A yellow (`--accent-warm`) pill in Bangers 20px with a 3px border, `radius: 10px` and `padding: 5.6px 11.2px`, e.g. "CHAPTER 01 - MEET THE VILLAIN". Every section starts with one.

**Strong band.** A full-width `--surface-strong` (navy) section with white text, used to break up the cream page.

**Chat bubbles.** Client messages use `--chat-client` (pale yellow) and agent messages use `--chat-agent` (pale blue), both with an asymmetric radius whose tail points at the speaker.

**Code / prompt block.** Monospace 14px inside a card.

**Footer.** `#002d52` background, white text, 48px vertical padding.

**Inputs.** The homepage has no form controls. Derive them from the card style: `--surface-raised` background, 3px ink border, `radius: 8px`, Atkinson 16px, and a 2–3px yellow or ink focus outline.

## Logo usage

- `assets/logo.svg` (mascot + "DevPowers" wordmark, aspect 4.5 : 1) uses `fill="currentColor"`. Set `color` on its container: `--on-surface` on cream or white surfaces, white on navy or dark backgrounds. No separate inverted file is needed.
- Inline the SVG, or load it with `<img>` and accept the default black fill.
- Place it top-left in the header at about 35px high (158px wide), and keep clear space at least equal to the mascot's head height.
- `assets/favicon.svg` is the mascot alone and switches to white automatically in dark mode.

## Visual style summary

DevPowers uses a playful **comic-book / neo-brutalist** language: a warm cream page, thick ink outlines, hard offset shadows and a bold red–yellow–navy palette borrowed from superhero comics. Headlines shout in Bangers ("Your website. Your superpowers."), while body copy stays calm and highly legible in Atkinson Hyperlegible. Sections are framed as story "chapters" with yellow labels, and the brand casts vendor lock-in as the villain and the client as the hero. The tone is confident, a little cheeky and very clear. A full dark theme is built into the variables, and a palette switcher offers alternative "worlds", so build every UI against the semantic variables rather than fixed colours.
