# Brief T30 — Demo video and PR description draft

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`, commit f68fa5a. Read:
- `app/AGENTS.md` and `.claude/rules/long-running-processes.md` (mandatory);
- the T30 row in `docs/plans/decision-copilot-poc-implementation-plan.md`;
- `playwright-cli --help` (the video commands).

## 1. Demo video `docs/qa/final/demo.mp4`
- Start your own server with `pnpm start` after `timeout 5m pnpm build`, with its log in `docs/qa/final/server.log`.
- Use `playwright-cli` at 1440×900 and record with its `video-*` commands. Drive it interactively, one command at a time, with short pauses so a viewer can follow. Chapters:
  1. the empty form;
  2. a return (laptop-2.webp, 10 days): progress, then the first decision with the day count in Uzasadnienie;
  3. a chat turn that adds a new relevant fact, showing the update card if the model gives one (record what happens; at most 2 tries);
  4. a refresh: identical, no requests;
  5. "Nowe zgłoszenie": cancel, then confirm;
  6. a complaint (phone-1.jpg, about 400 days) with its decision;
  7. a short 360 px mobile view of the chat.
- Convert to H.264 MP4 of at most 10 MB. Install ffmpeg with `pip install --user imageio-ffmpeg` if it is missing, and use the binary from `imageio_ffmpeg.get_ffmpeg_exe()`.
- Write `docs/qa/final/chapters.md` with timestamps.
- Leave raw recordings out of the repo: move them to `/tmp/claude-1000/-home-labuser-jsystems-ai-programming-2026-11/b9124a30-ad4b-4dc6-8704-17d133be039b/scratchpad/` (`mv`, not `rm`).
- At most 4 submissions and 4 chat turns. Run `openrouter:status` before and after, and append a row to `docs/qa/spend.md`.

## 2. PR description draft `docs/qa/final/pr-body.md`
- Scope, a short summary per phase.
- AC coverage: automated (E2E/COVERAGE.md) vs manual (the G2/G3/G4 reports), and the gaps (AC-07 camera, AC-28 never exercised).
- Test counts: unit 653, E2E desktop+failure 29, E2E mobile 27.
- Links to the gate reports `docs/qa/G1..G4`, T28 `review.md`, and T29.
- 2–3 screenshots (repo paths), the video path, and the total spend from `docs/qa/spend.md`.
- Last line: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Time limits
- Whole task: 60 min.
- Build: 5 min.
- Conversion: 10 min.
- Report overruns. Never wait on a process by matching its command line.
- Stop the server and the browser at the end.

## Forbidden
No commits, `git add` or pushes. Never read `.env*`. No app code changes.

## Report (≤ 20 lines)
Video size and duration, the chapters, what the model did, spend, and the files.
