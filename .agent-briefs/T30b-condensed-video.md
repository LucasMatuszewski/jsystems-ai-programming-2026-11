# Brief T30b — A condensed demo video without the static waiting parts

Repo `/home/labuser/jsystems-ai-programming-2026-11`.
- Input: `docs/qa/final/demo.mp4` (H.264, 8:08, 800×450). Keep it unchanged.
- Output: `docs/qa/final/demo-condensed.mp4`, plus `docs/qa/final/demo-condensed-chapters.md`.
- Follow `.claude/rules/long-running-processes.md`: use `timeout` on ffmpeg runs and keep logs.

## Goal
The recording has long stretches where the frame is static because the agent was waiting or thinking between commands. Remove them while keeping:
- the natural speed wherever the picture changes (typing in the form, the progress card, streaming replies, navigation);
- a short margin at the start and end of each static stretch, so the cuts stay readable.

## Method
1. Find the static stretches automatically with ffmpeg's `freezedetect` filter, e.g. `-vf "freezedetect=n=-55dB:d=1.5" -map 0:v -f null -`, parsing `freeze_start` / `freeze_end` from stderr. Tune `n`:
   - the progress-card animation and streaming text must NOT count as frozen;
   - a blinking caret or cursor SHOULD count as frozen.

   Check on a few known segments, e.g. typing near 0:15 and waiting during analysis, using `docs/qa/final/chapters.md`. As a cross-check, look at the per-frame difference (`signalstats`/YDIF or the `select` scene score) and pick thresholds from the data, not by guessing.
2. For each frozen interval longer than 1.5 s:
   - keep the first 0.6 s and the last 0.6 s at normal speed;
   - speed up the middle ×12 with `setpts`, or drop it entirely if the result still shows the stretch is a wait;
   - cap the visible middle at 0.5 s.
3. Keep every non-frozen interval at 1× speed.
4. Build the result in a Python script, `docs/qa/final/tools/condense_video.py`, using stdlib + subprocess only:
   - parameters on the command line (noise, minimum duration, margin, speed factor);
   - `trim` + `setpts` + `concat`, then encode to H.264 (`-crf 23 -preset medium -movflags +faststart`, 800×450, no audio).

   ffmpeg: use the Playwright build at `~/.cache/ms-playwright/ffmpeg-*/ffmpeg-linux` only if it supports these filters. Otherwise use the imageio-ffmpeg binary from the venv in the session scratchpad `/tmp/claude-1000/-home-labuser-jsystems-ai-programming-2026-11/b9124a30-ad4b-4dc6-8704-17d133be039b/scratchpad/` (create the venv there if needed). Never `pip install --user`.
5. Recompute the chapter timestamps for the new video from the cut map, and write them to `demo-condensed-chapters.md`.
6. Verify:
   - the durations before and after;
   - the number of frozen intervals found and how much was removed;
   - extract one frame at each new chapter timestamp to the scratchpad, look at them, and confirm each chapter starts on the right screen;
   - spot-check 3 places where typing or streaming happens and confirm they stay at 1×.

   Put the summary in `docs/qa/final/condense-report.md` (≤ 30 lines), including the exact command used.

## Editable files
`docs/qa/final/demo-condensed.mp4`, `docs/qa/final/demo-condensed-chapters.md`, `docs/qa/final/condense-report.md`, `docs/qa/final/tools/condense_video.py`. Do not change `demo.mp4`.

## Limits
- Whole task: 45 min.
- Each ffmpeg run: `timeout 10m`.
- No commits or `git add`. Do not start app servers; another tester is using port 3000.
- If you cannot write a file, return its content as text.

## Report (≤ 20 lines)
Durations, thresholds chosen and why, frozen intervals, chapter check, files.
