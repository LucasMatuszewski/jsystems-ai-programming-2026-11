# E2E coverage (PRD section 6 acceptance criteria)

All E2E specs run on the `desktop` (1440 px) and `mobile` (360 px) projects against the real stack.
Features are not built yet, so every new test is annotated `test.fail()` (expected failure, see T22/T25 for removal).
`smoke.spec.ts` is unchanged.

| AC | Topic | Covered by | Status |
|---|---|---|---|
| AC-01 | Form fields in order | — | Pending (no spec yet; order is asserted by the keyboard test only in part) |
| AC-02 | Case type radio, no preselection | `return-flow`, `complaint-flow` (selection); `session` (both unchecked after reset) | E2E expected-fail |
| AC-03 | Category select options | `return-flow` (option "Laptop" by label) | E2E expected-fail; full option list pending |
| AC-04 | Model 2–100 chars | `form-validation` (keyboard test fills a valid model) | Model length error not covered yet (pending) |
| AC-05 | Future date / older than 5 years | `form-validation` "future purchase date" | Future covered; "too old" pending |
| AC-06 | Reason optional for Zwrot, required for Reklamacja | `form-validation` "complaint without a reason"; `return-flow` | Required case covered; 2000-char limit and live counter pending |
| AC-07 | One file, JPEG/PNG/WebP, camera on mobile | `form-validation` (accepted file); `responsive-a11y` (mobile) | Camera capture attribute not asserted (pending) |
| AC-08 | Type from content, not extension | `form-validation` "JPEG named .png is accepted" | E2E expected-fail |
| AC-09 | Size > 10 MB and other types rejected | `form-validation` "SVG logo is rejected" | Type covered; 10 MB limit pending (unit: byte counts, no oversized real photo) |
| AC-10 | Thumbnail, file name, "Zmień zdjęcie" | `form-validation` "JPEG named .png is accepted"; "values kept" | E2E expected-fail |
| AC-11 | Consent text, required | `form-validation` "values kept" (consent error) | Exact text not asserted (pending) |
| AC-12 | Errors, focus to first invalid, values kept, no request | `form-validation` "empty submit", "values kept" | E2E expected-fail |
| AC-13 | Submit disabled during submission, no double send | — | Pending (needs real-time check; not in brief) |
| AC-14 | Image reduced before analysis | — | Unit test (image functions); not E2E |
| AC-15 | Return-specific image analysis | `return-flow` (structure only) | Content not asserted by design (structure only) |
| AC-16 | Complaint-specific image analysis | `complaint-flow` (C- rule) | Structure only |
| AC-17 | Form data as context only | — | Pending (model-judgement; eval) |
| AC-18 | Analysis within 90 s | `return-flow` (waitForChat 90 s), TAC-05 | E2E expected-fail |
| AC-19 | Policy per case type | `return-flow`, `complaint-flow`, `date-rule` (R- vs C- rules) | Structure only |
| AC-20 | Decision is one of three values | `return-flow`, `complaint-flow` (`decisionBadge` regex) | E2E expected-fail |
| AC-21 | First message order | `return-flow` (`expectFirstMessageInvariants`) | Order inside the bubble not asserted (pending) |
| AC-22 | At least one rule reference | `return-flow`, `complaint-flow`, `date-rule` | E2E expected-fail |
| AC-23 | Days since purchase computed by system | `date-rule` (rules R-4 / C-2 depend on it) | Days figure text not asserted (pending) |
| AC-24 | Zwrot 0–14 days never rejected for condition | — | Pending (needs a dedicated real case; costs credits) |
| AC-25 | Zwrot > 30 days → Odrzucenie, R-4 | `date-rule` "return 45 days" | E2E expected-fail; complaint suggestion not asserted |
| AC-26 | Reklamacja > 2 years → Odrzucenie, C-2 | `date-rule` "complaint 800 days" | E2E expected-fail |
| AC-27 | Unusable / mismatched photo → Weryfikacja ręczna | — | Pending (needs a mismatched fixture; no such example photo) |
| AC-28 | Accept of complaint names remedy | `complaint-flow` (conditional on Akceptacja) | Conditional; passes trivially if Odrzucenie |
| AC-29 | Disclaimer attached to badge | `return-flow`, `complaint-flow`, `date-rule` (exact `pl.disclaimer`) | Attachment to badge not asserted; updated recommendation pending |
| AC-30 | Disclaimer added by the app | `expectFirstMessageInvariants` (exact text) | E2E expected-fail |
| AC-31 | Markdown rendered, no raw formatting | `expectFirstMessageInvariants` (no `**`/`#` in log text) | Heading and list rendering pending |
| AC-32 | 1–2000 chars, Enter sends, Shift+Enter newline | `chat` "Enter sends…", "empty message cannot be sent" | 2000-char limit pending |
| AC-33 | Message immediately shown, input disabled while streaming | `chat` "input is disabled while the reply streams" | Progressive streaming itself not asserted |
| AC-34 | Context: model from the form | `chat` "agent answers a follow-up…" | E2E expected-fail |
| AC-35 | "Zaktualizowana rekomendacja" update card | — | Pending (needs a case where the answer changes the decision) |
| AC-36 | Case summary panel visible with current decision | — | Pending (mobile collapse covered by `responsive-a11y`) |
| AC-37 | Chat scrolls to newest message | `chat` "newest message is scrolled into view" | E2E expected-fail |
| AC-38 | Refresh restores chat | `session` "reload of /chat" | E2E expected-fail |
| AC-39 | New case: confirm clears, cancel keeps | `session` (cancel, confirm) | E2E expected-fail |
| AC-40 | No case data stored server-side | — | Pending (server/unit test of the stateless route; not E2E) |
| AC-41 | Analysis failure: banner, data kept, retry | — | Pending: needs an invalid key in a dedicated project (ADR 000 §10); not written here |
| AC-42 | Chat failure: "Ponów", no duplicate message | — | Pending: needs a forced failure; no mocking allowed in E2E |
| AC-43 | No technical error details shown | — | Pending (integration test of error mapping) |
| AC-44 | All UI text Polish | `expectFirstMessageInvariants` (Markdown check only) | Language check pending |
| AC-45 | No horizontal scroll at 360 px and 1440 px | `responsive-a11y` (form and chat pages) | E2E expected-fail |
| AC-46 | Labels, announced errors, keyboard-only completion | `form-validation` "keyboard only"; `responsive-a11y` axe (serious/critical) | E2E expected-fail |

Brief-listed extras: `responsive-a11y` "mobile: case summary is collapsed by default" (PRD 9.3, mobile project only).

Not covered by E2E, by design: AC-41 failure project (needs invalid key, not written in this task), AC-14, AC-40, AC-43 (unit/integration).
