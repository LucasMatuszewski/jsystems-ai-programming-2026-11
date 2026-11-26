# E2E coverage (PRD section 6 acceptance criteria)

All E2E specs run on the `desktop` (1440 px) and `mobile` (360 px) projects against the real stack.
All features are built (T27): no `test.fail()` remains. The `failure` project runs `failure.spec.ts` against a second server on port 3001 with an invalid key (AC-41/42/43).
`smoke.spec.ts` is unchanged.

| AC | Topic | Covered by | Status |
|---|---|---|---|
| AC-01 | Form fields in order | — | Manual only (G4): field order is visible in the manual regression; no automated order assertion |
| AC-02 | Case type radio, no preselection | `return-flow`, `complaint-flow` (selection); `session` (both unchecked after reset) | Covered |
| AC-03 | Category select options | `return-flow` (option "Laptop" by label) | Covered; Manual only (G4): full option list |
| AC-04 | Model 2–100 chars | `form-validation` "model shorter than 2 characters" | Covered |
| AC-05 | Future date / older than 5 years | `form-validation` "future purchase date", "older than 5 years" | Covered |
| AC-06 | Reason optional for Zwrot, required for Reklamacja | `form-validation` "complaint without a reason", "reason longer than 2000"; `return-flow` | Covered |
| AC-07 | One file, JPEG/PNG/WebP, camera on mobile | `form-validation` (accepted file); `responsive-a11y` (mobile) | Manual only (G4): camera capture attribute only matters on a real phone |
| AC-08 | Type from content, not extension | `form-validation` "JPEG named .png is accepted" | Covered |
| AC-09 | Size > 10 MB and other types rejected | `form-validation` "SVG logo is rejected" | Type covered; Manual only (G4): 10 MB limit (no real oversized photo, generated files forbidden; unit-tested on byte counts) |
| AC-10 | Thumbnail, file name, "Zmień zdjęcie" | `form-validation` "JPEG named .png is accepted"; "values kept" | Covered |
| AC-11 | Consent text, required | `form-validation` "values kept" (consent error) | Manual only (G4): exact consent text is checked visually |
| AC-12 | Errors, focus to first invalid, values kept, no request | `form-validation` "empty submit", "values kept" | Covered |
| AC-13 | Submit disabled during submission, no double send | — | Manual only (G4): double-click timing is not reliably automatable against a real model |
| AC-14 | Image reduced before analysis | — | Unit test (image functions); not E2E |
| AC-15 | Return-specific image analysis | `return-flow` (structure only) | Content not asserted by design (structure only) |
| AC-16 | Complaint-specific image analysis | `complaint-flow` (C- rule) | Structure only |
| AC-17 | Form data as context only | — | Manual only (G4): model judgement, covered by `pnpm eval:decisions` |
| AC-18 | Analysis within 90 s | `return-flow` (waitForChat 90 s), TAC-05 | Covered |
| AC-19 | Policy per case type | `return-flow`, `complaint-flow`, `date-rule` (R- vs C- rules) | Structure only |
| AC-20 | Decision is one of three values | `return-flow`, `complaint-flow` (`decisionBadge` regex) | Covered |
| AC-21 | First message order | `return-flow` (`expectFirstMessageInvariants`) | Order inside the bubble not asserted - manual only (G4): model-dependent layout |
| AC-22 | At least one rule reference | `return-flow`, `complaint-flow`, `date-rule` | Covered |
| AC-23 | Days since purchase computed by system | `date-rule` (rules R-4 / C-2 depend on it) | Manual only (G4): days figure wording depends on the model; rules R-4/C-2 cover the computation |
| AC-24 | Zwrot 0–14 days never rejected for condition | — | Manual only (G4): needs a dedicated real case that costs credits |
| AC-25 | Zwrot > 30 days → Odrzucenie, R-4 | `date-rule` "return 45 days" | Covered; complaint suggestion not asserted |
| AC-26 | Reklamacja > 2 years → Odrzucenie, C-2 | `date-rule` "complaint 800 days" | Covered |
| AC-27 | Unusable / mismatched photo → Weryfikacja ręczna | — | Manual only (G4): no mismatched example photo exists |
| AC-28 | Accept of complaint names remedy | `complaint-flow` (conditional on Akceptacja) | Conditional; passes trivially if Odrzucenie |
| AC-29 | Disclaimer attached to badge | `return-flow`, `complaint-flow`, `date-rule` (exact `pl.disclaimer`) | Attachment to badge not asserted; Manual only (G4): badge attachment and update card |
| AC-30 | Disclaimer added by the app | `expectFirstMessageInvariants` (exact text) | Covered |
| AC-31 | Markdown rendered, no raw formatting | `expectFirstMessageInvariants` (no `**`/`#` in log text) | Manual only (G4): heading and list rendering |
| AC-32 | 1–2000 chars, Enter sends, Shift+Enter newline | `chat` "Enter sends…", "empty message cannot be sent" | Manual only (G4): 2000-char limit (unit-tested) |
| AC-33 | Message immediately shown, input disabled while streaming | `chat` "input is disabled while the reply streams" | Progressive streaming itself not asserted |
| AC-34 | Context: model from the form | `chat` "agent answers a follow-up…" | Covered |
| AC-35 | "Zaktualizowana rekomendacja" update card | — | Manual only (G4): needs a case where the answer changes the decision (model-dependent) |
| AC-36 | Case summary panel visible with current decision | — | Manual only (G4): panel content is checked visually; mobile collapse covered by `responsive-a11y` |
| AC-37 | Chat scrolls to newest message | `chat` "newest message is scrolled into view" | Covered |
| AC-38 | Refresh restores chat | `session` "reload of /chat" | Covered |
| AC-39 | New case: confirm clears, cancel keeps | `session` (cancel, confirm) | Covered |
| AC-40 | No case data stored server-side | — | Manual only (G4): stateless route is a server/integration concern, not E2E |
| AC-41 | Analysis failure: banner, data kept, retry | `failure` project: banner, data kept, retry sends exactly 1 more POST | Covered |
| AC-42 | Chat failure: "Ponów", no duplicate message | `failure` project: error row, Ponów sends exactly 1 more POST, no duplicate message | Covered |
| AC-43 | No technical error details shown | `failure` project | Covered (banner and error row asserted free of status/provider text); mapping itself is unit-tested |
| AC-44 | All UI text Polish | `expectFirstMessageInvariants` (Markdown check only) | Manual only (G4): Polish wording is checked visually; Markdown check only is automated |
| AC-45 | No horizontal scroll at 360 px and 1440 px | `responsive-a11y` (form and chat pages) | Covered |
| AC-46 | Labels, announced errors, keyboard-only completion | `form-validation` "keyboard only"; `responsive-a11y` axe (serious/critical) | Covered |

Brief-listed extras: `responsive-a11y` "mobile: case summary is collapsed by default" (PRD 9.3, mobile project only).

Not covered by E2E, by design: AC-14, AC-40, AC-43 mapping (unit/integration). Rows marked "Manual only (G4)" are re-verified by hand in G4.
