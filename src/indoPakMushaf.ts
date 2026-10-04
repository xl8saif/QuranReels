const BASE = 'https://sachal2508.github.io/AL-Quran-App-Quran-Images/quran_15line'

// Qudratullah 15-line image repository: 610 Quran pages grouped by Juz.
// Counts are taken from the published image tree: 21, then 20 pages for Juz 2–15,
// 19 for Juz 16, 20 for Juz 17–28, 24 for Juz 29 and 26 for Juz 30.
const JUZ_PAGE_COUNTS = [21, ...Array(14).fill(20), 19, ...Array(12).fill(20), 24, 26]
const JUZ_STARTS = JUZ_PAGE_COUNTS.reduce<number[]>((starts, count, index) => {
  starts.push(index === 0 ? 1 : starts[index - 1] + JUZ_PAGE_COUNTS[index - 1])
  return starts
}, [])

export const INDOPAK_PAGE_COUNT = JUZ_PAGE_COUNTS.reduce((sum, count) => sum + count, 0)

export function indoPakPageImageUrl(page:number){
  const safe = Math.min(INDOPAK_PAGE_COUNT, Math.max(1, Math.floor(page)))
  let juz = JUZ_STARTS.length
  for(let i=0;i<JUZ_STARTS.length;i++){
    const next = JUZ_STARTS[i+1] ?? INDOPAK_PAGE_COUNT + 1
    if(safe >= JUZ_STARTS[i] && safe < next){ juz = i+1; break }
  }
  const localPage = safe - JUZ_STARTS[juz-1] + 1
  return BASE + '/juz_' + juz + '/page_' + localPage + '.jpg'
}

export function loadIndoPakPage(page:number){
  return new Promise<HTMLImageElement>((resolve,reject)=>{
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Indo-Pak Mushaf page ' + page + ' image could not be loaded.'))
    image.src = indoPakPageImageUrl(page)
  })
}
