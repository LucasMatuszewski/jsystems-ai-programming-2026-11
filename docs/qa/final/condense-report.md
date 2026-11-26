# Condensed demo video report (T30b)

- Input `demo.mp4` (unchanged): 8:07.6 (487.6 s), 12191 frames. Output `demo-condensed.mp4`: 2:24.96 (1.4 MB), H.264 800x450 25 fps, no audio.
- Removed 342.7 s (70%). 61 frozen intervals found (434.3 s in total); each keeps 0.6 s at 1x at both ends, middle sped up x12 (visible middle capped at 0.5 s).
- Tool: `docs/qa/final/tools/condense_video.py` (stdlib + subprocess). ffmpeg: the Playwright build lacks freezedetect/libx264, so the imageio-ffmpeg 9.0.2 binary from the scratchpad venv was used. Logs and filter graph: `/home/labuser/video-work/` (`condense.log`, `filter.txt`, `cutmap.json`).
- Command (ffmpeg paths shortened as `$S` = scratchpad dir):
  `python3 tools/condense_video.py demo.mp4 demo-condensed.mp4 --ffmpeg $S/venv/lib/python3.14/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 --noise -55 --min-dur 1.5 --margin 0.6 --speed 12 --max-middle 0.5 --map /home/labuser/video-work/cutmap.json`
- Threshold choice: freezedetect `n=-55dB` is a mean luma difference of about 0.45 (0-255). Per-frame difference (signalstats YDIF, and a separate 160x90 gray stream) is bimodal: about 9,600 frames are below 0.01, about 1,660 above 1, and only about 870 frames lie between 0.01 and 0.5, in bursts under 0.8 s (caret blinks, cursor). So -55 dB sits above the idle noise and well below real motion; the maximum difference inside all cut middles is 0.43.
- 350-400 s question: signalstats showed 9.7 spikes every 0.3 s on a static form; the 160x90 stream shows only isolated 0.2-0.35 blips and no text or layout change (the form is a filled smartphone complaint with the cursor on "Wyslij"). Treated as frozen, one interval 350.8-400.4 s, reduced to 0.5 s + margins.
- Typing, progress card, streaming and navigation stay at 1x: no cut interval contains motion above the threshold. Spot checks: 16-27 s (form typing) is one 1x segment; 100-105 s (chat reply) 1x; 312-313 s (validation error) bracketed by 1x margins.
- Chapters: frames extracted at each new chapter timestamp (+0.8 s) show the right title card and screen for all 7 chapters (see `demo-condensed-chapters.md`).
- Not done: no subjective review of the 0.6 s margin readability beyond the chapter frames.
