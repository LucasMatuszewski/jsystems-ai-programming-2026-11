# Brief T08 — Image module (validation, model image, thumbnail)

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/` (Next.js 16, TS strict, Vitest, sharp installed). Read `app/AGENTS.md`.

## Goal
`app/server/image/index.ts` (+ helpers) exporting:
- `checkSize(byteLength: number): { ok: true } | { ok: false; code: "file_too_large" }`: limit `MAX_IMAGE_BYTES` from `@/lib/schemas` (10 × 1024 × 1024; exactly that size is OK, +1 byte fails).
- `inspectImage(buf: Buffer): Promise<{ ok: true; format: "jpeg"|"png"|"webp"; width: number; height: number } | { ok: false; code: "unsupported_media_type" }>`: detects the format from content with sharp metadata, applies the 50-megapixel `limitInputPixels`, and treats undecodable or other formats (SVG, GIF, …) as unsupported.
- `prepareForModel(buf): Promise<{ buffer: Buffer; mediaType: "image/jpeg"; width: number; height: number; bytes: number }>`: EXIF auto-rotate, fit inside 1536×1536 without enlargement, JPEG q80, strip all metadata; if > 1.5 MB, re-encode at q65.
- `makeThumbnail(buf): Promise<string>`: rotate, 640 px longer edge without enlargement, WebP q70, returned as a `data:image/webp;base64,` URL.
- Every file starts with `import "server-only"`. Vitest's node project has no `server-only` problem? If it throws in tests, add an alias in tests only; report it, do not edit `vitest.config.ts`.

Sources: `docs/ADR/002-backend-api.md` §3 "Image processing rules", §8 (scenarios, TAC-002-02). PRD AC-07–AC-09, AC-14.

## Tests (first, red, then green) `app/tests/unit/image/image.test.ts`
Use ONLY the real files in `../assets/example-images/` (`laptop-1.png` is JPEG content, 3024×3135; `laptop-2.webp` 863×843; `phone-1.jpg` 900×1200; `phone-2.jpeg` 387×516; `phone-3.jpeg` 449×445) and `../assets/logo.svg` as the disallowed type. Never generate images or empty files.
- each photo: inspectImage ok with the right format (`laptop-1.png` → jpeg); logo.svg → unsupported_media_type
- prepareForModel: longer edge = min(original, 1536); laptop-1 → 1536; phone-2 unchanged 516; output is JPEG; `sharp(output).metadata()` has no `exif`/`icc`/`xmp`; bytes ≤ 1.5 MB
- thumbnail: data URL starts with `data:image/webp;base64,`, decoded ≤ 100 KB, longer edge = min(original, 640)
- checkSize(10485760) ok, checkSize(10485761) file_too_large

## Editable files
`app/server/image/**`, `app/tests/unit/image/**`. Nothing else.

## Forbidden
No commits, no `git add`, no dependency changes, no reading `.env*`, no network, no generated images.

## Commands (in `app/`)
`pnpm test -- tests/unit/image` · `pnpm typecheck` · `pnpm lint`

## Report (≤ 25 lines)
Files · red output summary · green counts · typecheck/lint · deviations.
