import React from 'react'
import { createRoot } from 'react-dom/client'
import { Download, Play, Loader2 } from 'lucide-react'
import './styles.css'
import './mobile.css'
import { mushafStyles, defaultMushafStyle, type MushafStyleId } from './mushafStyles'
import { surahCatalog } from './surahCatalog'
import { LiveMushafPreview } from './LiveMushafPreview'
import { createAppRuntime } from './appRuntime'
import { useLiveChapters } from './useLiveChapters'
import { useChapterPages } from './useChapterPages'
import { findLiveChapter, getLiveChapterName, getLiveChapterArabicName, getLiveChapterAyahCount } from './liveChapterSelection'
import type { ExportPanelOptions } from './exportPanel'

type UILanguage = 'en' | 'ur' | 'ar'

const ui = {
  en: { title:'Waraq Quran Reels', surah:'Surah', mushaf:'Mushaf', page:'Page', export:'Create video', download:'Download', loading:'Loading…' },
  ur: { title:'ورق قرآن ریلز', surah:'سورۃ', mushaf:'مصحف', page:'صفحہ', export:'ویڈیو بنائیں', download:'ڈاؤن لوڈ', loading:'لوڈ ہو رہا ہے…' },
  ar: { title:'ورق ريلز القرآن', surah:'السورة', mushaf:'المصحف', page:'الصفحة', export:'إنشاء الفيديو', download:'تنزيل', loading:'جارٍ التحميل…' },
} as const

function App() {
  const [uiLang, setUiLang] = React.useState<UILanguage>('en')
  const [surahNumber, setSurahNumber] = React.useState(1)
  const [mushafStyle, setMushafStyle] = React.useState<MushafStyleId>(defaultMushafStyle)
  const [status, setStatus] = React.useState('')
  const [exporting, setExporting] = React.useState(false)
  const [exportProgress, setExportProgress] = React.useState(0)
  const [exportUrl, setExportUrl] = React.useState<string | null>(null)
  const exportCanvasRef = React.useRef<HTMLCanvasElement>(null)
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const runtimeRef = React.useRef(createAppRuntime())
  const t = ui[uiLang]
  const dir = uiLang === 'en' ? 'ltr' : 'rtl'
  const { chapters: liveChapters, loading: chaptersLoading } = useLiveChapters(uiLang)
  const { firstPage, loading: pageLoading, error: pageError } = useChapterPages(surahNumber, mushafStyle)
  const selectedLiveChapter = findLiveChapter(liveChapters, surahNumber)
  const staticSurah = surahCatalog.find(s => s.number === surahNumber)!
  const selectedSurah = selectedLiveChapter ? {
    number: selectedLiveChapter.id,
    name: getLiveChapterName(selectedLiveChapter, staticSurah?.name || 'Surah'),
    arabic: getLiveChapterArabicName(selectedLiveChapter) || staticSurah?.arabic || '',
    ayahs: getLiveChapterAyahCount(selectedLiveChapter) || staticSurah?.ayahs || 0
  } : staticSurah
  const chapterOptions = liveChapters.length ? liveChapters : surahCatalog.map(s => ({
    id:s.number, name_simple:s.name, name_arabic:s.arabic, verses_count:s.ayahs
  }))

  React.useEffect(() => () => {
    runtimeRef.current.destroy()
    if (exportUrl) URL.revokeObjectURL(exportUrl)
  }, [exportUrl])

  React.useEffect(() => runtimeRef.current.subscribe(state => {
    setExporting(state.status === 'recording')
    setExportProgress(state.progress)
    if (state.blobUrl) setExportUrl(previous => {
      if (previous && previous !== state.blobUrl) URL.revokeObjectURL(previous)
      return state.blobUrl ?? null
    })
    if (state.status === 'error') setStatus(state.error || 'Export failed')
  }), [])

  React.useEffect(() => runtimeRef.current.setMedia({
    canvas: exportCanvasRef.current!,
    audio: audioRef.current
  }), [])

  const startExport = () => {
    const options: ExportPanelOptions = {
      resolution: 'youtube-shorts',
      fps: 30,
      mushafStyle,
      translationLanguage: 'none',
      filename: `waraq-${selectedSurah.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.webm`
    }
    runtimeRef.current.startExport(options)
    setStatus('Creating video…')
  }

  return <div className="app-shell minimal-app" data-ui-language={uiLang} dir={dir}>
    <header className="topbar minimal-topbar">
      <div className="title-block">
        <h1>{t.title}</h1>
        <div className="subtitle">{selectedSurah.arabic || selectedSurah.name}</div>
      </div>
      <nav className="language-switcher" aria-label="Language">
        {(['en','ar','ur'] as UILanguage[]).map(lang =>
          <button type="button" key={lang} className={uiLang === lang ? 'active' : ''} onClick={() => setUiLang(lang)}>
            {lang === 'en' ? 'EN' : lang === 'ar' ? 'AR' : 'UR'}
          </button>
        )}
      </nav>
    </header>

    <main className="minimal-workspace">
      <section className="minimal-controls" aria-label="Quran selection">
        <label>
          <span>{t.surah}</span>
          <select value={surahNumber} onChange={e => setSurahNumber(Number(e.target.value))}>
            {chapterOptions.map(s => <option key={s.id} value={s.id}>{s.id}. {s.name_simple} — {s.name_arabic || ''}</option>)}
          </select>
        </label>

        <label>
          <span>{t.mushaf}</span>
          <select value={mushafStyle} onChange={e => setMushafStyle(e.target.value as MushafStyleId)}>
            {mushafStyles.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>

        <div className="minimal-page">
          <span>{t.page}</span>
          <strong>{pageLoading ? '…' : firstPage || '—'}</strong>
        </div>
      </section>

      <section className="minimal-preview">
        <LiveMushafPreview
          styleId={mushafStyle}
          page={firstPage || 1}
          chapterNumber={surahNumber}
          highlight="#d9bd63"
          showFinger={false}
          autoScroll
          scrollSpeed={50}
          onStatus={setStatus}
          exportCanvasRef={exportCanvasRef}
        />
      </section>

      <section className="minimal-actions">
        <button type="button" className="primary minimal-export" disabled={exporting || pageLoading || Boolean(pageError)} onClick={startExport}>
          {exporting ? <><Loader2 size={16} className="spin"/> {Math.round(exportProgress)}%</> : <><Play size={16}/> {t.export}</>}
        </button>
        {exportUrl && <a className="download-link" href={exportUrl} download><Download size={15}/> {t.download}</a>}
      </section>

      <div className="minimal-status">
        {status || pageError || (chaptersLoading ? t.loading : `${selectedSurah.name} · ${selectedSurah.ayahs} ayahs`)}
      </div>
    </main>
  </div>
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
