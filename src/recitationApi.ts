import type { ChapterAudioTiming } from './recitationTiming'

export type QuranApiCredentials = { accessToken?: string; clientId?: string }
export type Reciter = { id: number; reciter_id?: number; reciter_name?: string; name?: string; arabic_name?: string; style?: string; translated_name?: { name?: string } }
export type ChapterRecitation = { id: number; reciter_id?: number; reciter_name?: string; name?: string; style?: string; chapter_number?: number }
export type ChapterAudio = ChapterAudioTiming

type PublicReciter = Reciter & { path: string; fallbackPaths?: string[] }

const AHMAD_AL_AJMY: PublicReciter = {
  id: 5,
  reciter_id: 5,
  reciter_name: 'Ahmad Al-Ajmy',
  name: 'Ahmad Al-Ajmy',
  arabic_name: 'أحمد بن علي العجمي',
  style: 'Murattal · Hafs An Asim',
  path: 'https://server10.mp3quran.net/ajm',
}

const AJMY_TIMING_API = 'https://mp3quran.net/api/v3/ayat_timing'
let timingCache = new Map<number, ChapterAudioTiming['timestamps']>()

export async function fetchChapterRecitations(_credentials?: QuranApiCredentials): Promise<{ recitations: Reciter[] }> {
  const { path: _path, fallbackPaths: _fallback, ...reciter } = AHMAD_AL_AJMY
  return { recitations: [reciter] }
}

export async function fetchChapterAudio(reciterId: number, chapterNumber: number, _credentials?: QuranApiCredentials, _includeSegments = true): Promise<ChapterAudio> {
  if (reciterId !== AHMAD_AL_AJMY.id) throw new Error('Only Ahmad Al-Ajmy recitation is enabled.')
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1 || chapterNumber > 114) throw new Error('Invalid Surah number.')

  let timestamps = timingCache.get(chapterNumber)
  if (!timestamps) {
    const response = await fetch(`${AJMY_TIMING_API}?surah=${chapterNumber}&read=5`, { headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`Unable to load Ahmad Al-Ajmy timestamps (${response.status}).`)
    const rows = await response.json() as Array<{ ayah:number; start_time:number; end_time:number }>
    timestamps = rows
      .filter(row => Number(row.ayah) > 0)
      .map(row => ({
        verseKey: `${chapterNumber}:${Number(row.ayah)}`,
        startMs: Number(row.start_time ?? 0),
        endMs: Number(row.end_time ?? 0),
      }))
    timingCache.set(chapterNumber, timestamps)
  }

  const file = `${String(chapterNumber).padStart(3, '0')}.mp3`
  return {
    audioUrl: `${AHMAD_AL_AJMY.path}/${file}`,
    timestamps,
  }
}
