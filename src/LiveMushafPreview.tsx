import React from 'react'
import { mushafStyles, type MushafStyleId } from './mushafStyles'
import { fetchChapterPages, fetchPage, type ApiVerse } from './mushafApi'
import { createExportCompositor } from './exportCompositor'
import { LiveRecitationControls } from './LiveRecitationControls'
import { cacheQuranPage, getCachedQuranPage, quranPageCacheKey } from './quranLocalCache'

type Props = {
  styleId: MushafStyleId
  page: number
  chapterNumber?: number
  highlight: string
  showFinger?: boolean
  autoScroll?: boolean
  scrollSpeed?: number
  onStatus?: (message: string) => void
  exportCanvasRef?: React.RefObject<HTMLCanvasElement | null>
}

type Word = { verseKey: string; position: number; text: string }
type Line = [number, Word[]]

const quranFont = (styleId: MushafStyleId) =>
  (mushafStyles.find(style => style.id === styleId)?.fontFamily || 'Amiri Quran, serif').split(',')[0].trim()

function verseNumber(key: string) {
  const [sura, ayah] = key.split(':').map(Number)
  return (sura || 0) * 1000 + (ayah || 0)
}

function wordsForVerse(verse: ApiVerse, styleId: MushafStyleId): Word[] {
  return (verse.words || [])
    .map(word => {
      const text = styleId === 'indo-pak-muhammadi'
        ? word.text_indopak || ''
        : word.text_qpc_hafs || word.text_uthmani || ''
      return text ? { verseKey: word.verse_key, position: word.position, text } : null
    })
    .filter((word): word is Word => Boolean(word))
    .sort((a, b) => a.position - b.position)
}

