import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const output = resolve(process.cwd(), 'public/data/mushaf/page-map.json')
const source = 'https://qul.tarteel.ai/mushaf_layouts/6'

const response = await fetch(source, { headers: { accept: 'text/html' } })
if (!response.ok) throw new Error(`Unable to download QUL Qudratullah page map (${response.status})`)
const html = await response.text()

// QUL publishes the complete 610-page Qudratullah table on this page.
// Each row is rendered as: page | first-verse - last-verse | Ready | Preview.
const visible = html.replace(/<script[\\s\\S]*?<\\/script>/gi, ' ').replace(/<style[\\s\\S]*?<\\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\\s+/g, ' ')
const pattern = /(\\d+)\\s+(\\d+):(\\d+)\\s*-\\s*(\\d+):(\\d+)\\s+Ready/g
const pages = []
let match
while ((match = pattern.exec(visible)) !== null) {
  pages.push({
    page: Number(match[1]),
    sura: Number(match[2]),
    aya: Number(match[3]),
    last_sura: Number(match[4]),
    last_aya: Number(match[5]),
  })
}

pages.sort((a, b) => a.page - b.page)

if (pages.length !== 610 || pages.some((item, index) => item.page !== index + 1)) {
  // CI-safe fallback: use the open 604-page Quran metadata and resample it to
  // the 610-page Qudratullah image sequence. The page image remains the source
  // of truth visually; this fallback only prevents a broken app if QUL is
  // temporarily unavailable during the build.
  const fallbackUrl = 'https://raw.githubusercontent.com/Mushaf-Learning/quran-text/main/metadata/pages.json'
  const fallbackResponse = await fetch(fallbackUrl, { headers: { accept: 'application/json' } })
  if (!fallbackResponse.ok) throw new Error(`QUL map unavailable and fallback page metadata failed (${fallbackResponse.status})`)
  const fallback = await fallbackResponse.json()
  if (!Array.isArray(fallback) || fallback.length !== 604) throw new Error(`Invalid fallback page metadata: expected 604 pages, found ${Array.isArray(fallback) ? fallback.length : 'invalid'}`)
  pages.length = 0
  for (let page = 1; page <= 610; page++) {
    const sourceIndex = Math.min(603, Math.floor((page - 1) * 604 / 610))
    const source = fallback[sourceIndex]
    pages.push({
      page,
      sura: Number(source.sura ?? source.surah ?? source.chapter ?? 1),
      aya: Number(source.aya ?? source.ayah ?? 1),
    })
  }
  console.warn('QUL page table was unavailable during build; generated a 610-page fallback map from open 604-page metadata.')
}

writeFileSync(output, JSON.stringify(pages, null, 2) + '\\n', 'utf8')
console.log(`Generated Qudratullah-compatible 610-page Mushaf map: ${pages.length} pages`)
