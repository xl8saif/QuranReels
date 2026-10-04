#!/usr/bin/env python3
"""Generate a Quran recitation video from a Mushaf page image and timing JSON."""
from __future__ import annotations
import argparse, json, math, subprocess
from pathlib import Path
from typing import Any
import ffmpeg
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

WIDTH, HEIGHT, FPS = 1920, 1080, 30
GOLD, GOLD_ALPHA = (255, 215, 0), 64

def load_timestamps(path: Path) -> list[dict[str, Any]]:
    rows = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        raise ValueError("timestamps_json must contain a JSON array")
    clean = []
    for row in rows:
        if not isinstance(row, dict) or not all(k in row for k in ("line_number","start_time","end_time")):
            continue
        box = row.get("bounding_box") or {}
        start, end = float(row["start_time"]), float(row["end_time"])
        clean.append({
            "line_number": int(row["line_number"]),
            "start_time": max(0.0, start),
            "end_time": max(start, end),
            "bounding_box": {k: float(box.get(k, 0)) for k in ("x","y","width","height")}
        })
    clean.sort(key=lambda x: (x["start_time"], x["line_number"]))
    if not clean: raise ValueError("No usable timestamp rows were found")
    return clean

def active_row(rows, seconds):
    for row in rows:
        if row["start_time"] <= seconds < row["end_time"]: return row
    return rows[-1] if seconds >= rows[-1]["end_time"] else rows[0]

def audio_duration(path: Path) -> float:
    probe = ffmpeg.probe(str(path))
    values = [float(s["duration"]) for s in probe.get("streams", []) if s.get("duration")]
    if not values: raise RuntimeError("Could not determine audio duration")
    return max(values)

def prepare_page(page: Image.Image, max_width=1000):
    page = page.convert("RGB")
    scale = min(1.0, max_width / page.width)
    if scale != 1:
        page = page.resize((round(page.width*scale), round(page.height*scale)), Image.Resampling.LANCZOS)
    return page, scale

def render_frame(page, scale, row, scroll_y):
    canvas = Image.new("RGB", (WIDTH, HEIGHT), "black")
    bg = page.copy()
    bg.thumbnail((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    bg = bg.resize((WIDTH, HEIGHT), Image.Resampling.BILINEAR).filter(ImageFilter.GaussianBlur(28))
    canvas.paste(Image.blend(Image.new("RGB", bg.size, "black"), bg, 0.16), (0,0))
    page_x = (WIDTH - page.width)//2
    max_scroll = max(0, page.height-HEIGHT)
    scroll_y = max(0, min(max_scroll, scroll_y))
    crop_h = min(HEIGHT, page.height)
    crop = page.crop((0, round(scroll_y), page.width, round(scroll_y)+crop_h))
    crop_y = max(0, (HEIGHT-crop.height)//2)
    canvas.paste(crop, (page_x, crop_y))
    if row:
        b = row["bounding_box"]
        x, y = page_x+b["x"]*scale, crop_y+b["y"]*scale-scroll_y
        w, h = b["width"]*scale, b["height"]*scale
        if w > 0 and h > 0 and y+h >= 0 and y <= HEIGHT:
            overlay = Image.new("RGBA", canvas.size, (0,0,0,0))
            d = ImageDraw.Draw(overlay)
            d.rounded_rectangle((x,y,x+w,y+h), radius=max(5,int(h*.12)),
                                fill=(*GOLD,GOLD_ALPHA), outline=(*GOLD,170),
                                width=max(2,round(h*.035)))
            canvas = Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB")
    return np.asarray(canvas, dtype=np.uint8)

def generate_video(page_image, audio_file, timestamps_json, output, fps=FPS):
    page, scale = prepare_page(Image.open(page_image))
    rows, duration = load_timestamps(timestamps_json), audio_duration(audio_file)
    max_scroll, current_scroll = max(0, page.height-HEIGHT), 0.0
    def target(row):
        if not row: return current_scroll
        b = row["bounding_box"]
        center = (b["y"] + b["height"]/2) * scale
        return max(0, min(max_scroll, center-HEIGHT*.45))
    video = ffmpeg.input("pipe:", format="rawvideo", pix_fmt="rgb24",
                         s=f"{WIDTH}x{HEIGHT}", r=fps)
    audio = ffmpeg.input(str(audio_file))
    process = ffmpeg.output(video, audio, str(output), vcodec="libx264",
                            acodec="aac", pix_fmt="yuv420p", r=fps,
                            video_bitrate="8M", audio_bitrate="192k",
                            movflags="+faststart", t=max(duration,.01)).overwrite_output().run_async(pipe_stdin=True, pipe_stderr=True)
    try:
        for i in range(math.ceil(duration*fps)):
            row = active_row(rows, i/fps)
            target_y = target(row)
            alpha = 1-math.exp(-8/fps)
            current_scroll += (target_y-current_scroll)*alpha
            process.stdin.write(render_frame(page, scale, row, current_scroll).tobytes())
        process.stdin.close()
        stderr = process.stderr.read().decode("utf-8", errors="replace")
        code = process.wait()
        if code: raise RuntimeError(f"FFmpeg failed ({code}): {stderr[-4000:]}")
    except Exception:
        try: process.stdin.close()
        except Exception: pass
        process.kill(); process.wait()
        raise

def main():
    p = argparse.ArgumentParser(description="Render a Quran recitation video.")
    p.add_argument("--page-image", required=True, type=Path)
    p.add_argument("--audio-file", required=True, type=Path)
    p.add_argument("--timestamps-json", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--fps", type=int, choices=(30,60), default=30)
    a = p.parse_args(); a.output.parent.mkdir(parents=True, exist_ok=True)
    generate_video(a.page_image, a.audio_file, a.timestamps_json, a.output, a.fps)
    print(f"Created: {a.output}")

if __name__ == "__main__": main()
