# G5b gate: re-check of G5-1 (remedy on chat update cards, AC-28)

Setup: `pnpm build` OK (exit 0, `build.log`); `pnpm start` ready in under 10 s (`server.log`); playwright-cli 1440x900, no eval, no mocking.

| # | Case | Result | POST /api/chat | chat-step lines |
|---|------|--------|----------------|-----------------|
| 1 | Complaint, Laptop/"Laptop", laptop-2.webp, 2026-08-28 (90 d). First attempt had the "Reklamacja" radio unselected (client validation, no POST); resubmitted | Weryfikacja ręczna (signals + escalated, 1 POST /api/cases) | - | - |
| 2 | Chat: "Serwis producenta potwierdził wadę fabryczną płyty głównej, protokół SRV-2291/2026. Urządzenie nie było uszkodzone mechanicznie." | Update card shown | 1 (200) | 2 (2224 ms, 1329 ms; tool ran) |

Update card (`02-update-card.png`): "Zaktualizowana rekomendacja", badge Akceptacja, "Weryfikacja ręczna → Akceptacja", reason, rule refs C-3, C-4, C-7, **remedy "Naprawa"**, disclaimer (preliminary, final decision by customer service). Reply text: "Rekomendujemy naprawę jako pierwszy środek". Panel badge updated to Akceptacja. Console: 0 errors, 0 warnings.

Submissions: 1 of 4; chat turns: 1 of 5.

## Verdict: PASS (G5-1 fixed in the real app)
AC-35 and AC-28 observed live on an update card: decision change with a remedy.

## Observations (not defects)
- The remedy chip is just "Naprawa"; the "final remedy agreed with customer service" wording comes from the generic disclaimer, not a remedy-specific line. Matches the DecisionCard behaviour of the original result card; confirm against AC-28 wording if stricter text is wanted.
- Defects: none new.
