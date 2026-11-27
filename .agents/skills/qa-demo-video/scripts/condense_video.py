#!/usr/bin/env python3
"""Condense a screen recording: cut static stretches found by ffmpeg freezedetect.

Frozen intervals longer than --min-dur keep --margin seconds at 1x at both ends;
the middle is sped up by --speed, but its visible length is capped at --max-middle
(drop it entirely with --max-middle 0). Everything else stays at 1x.
Stdlib + subprocess only. Writes a cut map JSON (--map) used for chapter timestamps.
"""
import argparse, json, re, subprocess, sys, tempfile, os


def run(cmd, log):
    with open(log, "ab") as f:
        f.write((" ".join(cmd) + "\n").encode())
        r = subprocess.run(["timeout", "10m"] + cmd, stderr=subprocess.PIPE, stdout=f)
    f2 = open(log, "ab"); f2.write(r.stderr[-3000:] if r.returncode else b""); f2.close()
    if r.returncode:
        sys.exit(f"ffmpeg failed ({r.returncode}); see {log}")
    return r.stderr.decode()


def duration(ff, src):
    r = subprocess.run([ff, "-hide_banner", "-i", src], stderr=subprocess.PIPE, text=True)
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])


def detect(ff, src, noise, mind, log):
    err = run([ff, "-hide_banner", "-i", src, "-vf", f"freezedetect=n={noise}dB:d={mind}", "-map", "0:v", "-f", "null", "-"], log)
    open(log, "a").write(err)
    starts = [float(x) for x in re.findall(r"freeze_start: ([\d.]+)", err)]
    ends = [float(x) for x in re.findall(r"freeze_end: ([\d.]+)", err)]
    return starts, ends


def build_map(freezes, dur, mind, margin, speed, maxmid):
    segs, pos = [], 0.0  # (start, end, factor)
    for s, e in freezes:
        if e - s <= mind:
            continue
        mid_s, mid_e = s + margin, e - margin
        if mid_e <= mid_s:
            continue
        segs.append((pos, mid_s, 1.0))
        if maxmid > 0:
            segs.append((mid_s, mid_e, max(speed, (mid_e - mid_s) / maxmid)))
        pos = mid_e
    segs.append((pos, dur, 1.0))
    return [x for x in segs if x[1] - x[0] > 1e-3]


def main():
    a = argparse.ArgumentParser()
    a.add_argument("src"); a.add_argument("dst")
    a.add_argument("--ffmpeg", required=True)
    a.add_argument("--noise", type=float, default=-55, help="freezedetect noise in dB")
    a.add_argument("--min-dur", type=float, default=1.5)
    a.add_argument("--margin", type=float, default=0.6)
    a.add_argument("--speed", type=float, default=12)
    a.add_argument("--max-middle", type=float, default=0.5)
    a.add_argument("--map", default="cutmap.json")
    a.add_argument("--workdir", default="/home/labuser/video-work")
    a = a.parse_args()
    os.makedirs(a.workdir, exist_ok=True)
    log = os.path.join(a.workdir, "condense.log")
    open(log, "w").close()
    dur = duration(a.ffmpeg, a.src)
    st, en = detect(a.ffmpeg, a.src, a.noise, a.min_dur, log)
    if len(en) < len(st):
        en.append(dur)
    freezes = list(zip(st, en))
    segs = build_map(freezes, dur, a.min_dur, a.margin, a.speed, a.max_middle)
    f = []
    n = len(segs)
    f.append(f"[0:v]split={n}" + "".join(f"[s{i}]" for i in range(n)))
    for i, (s, e, k) in enumerate(segs):
        f.append(f"[s{i}]trim=start={s:.3f}:end={e:.3f},setpts=(PTS-STARTPTS)/{k:.4f}[v{i}]")
    f.append("".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0,scale=800:450,format=yuv420p[out]")
    script = os.path.join(a.workdir, "filter.txt")
    open(script, "w").write(";\n".join(f))
    run([a.ffmpeg, "-hide_banner", "-y", "-i", a.src, "-/filter_complex", script, "-map", "[out]", "-an",
         "-c:v", "libx264", "-crf", "23", "-preset", "medium", "-movflags", "+faststart", a.dst], log)
    json.dump({"duration": dur, "freezes": freezes, "segments": segs}, open(a.map, "w"), indent=1)
    removed = dur - sum((e - s) / k for s, e, k in segs)
    print(f"freezes>{a.min_dur}s: {sum(1 for s,e in freezes if e-s>a.min_dur)}, segments: {n}, "
          f"old {dur:.1f}s, expected new {dur-removed:.1f}s, removed {removed:.1f}s")


if __name__ == "__main__":
    main()
