# Brief T15 — Case form and photo input (component, no fetch)

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/` (Next.js 16, React 19, Tailwind 4, shadcn components in `components/ui/`, react-hook-form + @hookform/resolvers + zod 4 installed). Read `app/AGENTS.md`. Contracts: `app/lib/schemas/**` (`makeCaseFormFieldsSchema`, constants, `CATEGORIES`, `CASE_TYPES`), `app/lib/i18n/pl.ts` (ALL UI strings come from here; if a string is missing, report it, do not add strings to `pl.ts`), `app/lib/dates.ts` (`todayInWarsaw`, `addYears`).

## Goal
`app/components/case-form/case-form.tsx` (`CaseForm`) and `app/components/case-form/photo-input.tsx` (`PhotoInput`), plus `app/components/case-form/photo-checks.ts` (pure: `checkPhotoSize(bytes)`, `detectImageType(headerBytes: Uint8Array): "jpeg"|"png"|"webp"|null` with magic bytes JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF....WEBP`).
- Props: `CaseForm({ onSubmit(values: CaseFormValues, file: File): void; disabled?: boolean; initialValues?: Partial<CaseFormValues>; initialFile?: File | null; today?: string })`. `disabled` = submission in progress → the submit button is disabled (AC-13). `initialValues`/`initialFile` restore data after a failure (AC-41). It emits validated values; it never calls `fetch`.
- Fields in AC-01 order: case type (two large selectable cards, radio group semantics, none preselected, with subtitles), category (native `<select>` or shadcn Select with a placeholder option and no preselection), model, purchase date (native `<input type="date">` with `max` = today and `min` = today − 5 years), reason (textarea, live counter `n/2000`, label required marker `*` only for Reklamacja, placeholder per type), photo, consent checkbox, submit "Wyślij zgłoszenie".
- Validation with react-hook-form + zod resolver using `makeCaseFormFieldsSchema(today)` plus the photo rules (required, ≤ 10 MB, type by magic bytes, not by extension: `laptop-1.png` is a JPEG and is accepted). Error messages under each invalid field from `pl.errors[code]`, linked with `aria-describedby` and `aria-invalid`, announced (`role="alert"` or a live region). On invalid submit: no `onSubmit`, focus the first invalid field (AC-12), keep all values and the photo.
- `PhotoInput`: one file, `accept="image/jpeg,image/png,image/webp"`, drag & drop zone on desktop plus a visually clear button; on mobile the native picker offers camera or gallery (do not force `capture`). Hint per case type, personal-data note, thumbnail via object URL (revoke on change/unmount), file name, "Zmień zdjęcie". A rejected file is not kept.
- Styling: use shadcn primitives and semantic Tailwind classes only (`bg-card`, `border`, `text-muted-foreground` …), no raw hex. Branding is applied separately in T14 via CSS variables.
- Accessible: every field has a visible `<label>`; the whole form works with keyboard only (AC-46).

Sources: PRD §6 Form AC-01–AC-13, §9.1, AC-46; `docs/ADR/003-frontend-chat-ui.md` §3.2 (CaseForm, PhotoInput), §8 table.

## Tests (first, red, then green) `app/tests/component/case-form/*.test.tsx` (jsdom) + `app/tests/unit/client-utils/photo-checks.test.ts`
Use ONLY real files: read bytes of `../assets/example-images/*` and `../assets/logo.svg` with `fs` and wrap them in `new File([bytes], name, { type })`. Never generated or empty files. Cover: field order and options, none preselected; reason required marker toggles with type; complaint reason 19 vs 20 chars; empty submit → no onSubmit, errors shown, focus on the first field; future date error; logo.svg → "Dozwolone formaty: JPG, PNG, WebP."; laptop-1.png (JPEG bytes) accepted; size rule via `checkPhotoSize(10485760)` ok / `10485761` error (unit level, no big file); "Zmień zdjęcie" replaces the file; valid full submit calls onSubmit once with trimmed values and the File; `disabled` disables submit and a second click does nothing; `initialValues` + `initialFile` prefill everything. jsdom has no `URL.createObjectURL`: stub it in the test file only.

## Editable files
`app/components/case-form/**`, `app/tests/component/case-form/**`, `app/tests/unit/client-utils/photo-checks.test.ts`. You may ADD missing shadcn primitives under `app/components/ui/` ONLY by copying patterns already used there (no CLI, no installs); report it.

## Forbidden
No commits/`git add`, no dependency changes, no `.env*`, no network, no edits to `lib/**`.

## Commands (in `app/`)
`pnpm test -- tests/component/case-form tests/unit/client-utils` · `pnpm typecheck` · `pnpm lint`

## Report (≤ 30 lines)
Files · props API · red summary · green counts · typecheck/lint · missing pl strings (if any).
