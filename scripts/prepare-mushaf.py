#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/data/mushaf/page-map.json"
SOURCE_URL = "https://qul.tarteel.ai/mushaf_layouts/6"
EXPECTED_PAGES = 610

class RowParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_row = False
        self.current = ""
        self.rows = []

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.in_row = True
            self.current = ""

    def handle_data(self, data):
        if self.in_row:
            self.current += data

    def handle_endtag(self, tag):
        if tag == "tr" and self.in_row:
            self.rows.append([self.current])
            self.in_row = False


# QUL's Mushaf Layout table is the authoritative ayah-range index for the
# Indopak 15-line Qudratullah layout. We intentionally do not estimate page
# boundaries from word volume. The page images remain the existing published
# Qudratullah image source.
ROW_RE = re.compile(
    r'(?P<page>\d+)\s+(?P<from>\d+:\d+)\s+-\s+(?P<to>\d+:\d+)\s+Ready'
    
)


def key(value: str) -> tuple[int, int]:
    surah, ayah = value.split(":")
    return int(surah), int(ayah)


def main() -> None:
    request = Request(
        SOURCE_URL,
        headers={
            "User-Agent": "QuranReels-build/1.0 (+https://github.com/xl8saif/QuranReels)",
            "Accept": "text/html",
        },
    )
    with urlopen(request, timeout=30) as response:
        html = response.read().decode("utf-8", errors="replace")

    parser = RowParser()
    parser.feed(html)
    matches = []
    for cells in parser.rows:
        match = ROW_RE.search(" | ".join(cells))
        if match:
            matches.append(match)
    if len(matches) != EXPECTED_PAGES:
        raise SystemExit(
            f"QUL returned {len(matches)} ready page rows; expected {EXPECTED_PAGES}. "
            "Refusing to build an approximate synchronization map."
        )

    pages = []
    seen = set()
    for match in matches:
        page = int(match.group("page"))
        start = match.group("from")
        end = match.group("to")
        if page in seen:
            raise SystemExit(f"Duplicate QUL page row: {page}")
        seen.add(page)
        if key(start) > key(end):
            raise SystemExit(f"Invalid QUL ayah range on page {page}: {start} - {end}")
        pages.append({
            "page": page,
            "sura": key(start)[0],
            "aya": key(start)[1],
            "from": start,
            "to": end,
        })

    pages.sort(key=lambda item: item["page"])
    if [item["page"] for item in pages] != list(range(1, EXPECTED_PAGES + 1)):
        raise SystemExit("QUL page table is not a contiguous 1..610 sequence.")

    for previous, current in zip(pages, pages[1:]):
        if key(current["from"]) <= key(previous["from"]):
            raise SystemExit(
                f"Non-monotonic QUL page start: page {previous['page']} -> {current['page']}"
            )
        if key(previous["to"]) >= key(current["from"]):
            raise SystemExit(
                f"Overlapping QUL page ranges: page {previous['page']} -> {current['page']}"
            )

    if pages[0]["from"] != "1:1" or pages[-1]["to"] != "114:6":
        raise SystemExit(
            f"Unexpected QUL terminal boundaries: {pages[0]['from']} / {pages[-1]['to']}"
        )

    OUTPUT.write_text(
        json.dumps(
            {
                "source": SOURCE_URL,
                "layout": "Indopak 15 lines - Qudratullah",
                "pages": pages,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Generated exact QUL Qudratullah synchronization map: {EXPECTED_PAGES} pages")
    print(f"Source: {SOURCE_URL}")


if __name__ == "__main__":
    main()
