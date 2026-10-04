import React from 'react'
import { createRoot } from 'react-dom/client'
import { Download, Play, Loader2 } from 'lucide-react'
import './styles.css'
import './mobile.css'
import { mushafStyles, defaultMushafStyle, type MushafStyleId } from './mushafStyles'
import { surahCatalog } from './surahCatalog'
import { LiveMushafPreview } from './LiveMushafPreview'
import { createAppRuntime } from './appRuntime'
import type { ExportPanelOptions } from './exportPanel'\nimport { useChapterPages } from './useChapterPages'

function App() {
  const [surahNumber, setSurahNumber] = React.useState(1)
  const [mushafStyle, setMushafStyle] = React.useState<MushafStyleId>(defaultMushafStyle)
  const [status, setStatus] = React.useState('')
  const [exporting, setExporting] = React.useState(false)
  const [exportProgress, setExportProgress] = React.useState(0)
  const [exportUrl, setExportUrl] = React.useState<string | null>(null)
  const exportCanvasRef = React.useRef<HTMLCanvasElement>(null)
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const runtimeRef = React.useRef(createAppRuntime())
  const selectedSurah = surahCatalog.find(s => s.number === surahNumber) ?? surahCatalog[0]\n  const { firstPage } = useChapterPages(surahNumber, mushafStyle)

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
      resolution: 'youtube-landscape',
      fps: 30,
      mushafStyle,
      translationLanguage: 'none',
      playbackSpeed: 1,
      filename: `waraq-${selectedSurah.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.webm`
    }
    runtimeRef.current.startExport(options)
    setStatus('Creating video…')
  }

  return <div className="app-shell minimal-app">
    <header className="topbar minimal-topbar">
      <div className="title-block">
        <h1>Waraq Quran Reels</h1>
        <div className="subtitle">{selectedSurah.arabic}</div>
      </div>
    </header>

    <main className="minimal-workspace">
      <section className="minimal-controls" aria-label="Quran selection">
        <label>
          <span>Surah</span>
          <select value={surahNumber} onChange={e => setSurahNumber(Number(e.target.value))}>
            {surahCatalog.map(s => <option key={s.number} value={s.number}>{s.number}. {s.name} — {s.arabic}</option>)}
          </select>
        </label>
        <label>
          <span>Mushaf</span>
          <select value={mushafStyle} onChange={e => setMushafStyle(e.target.value as MushafStyleId)}>
            {mushafStyles.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
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
        <button type="button" className="primary minimal-export" disabled={exporting} onClick={startExport}>
          {exporting ? <><Loader2 size={16} className="spin"/> {Math.round(exportProgress)}%</> : <><Play size={16}/> Create video</>}
        </button>
        {exportUrl && <a className="download-link" href={exportUrl} download><Download size={15}/> Download</a>}
      </section>

      <div className="minimal-status">{status || 'Ahmad Al-Ajmy · Hafs · 1920×1080 · 30 fps'}</div>
    </main>
  </div>
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
