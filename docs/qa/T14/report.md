# T14 visual brand check (prod, `/`)
Screenshots: `desktop.png` (1440x900), `mobile.png` (360x780). References: `assets/homepage-desktop.png`, `homepage-mobile.png`.

## Matches
- Cream background (#fff9eb-like), ink 3 px border under header (header sticky per layout), logo top-left ~35 px high, product name in Bangers, ink text, Atkinson body, chat answers in Atkinson with correct Polish glyphs; no horizontal scroll at 360 px (page fits, composer margins visible).
## Differences
- (medium) Prompt form: the lower bar of the composer is a flat dark-grey slab (#888) instead of white/cream with ink border; looks like a disabled/muted overlay. Visible at 1440 and 360 px.
- (medium) Send button is a dull, desaturated red (disabled opacity) with a grey ring; hard offset shadow not visible. Active state not checked (needs text).
- (medium) User chat bubble is slate grey-blue; guidelines say `--chat-client` #fff1b8 (yellow) with 14px radius, ink border.
- (low) Empty state heading is small Bangers (~16 px) and UI strings still English ("What can I help with?", "Send a message...") - T22 replaces; Polish required.
- (low) Header has no nav/theme/CTA buttons, no dot pattern (reference has them; acceptable for this app).
- (low) Product name sits next to logo at ~20 px, reference wordmark is the logo only; fine.
- (info) Polish glyphs in Bangers not verifiable: product name has no diacritics.
## Title and favicon
- `<title>` is "Chat" (template page.tsx; T22 replaces).
- Head has `/favicon.ico` (template, `app/app/favicon.ico`, listed first) and `/favicon.svg`; the template .ico may win in some browsers (low): remove it or verify.
