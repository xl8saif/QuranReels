import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd())
const output = resolve(root, 'public/data/mushaf/page-map.json')
const quranFile = resolve(root, 'public/data/quran/arabic/quran-simple-clean.txt')
const PAGE_COUNT = 610

// The printed Qudratullah image set is 610 pages. The repository also carries
// the complete Quran text locally, so the build never depends on a live API.
// We generate stable first-verse page anchors by balanced word volume. This is
// used only for synchronization; the UI itself always displays the real page image.
const rows = readFileSync(quranFile, 'utf8')
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean)
  .map(line => {
    const match = line.match(/^(\d+)\|(\d+)\|(.*)$/)
    if (!match) return null
    const words = match[3].split(/\s+/).filter(Boolean).length
    return { sura: Number(match[1]), aya: Number(match[2]), words }
  })
  .filter(Boolean)

if (rows.length < 6000) throw new Error(`Bundled Quran text is unexpectedly incomplete: ${rows.length} ayahs`)

const totalWords = rows.reduce((sum, row) => sum + row.words, 0)
const pages = []
let cumulative = 0
let cursor = 0

for (let page = 1; page <= PAGE_COUNT; page++) {
  if (page === 1) {
    pages.push({ page: 1, sura: 1, aya: 1 })
    cumulative += rows[0].words
    cursor = 1
    continue
  }
  if (page === 2) {
    const index = rows.findIndex(row => row.sura === 2 && row.aya === 1)
    pages.push({ page: 2, sura: 2, aya: 1 })
    cumulative = rows.slice(0, index + 1).reduce((sum, row) => sum + row.words, 0)
    cursor = index + 1
    continue
  }

  const target = totalWords * (page - 1) / PAGE_COUNT
  while (cursor < rows.length - 1 && cumulative < target) {
    cumulative += rows[cursor].words
    cursor++
  }
  const row = rows[cursor]
  pages.push({ page, sura: row.sura, aya: row.aya })
}

writeFileSync(output, JSON.stringify(pages, null, 2) + '\n', 'utf8')
console.log(`Generated local 610-page Mushaf synchronization map: ${pages.length} pages from ${rows.length} bundled ayahs`)
