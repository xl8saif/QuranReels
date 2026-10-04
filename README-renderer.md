# Waraq Quran Reels Renderer

Minimal Quran recitation renderer: Mushaf page image + recitation + timestamp JSON -> 1920x1080 MP4.

The output uses a black canvas, a subtle blurred page-derived background, centered page imagery, smooth vertical scrolling toward the active line, a gold highlight, and H.264/AAC muxing.

## Ahmad Al-Ajmy

The web app is locked to Ahmad Al-Ajmy (أحمد بن علي العجمي), Hafs, using MP3Quran audio at server10.mp3quran.net/ajm. MP3Quran identifies this read as timing read 5.

## Local renderer

Install FFmpeg separately and ensure `ffmpeg` is on PATH.

```bash
python -m pip install -r requirements.txt
python renderer.py --page-image assets/pages/055-rahman.jpg --audio-file assets/audio/055.mp3 --timestamps-json config/timestamps.sample.json --output output/055-rahman.mp4
```

Timestamp bounding boxes use the coordinate system of the source page image.
