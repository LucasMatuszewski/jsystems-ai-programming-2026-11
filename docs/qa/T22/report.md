# T22 manual QA: form -> progress -> /chat (2026-11-26)

Server: `pnpm build` then `pnpm start` (started by hand, log in `server.log`, stopped afterwards). Browser: playwright-cli.

## Flow (desktop 1440x900)
1. `/` shows H1 "Zgłoś zwrot lub reklamację", intro and the form; tab title as specified.
2. Return case, Laptop, "Lenovo ThinkPad X1", purchase date 10 days ago, `assets/example-images/laptop-2.webp`, consent, submit.
3. Progress texts shown while waiting (`progress.png`), then `/chat` (URL polled: `/` ... `/chat`).
4. `/chat`: summary panel (left) + log (right): greeting, decision card "Weryfikacja ręczna" + R-2 + disclaimer, body. Screenshot `chat-desktop.png`.
5. Reload: same URL and same message text (log 972 characters before and after).
6. 360x780: collapsed summary (case type + badge) above the conversation (`chat-mobile.png`).
7. "Nowe zgłoszenie": dialog opens; "Anuluj" keeps /chat; "Rozpocznij nowe" returns to an empty form at `/` (sessionStorage empty).

## Counts
- Console: 0 errors, 0 warnings.
- `POST /api/cases`: 1 for the one submission; server log: 1 incoming, 2 upstream lines (signals + escalated).

## Notes
- Chat input is absent by design (T25).
- Not compared pixel by pixel against `assets/homepage.png`; colors, fonts and bubble style match the tokens visually.
