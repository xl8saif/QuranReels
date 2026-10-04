const BASE = 'https://raw.githubusercontent.com/Sachal2508/AL-Quran-App-Quran-Images/main/quran_15line'

// Standard 604-page sequence used by the current QuranReels page map.
const JUZ_STARTS = [1,22,42,62,82,102,122,142,162,182,202,222,242,262,282,302,322,342,362,382,402,422,442,462,482,502,522,542,562,582]

export function indoPakPageImageUrl(page:number){
  const safe = Math.min(604, Math.max(1, Math.floor(page)))
  let juz = 30
  for(let i=0;i<JUZ_STARTS.length;i++){
    const next = JUZ_STARTS[i+1] ?? 605
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