function AppPage({
  styleId,
  page,
  chapterNumber = 1,
  highlight,
  showFinger = false,
  autoScroll = true,
  scrollSpeed = 50,
  onStatus,
  exportCanvasRef,
}: Props) {
  const [displayPage, setDisplayPage] = React.useState(page)
  const [verses, setVerses] = React.useState<ApiVerse[]>([])
  const [activeVerse, setActiveVerse] = React.useState('')
  const [activeWordIndex, setActiveWordIndex] = React.useState(0)
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const pageRef = React.useRef<HTMLDivElement>(null)
  const activeWordRef = React.useRef<HTMLSpanElement>(null)
  const compositorRef = React.useRef<{ destroy: () => void } | null>(null)

  React.useEffect(() => setDisplayPage(page), [page])

  React.useEffect(() => {
    let cancelled = false
    setActiveVerse('')
    setActiveWordIndex(0)
    void fetchChapterPages(chapterNumber, styleId).catch(() => undefined)
    return () => { cancelled = true }
  }, [chapterNumber, styleId])

  React.useEffect(() => {
    if (!activeVerse) return
    let cancelled = false
    void fetchChapterPages(chapterNumber, styleId).then(result => {
      if (cancelled) return
      const key = verseNumber(activeVerse)
      const match = Object.entries(result.pages).find(([, boundary]) =>
        key >= verseNumber(boundary.from) && key <= verseNumber(boundary.to)
      )
      if (match) setDisplayPage(Number(match[0]))
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [activeVerse, chapterNumber, styleId])

  React.useEffect(() => {
    let cancelled = false
    const cacheKey = quranPageCacheKey(displayPage, styleId)
    setLoading(true)
    setError('')

    void getCachedQuranPage(cacheKey).then(cached => {
      if (!cancelled && cached?.length) {
        setVerses(cached)
        setLoading(false)
      }
    })

    fetchPage(displayPage, styleId).then(data => {
      if (cancelled) return
      const next = data.verses || []
      setVerses(next)
      setLoading(false)
      void cacheQuranPage(cacheKey, next)
      onStatus?.(`Mushaf page ${displayPage} loaded`)
    }).catch(errorValue => {
      if (cancelled) return
      setLoading(false)
      setError(errorValue instanceof Error ? errorValue.message : 'Unable to load Mushaf page.')
    })

    return () => { cancelled = true }
  }, [displayPage, styleId, onStatus])

  const lines = React.useMemo<Line[]>(() => {
    const grouped = new Map<number, Word[]>()
    for (const verse of verses) {
      for (const word of wordsForVerse(verse, styleId)) {
        const sourceWord = verse.words?.find(item => item.position === word.position)
        const lineNumber = Number(sourceWord?.line_number) || 1
        const bucket = grouped.get(lineNumber) || []
        bucket.push(word)
        grouped.set(lineNumber, bucket)
      }
    }
    return [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([line, words]) => [line, words] as Line)
  }, [verses, styleId])

  const activeWord = React.useMemo(() => {
    const verse = verses.find(item => item.verse_key === activeVerse)
    return verse ? wordsForVerse(verse, styleId)[activeWordIndex] || null : null
  }, [verses, activeVerse, activeWordIndex, styleId])

  React.useEffect(() => {
    if (!autoScroll || !activeWordRef.current) return
    activeWordRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    })
  }, [autoScroll, activeVerse, activeWordIndex, activeWord, displayPage])

  const drawMushaf = React.useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, height)

    const pageWidth = Math.min(width * 0.52, 980)
    const pageX = (width - pageWidth) / 2
    const lineHeight = Math.max(54, height / 16)
    const contentHeight = Math.max(height, lines.length * lineHeight + 90)
    const activeLineIndex = Math.max(0, lines.findIndex(([, words]) =>
      words.some(word => word.verseKey === activeVerse)
    ))
    const targetScroll = Math.max(
      0,
      Math.min(contentHeight - height, (activeLineIndex + 0.5) * lineHeight - height * 0.45)
    )

    ctx.fillStyle = '#f5efdc'
    ctx.fillRect(pageX, 0, pageWidth, height)
    ctx.save()
    ctx.beginPath()
    ctx.rect(pageX, 0, pageWidth, height)
    ctx.clip()
    ctx.translate(0, -targetScroll)
    ctx.direction = 'rtl'
    ctx.textAlign = 'right'
    ctx.font = `${Math.max(24, Math.min(52, width / 25))}px '${quranFont(styleId)}'`

    lines.forEach(([, words], lineIndex) => {
      let x = pageX + pageWidth - 34
      const y = 58 + lineIndex * lineHeight
      for (const word of words) {
        const active = word.verseKey === activeVerse && activeWord?.position === word.position
        ctx.fillStyle = active ? highlight : '#29271f'
        ctx.fillText(word.text, x, y)
        x -= ctx.measureText(word.text + ' ').width
      }
    })
    ctx.restore()
  }, [lines, activeVerse, activeWord, highlight, styleId])

  React.useEffect(() => {
    const canvas = exportCanvasRef?.current
    if (!canvas || !lines.length) return
    let cancelled = false
    compositorRef.current?.destroy()
    compositorRef.current = null

    const prepare = async () => {
      try { await document.fonts.load(`40px '${quranFont(styleId)}'`) } catch {}
      if (cancelled) return
      const compositor = await createExportCompositor({
        canvas,
        width: canvas.width || 1920,
        height: canvas.height || 1080,
        drawMushaf,
      })
      if (cancelled) compositor.destroy()
      else compositorRef.current = compositor
    }

    void prepare().catch(errorValue => {
      if (!cancelled) onStatus?.(errorValue instanceof Error ? errorValue.message : 'Export renderer failed.')
    })

    return () => {
      cancelled = true
      compositorRef.current?.destroy()
      compositorRef.current = null
    }
  }, [exportCanvasRef, drawMushaf, lines.length, onStatus, styleId])

  if (loading && !lines.length) {
    return <div className="live-preview-shell">
      <div className="quran-live-page live-page-state">
        <div className="live-mushaf-state"><strong>Loading Mushaf</strong></div>
      </div>
      <Recitation chapterNumber={chapterNumber} onSync={(verse, word) => { setActiveVerse(verse); setActiveWordIndex(word) }} onStatus={onStatus} />
    </div>
  }

  if (error && !lines.length) {
    return <div className="live-preview-shell">
      <div className="quran-live-page live-page-state">
        <div className="live-mushaf-state error"><strong>Mushaf unavailable</strong><span>{error}</span></div>
      </div>
      <Recitation chapterNumber={chapterNumber} onSync={(verse, word) => { setActiveVerse(verse); setActiveWordIndex(word) }} onStatus={onStatus} />
    </div>
  }

  return <div className="live-preview-shell">
    <div className="quran-live-page" dir="rtl" translate="no" ref={pageRef}>
      <div className="live-page-number">{displayPage}</div>
      <div className="live-quran-lines" style={{ fontFamily: `'${quranFont(styleId)}', serif`, '--highlight': highlight } as React.CSSProperties}>
        {lines.map(([lineNumber, words]) =>
          <div key={lineNumber} className={words.some(word => word.verseKey === activeVerse) ? 'live-quran-line active-line' : 'live-quran-line'}>
            {words.map(word => {
              const active = word.verseKey === activeVerse && activeWord?.position === word.position
              return <span
                ref={active ? activeWordRef : undefined}
                key={`${word.verseKey}-${word.position}`}
                className={active ? 'active-live-word' : 'active-live-word-soft'}
              >{word.text}</span>
            })}
          </div>
        )}
      </div>
      <canvas ref={exportCanvasRef || undefined} width={1280} height={720} aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />
    </div>
    <Recitation chapterNumber={chapterNumber} onSync={(verse, word) => { setActiveVerse(verse); setActiveWordIndex(word) }} onStatus={onStatus} />
  </div>
}

function Recitation({ chapterNumber, onSync, onStatus }: { chapterNumber: number; onSync: (verse: string, word: number) => void; onStatus?: (message: string) => void }) {
  return <LiveRecitationControls chapterNumber={chapterNumber} onSync={onSync} onStatus={onStatus} />
}

export const LiveMushafPreview = React.memo(AppPage)
