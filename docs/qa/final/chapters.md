# Demo video chapters (`demo.mp4`)

H.264, 800x450, 25 fps, no audio, 8:08, 1.8 MB. Recorded with `playwright-cli video-*` at 1440x900 against `pnpm start` (commit f68fa5a, log in `server.log`). The recorder scales the frame to 800x450. The mobile chapter shows the 360 px layout in the left part of the frame.
Timestamps are approximate (+/- 5 s, derived from wall-clock times of the chapter commands; the mobile start was checked on frames).

| Time | Chapter | What happens |
|---|---|---|
| 0:00 | 1. Empty form | Home page, no preselected case type |
| 0:15 | 2. Return: laptop, 10 days | Fills the form (laptop-2.webp, purchase 16.11.2026), submits, progress card, then Weryfikacja ręczna; "Uzasadnienie" starts with "Od zakupu minęło 10 dni." |
| 1:40 | 3. Chat: new fact | Two turns: complete original packaging (answered, no change) and a cracked screen after a fall (answered, recommendation kept). No "Zaktualizowana rekomendacja" card appeared in either turn |
| 3:24 | 4. Refresh | Page reload: identical chat and panel, 0 `/api` requests after reload |
| 3:41 | 5. Nowe zgłoszenie | Dialog opened, "Anuluj" keeps the chat; opened again, "Rozpocznij nowe" returns to the empty form |
| 5:11 | 6. Complaint: smartphone, 400 days | Form (phone-1.jpg, purchase 22.10.2025). A first submit without the case type shows the validation error (no request); after selecting Reklamacja it submits. Decision: Weryfikacja ręczna (C-3, C-5, C-6), 400 days in "Uzasadnienie" |
| 7:45 | 7. Mobile 360 px | Chat of the complaint at 360 px width, scrolled |
