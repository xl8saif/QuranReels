import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const output = resolve(process.cwd(), 'public/data/mushaf/page-map.json')
const source = 'https://qul.tarteel.ai/mushaf_layouts/6'

const response = await fetch(source, { headers: { accept: 'text/html' } })
if (!response.ok) throw new Error(`Unable to download QUL Qudratullah page map (${response.status})`)
const html = await response.text()

// QUL publishes the complete 610-page Qudratullah table on this page.
// Each row is rendered as: page | first-verse - last-verse | Ready | Preview.
const pattern = /\|\s*(\d+)\s*\|\s*(\d+):(\d+)\s*-\s*(\d+):(\d+)\s*\|\s*Ready\s*\|/g
const pages = []
let match
while ((match = pattern.exec(html)) !== null) {
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
  throw new Error(`Invalid QUL Qudratullah page map: expected 610 sequential pages, found ${pages.length}`)
}

writeFileSync(output, JSON.stringify(pages, null, 2) + '\\n', 'utf8')
console.log(`Generated verified Qudratullah 15-line Mushaf page map: ${pages.length} pages`)
