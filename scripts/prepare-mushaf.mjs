import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(process.cwd())
const output = resolve(root, 'public/data/mushaf/page-map.json')
const archive = resolve(root, 'public/data/mushaf/indopak/qudratullah-indopak-15-lines.db.zip')

if (!existsSync(archive)) throw new Error(`Qudratullah Mushaf layout archive is missing: ${archive}`)
mkdirSync(dirname(output), { recursive: true })

const python = String.raw`import json, os, sqlite3, sys, tempfile, zipfile
archive, output = sys.argv[1], sys.argv[2]
with tempfile.TemporaryDirectory() as td:
    with zipfile.ZipFile(archive) as z:
        names = [n for n in z.namelist() if n.lower().endswith('.db')]
        if not names: raise SystemExit('No SQLite database found in Mushaf archive')
        z.extract(names[0], td)
        db = os.path.join(td, names[0])
    con = sqlite3.connect(db)
    try:
        tables = {row[0] for row in con.execute("select name from sqlite_master where type='table'")}
        if 'pages' not in tables or 'words' not in tables: raise SystemExit('Qudratullah database must contain pages and words tables')
        page_rows = con.execute("select distinct page_number from pages order by page_number").fetchall()
        result=[]
        for (page,) in page_rows:
            ids = con.execute("select first_word_id,last_word_id from pages where page_number=? and line_type='ayah' and first_word_id is not null and last_word_id is not null order by line_number", (page,)).fetchall()
            if not ids: continue
            first_id=min(int(r[0]) for r in ids); last_id=max(int(r[1]) for r in ids)
            first = con.execute("select word_key from words where word_index=?", (first_id,)).fetchone()
            last = con.execute("select word_key from words where word_index=?", (last_id,)).fetchone()
            if not first or not last: raise SystemExit(f'Missing word boundary for page {page}: {first_id}-{last_id}')
            fs,fa=map(int,str(first[0]).split(':')[:2]); ls,la=map(int,str(last[0]).split(':')[:2])
            result.append({'page':int(page),'sura':fs,'aya':fa,'last_sura':ls,'last_aya':la})
        if len(result) != 610: raise SystemExit(f'Expected 610 Qudratullah pages, found {len(result)}')
        # mushafApi needs the first verse of each page; keep last boundary metadata for validation/debugging.
        with open(output,'w',encoding='utf-8') as f: json.dump(result,f,ensure_ascii=False,indent=2); f.write('\\n')
    finally: con.close()
`;

const result = spawnSync('python3', ['-c', python, archive, output], { stdio: 'inherit' })
if (result.status !== 0) process.exit(result.status ?? 1)
console.log('Generated verified Qudratullah 15-line Mushaf page map: 610 pages')
