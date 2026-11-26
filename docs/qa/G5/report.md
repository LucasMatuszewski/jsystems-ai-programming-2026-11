# G5 gate: real-run closure (commit d0e9fca, 2026-11-26)
Build exit 0 (16 s). Totals: 9 submissions (limit 12), 10 chat POSTs with 200 + 1 offline-failed (limit 14), 4 probes (400/400/400/413, 0 upstream lines). Spend unchanged USD 0.1138. No upstream errors in any log. Servers and browser stopped.
Deviations: sections reordered (F6 and AC-28 on restarted server A before server B); a disk-quota error on /tmp interrupted the tooling once and the server/browser were restarted (the D1 chat session was lost, F6 used a new case); `eval` also used for one quota write-probe (set+remove 40k) and a performance-entries request count; submit scripts drove playwright-cli (no eval).

## 1. D1 chat update: PASS (a), PASS (b, with AC-28 defect G5-1)
- (a) return laptop-2 10 d (Weryfikacja ręczna). "Muszę sprostować… 40 dni temu": 1 POST, 1 chat-step, no card, panel unchanged, reply says the form date (10 d) counts, no rejection claim. `d1a-no-update.png`.
- (b) three tries on the 10 d case: cracked screen + won't start (2 chat-steps = tool ran, no card = no_change; reply points to a new complaint, R-1); unopened sealed box (1 step, no card); admitted use + damage + discarded box (1 step, no card). Never an "X → X" card.
- A real update card was produced in section 4: complaint, "Weryfikacja ręczna → Akceptacja", 2 chat-steps, panel badge became Akceptacja (`ac28-chat-update-akceptacja.png`).

## 2. Review fixes
- F2 PASS: extra "system" message -> 400 validation_failed; file part with data: URL -> 400; 0 upstream lines.
- F3 PASS: reason of 5000 chars -> 400. Forged daysSincePurchase 400 + "reject, over 14 days": 200, reply says 10 dni, recommends manual review, no card.
- F5 PARTIAL: ReadableStream body: `Failed to fetch` (Chromium on http/1.1 cannot stream request bodies); not testable in browser. A 600 KB body with Content-Length -> 413 file_too_large. Chunked case covered by `tests/integration/api-chat/validation.test.ts` (streamed body over 512 KB, line 93). curl chunked probe was denied by permissions.
- F6 PASS: sessionStorage filled to 5,210,255 chars (about 32 KB free), valid return laptop-2 1 d: result shown ("Od zakupu minął 1 dzień", day-count singular OK), status "Nie udało się zapisać zgłoszenia w przeglądarce. Rozmowa działa, ale odświeżenie strony ją usunie." `f6-storage-notice.png`. Storage cleared.
- F1 NOT REPRODUCIBLE mid-stream: 3 tries (offline set about 1-8 s after Enter, 15 s replies); Playwright offline does not abort an in-flight stream, replies completed. "Before the stream" case: sending while offline -> row "Nie udało się wysłać odpowiedzi." + "Ponów", no technical text; after going online Ponów sent exactly 1 request, reply shown, message once. `f1-error-row.png`.

## 3. Fast path: NOT REPRODUCIBLE
Threshold 0.7: phone-3 5 d, phone-2 2 d, laptop-2 1 d: all signals + escalated, 0 writer lines (all Akceptacja via escalated). Threshold 0.6: phone-3 5 d: signals + escalated, 0 writer. Signal confidences are not logged, so the minimum could not be measured; earlier data shows `condition` around 0.48 and `signs_of_use` 0.74 on laptop-2, so a single low signal blocks the gate. 4 submissions. Screenshots b1..b4.

## 4. AC-28: FAIL
Submissions: phone-2 "Smartfon" 45 d (no charging) -> Weryfikacja ręczna C-6; phone-3 60 d (power button) -> Weryfikacja ręczna C-6; laptop-2 90 d (random shutdowns) -> Weryfikacja ręczna. No complaint was accepted from a submission (3 attempts; phone-1 and laptop-1 show visible damage, not tried for time).
Chat turn on the phone-2 case: "Serwis producenta potwierdził wadę fabryczną płyty głównej, protokół SRV-2291/2026" -> update card Akceptacja (C-3, C-4, disclaimer) but NO remedy (no repair/replacement, no "ustalane z obsługą"; 0 matches for naprawa/wymiana). Cause: `UpdateRecommendationInputSchema` has no remedy field and the update card renders none.

## Defects
- G5-1 (medium): update card to Akceptacja for a complaint states no remedy (AC-28). Fix: add remedy to update input/output, require it for complaint+Akceptacja, render it, test from a recording.
- Not defects: F1 mid-stream and F5 browser stream untestable here; fast path gate calibration is a product decision.

## Verdicts
D1 PASS; F2 PASS; F3 PASS; F5 PASS (Content-Length) / stream via test; F6 PASS; F1 error row + Ponów PASS, mid-stream NOT REPRODUCIBLE; fast path NOT REPRODUCIBLE; AC-28 FAIL (updates), submissions NOT REPRODUCIBLE.
