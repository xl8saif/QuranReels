#!/usr/bin/env python3
from __future__ import annotations

import json
import sqlite3
import tempfile
import zipfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DB_ZIP = ROOT / "public/data/mushaf/indopak/qudratullah-indopak-15-lines.db.zip"
WORDS_ZIP = ROOT / "public/data/mushaf/indopak/indopak.json.zip"
QURAN_TEXT = ROOT / "public/data/quran/arabic/quran-simple-clean.txt"
OUTPUT = ROOT / "public/data/mushaf/page-map.json"
EXPECTED_PAGES = 610


def columns(conn: sqlite3.Connection, table: str) -> list[str]:
    return [row[1] for row in conn.execute(f'PRAGMA table_info("{table}")')]


def table_names(conn: sqlite3.Connection) -> list[str]:
    return [row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")]


def find_col(cols: list[str], names: list[str]) -> str | None:
    lowered = {c.lower(): c for c in cols}
    for name in names:
        if name.lower() in lowered:
            return lowered[name.lower()]
    return None


def extract_single_zip(zpath: Path, destination: Path) -> list[Path]:
    if not zpath.exists():
        raise RuntimeError(f"Required QUL asset is missing: {zpath}")
    with zipfile.ZipFile(zpath) as zf:
        zf.extractall(destination)
    return [p for p in destination.rglob("*") if p.is_file()]


def load_word_keys_from_db(db_path: Path) -> dict[int, str] | None:
    conn = sqlite3.connect(db_path)
    try:
        tables = table_names(conn)
        for table in tables:
            cols = columns(conn, table)
            id_col = find_col(cols, ["word_index", "word_id", "id"])
            key_col = find_col(cols, ["word_key", "verse_key", "key"])
            if not id_col or not key_col:
                continue
            rows = conn.execute(
                f'SELECT "{id_col}", "{key_col}" FROM "{table}" '
                f'WHERE "{id_col}" IS NOT NULL AND "{key_col}" IS NOT NULL'
            ).fetchall()
            mapping = {int(i): str(k) for i, k in rows}
            if mapping:
                return mapping
    finally:
        conn.close()
    return None


def walk_word_objects(value: Any):
    if isinstance(value, dict):
        if any(k in value for k in ("word_index", "word_id", "id")) and any(
            k in value for k in ("word_key", "verse_key", "key")
        ):
            yield value
        for child in value.values():
            yield from walk_word_objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_word_objects(child)


def load_word_keys_from_json(files: list[Path]) -> dict[int, str] | None:
    candidates = [p for p in files if p.suffix.lower() == ".json"]
    for path in candidates:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        mapping: dict[int, str] = {}
        for obj in walk_word_objects(data):
            id_value = obj.get("word_index", obj.get("word_id", obj.get("id")))
            key_value = obj.get("word_key", obj.get("verse_key", obj.get("key")))
            try:
                mapping[int(id_value)] = str(key_value)
            except (TypeError, ValueError):
                pass
        if len(mapping) > 10000:
            return mapping
    return None


def load_word_keys_from_bundled_text() -> dict[int, str]:
    # Last-resort compatibility path. This preserves the existing data model,
    # but the normal path uses the QUL word-index data above.
    mapping: dict[int, str] = {}
    word_id = 0
    for raw in QURAN_TEXT.read_text(encoding="utf-8").splitlines():
        parts = raw.strip().split("|", 2)
        if len(parts) != 3:
            continue
        surah, ayah, text = parts
        words = [w for w in text.split() if w]
        for _ in words:
            word_id += 1
            mapping[word_id] = f"{int(surah)}:{int(ayah)}"
    return mapping


def main() -> None:
    if not DB_ZIP.exists():
        raise SystemExit(f"Missing Qudratullah layout database: {DB_ZIP}")

    with tempfile.TemporaryDirectory(prefix="quranreels-mushaf-") as temp:
        root = Path(temp)
        db_files = extract_single_zip(DB_ZIP, root / "db")
        sqlite_files = [p for p in db_files if p.suffix.lower() in (".db", ".sqlite", ".sqlite3")]
        if not sqlite_files:
            raise SystemExit("Qudratullah ZIP contains no SQLite database.")

        db_path = sqlite_files[0]
        conn = sqlite3.connect(db_path)
        try:
            pages_table = None
            for table in table_names(conn):
                cols = columns(conn, table)
                if (
                    find_col(cols, ["page_number", "page"]) and
                    find_col(cols, ["first_word_id"]) and
                    find_col(cols, ["last_word_id"])
                ):
                    pages_table = table
                    break
            if not pages_table:
                raise SystemExit(f"Could not identify QUL pages table. Tables: {table_names(conn)}")

            cols = columns(conn, pages_table)
            page_col = find_col(cols, ["page_number", "page"])
            line_type_col = find_col(cols, ["line_type", "type"])
            first_col = find_col(cols, ["first_word_id"])
            last_col = find_col(cols, ["last_word_id"])

            rows = conn.execute(
                f'SELECT "{page_col}", "{first_col}", "{last_col}"'
                + (f', "{line_type_col}"' if line_type_col else "")
                + f' FROM "{pages_table}" ORDER BY "{page_col}"'
            ).fetchall()
        finally:
            conn.close()

        page_words: dict[int, tuple[int, int]] = {}
        for row in rows:
            page = int(row[0])
            first = row[1]
            last = row[2]
            line_type = str(row[3]).lower() if line_type_col else "ayah"
            if line_type != "ayah" or first is None or last is None:
                continue
            first_i, last_i = int(first), int(last)
            current = page_words.get(page)
            if current is None:
                page_words[page] = (first_i, last_i)
            else:
                page_words[page] = (min(current[0], first_i), max(current[1], last_i))

        if len(page_words) != EXPECTED_PAGES:
            raise SystemExit(
                f"Qudratullah page table produced {len(page_words)} pages; expected {EXPECTED_PAGES}."
            )

        word_keys = load_word_keys_from_db(db_path)
        source = "QUL SQLite word table"
        if not word_keys:
            word_files = extract_single_zip(WORDS_ZIP, root / "words")
            word_keys = load_word_keys_from_json(word_files)
            source = "QUL IndoPak word JSON"
        if not word_keys:
            word_keys = load_word_keys_from_bundled_text()
            source = "bundled Quran text fallback"

        page_map = []
        for page in range(1, EXPECTED_PAGES + 1):
            first_id, last_id = page_words[page]
            first_key = word_keys.get(first_id)
            last_key = word_keys.get(last_id)
            if not first_key or not last_key:
                raise SystemExit(
                    f"Missing verse key for page {page}: word IDs {first_id}-{last_id}. "
                    f"Word-index source: {source}"
                )
            page_map.append({
                "page": page,
                "sura": int(first_key.split(":")[0]),
                "aya": int(first_key.split(":")[1]),
                "last_sura": int(last_key.split(":")[0]),
                "last_aya": int(last_key.split(":")[1]),
            })

        # Validate monotonicity and terminal coverage.
        def key(item):
            return (item["sura"], item["aya"])
        for previous, current in zip(page_map, page_map[1:]):
            if key(current) <= key(previous):
                raise SystemExit(f"Non-monotonic QUL page boundary between {previous} and {current}.")
        if page_map[0]["sura"] != 1 or page_map[0]["aya"] != 1:
            raise SystemExit(f"Unexpected first QUL boundary: {page_map[0]}")
        if page_map[-1]["last_sura"] != 114:
            raise SystemExit(f"Unexpected final QUL boundary: {page_map[-1]}")

        OUTPUT.write_text(json.dumps(page_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Generated exact Qudratullah 15-line page map: {EXPECTED_PAGES} pages")
        print(f"Boundary source: {source}")
        print(f"Layout database: {DB_ZIP.name}")


if __name__ == "__main__":
    main()
