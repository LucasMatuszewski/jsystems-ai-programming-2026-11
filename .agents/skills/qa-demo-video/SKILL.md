---
name: qa-demo-video
description: >-
  Record a demo video of the final manual QA pass with playwright-cli, condense
  the static waiting stretches automatically, and add it with screenshots to
  the PR description. Use as the last QA step before a feature is "done",
  after all gates pass, or when asked for a demo or walkthrough video.
---

# QA demo video

Record a final, accepted version of the app, not one still being fixed. The video is evidence for reviewers: show the happy paths **and** the error states.

## 1. Plan the chapters (write them down before recording)
Cover each flow the change touches. For a form-and-chat app, for example:
1. The empty form.
2. **Error states:**
   - an empty submit (errors under the fields, focus on the first invalid field);
   - invalid values (too short, a future date, a wrong file type, a file over the size limit);
   - values kept after an error.
3. The main happy path (fill → progress → result).
4. The secondary path (e.g. a complaint vs a return).
5. Interaction (a chat turn, an update card).
6. Persistence (refresh: identical, 0 requests).
7. Reset (the new-case dialog: cancel, then confirm).
8. **A failure state:** the upstream error banner and retry. Use a second server with an invalid key, never a mock.
9. Mobile width (e.g. 360 px).

Show a short title card or caption at each chapter start, so the chapters can be checked later from frames.

## 2. Record
- Start your own production server with its output in a log file. Follow `.claude/rules/long-running-processes.md`: a timeout per command, a log, and "report, don't wait".
- Run `playwright-cli` at 1440×900. Use `video-start` before the first chapter and `video-stop` at the end (check `playwright-cli --help` for the exact commands).
- Drive it interactively, one command at a time. Pauses are fine; step 3 removes them.
- Budget real model calls: count the submissions and chat turns, and log the spend.
- Keep raw recordings out of the repo, in the scratchpad or on a large disk. `/tmp` may be a small RAM tmpfs: never write raw frame dumps, and stream frames through a pipe instead.

## 3. Condense the waits (`scripts/condense_video.py`)
The agent's thinking time leaves long static stretches. Use `freezedetect` to find them:
- keep a short margin at 1× at both ends of each stretch;
- speed up the middle, with a cap on its visible length;
- keep every changing segment (typing, progress, streaming) at 1×.

```bash
python3 scripts/condense_video.py raw.mp4 docs/qa/final/demo-condensed.mp4 \
  --ffmpeg <ffmpeg with freezedetect+libx264> --noise -55 --min-dur 1.5 \
  --margin 0.6 --speed 12 --max-middle 0.5 --map <workdir>/cutmap.json
```

- **ffmpeg:** the Playwright ffmpeg build lacks `freezedetect` and libx264. Use the imageio-ffmpeg binary from a venv (`python3 -m venv <dir>; <dir>/bin/pip install imageio-ffmpeg`; then `imageio_ffmpeg.get_ffmpeg_exe()`). Do not use `pip install --user` (PEP 668).
- **Thresholds:** check them against the data rather than guessing. The per-frame luma difference (`signalstats` YDIF) is usually bimodal:
  - idle frames are below 0.01;
  - real motion is above 1;
  - a blinking caret or cursor sits in between, in short bursts.

  `-55 dB` (≈ 0.45 mean difference) separates idle frames from motion. Confirm that the maximum difference inside the cut middles stays below real motion.
- **Chapters:** recompute the timestamps from the cut map. Extract one frame at each new chapter time and look at it, to confirm the right title card or screen.
- **Spot checks:** confirm 2–3 segments with typing or streaming stay at 1×.
- **Size:** H.264, `-crf 23 -movflags +faststart`, under 10 MB. Keep the original recording next to the condensed one until the owner accepts the result.

## 4. Put it in the PR
- Commit `docs/qa/final/demo-condensed.mp4`, its chapters file, and 3–6 screenshots: the happy path result, the error states, the failure banner, and mobile.
- In the PR description:
  - a "Demo" section with the video path and the chapter table;
  - the screenshots as images;
  - a note that GitHub plays the video inline only when it is dragged into the description, otherwise a link to the committed file.
- State what the video does not show, for example states the model never produced.
