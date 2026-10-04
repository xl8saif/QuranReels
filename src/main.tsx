import React from 'react'
import { createRoot } from 'react-dom/client'
import { Download, Loader2, Play, Volume2, BookOpen, Sparkles } from 'lucide-react'
import { LiveMushafPreview } from './LiveMushafPreview'
import { LiveRecitationControls } from './LiveRecitationControls'
import { surahCatalog } from './surahCatalog'
import { createAppRuntime } from './appRuntime'
import { getChapterStartPage } from './mushafApi'
import type { MushafStyleId } from './mushafStyles'
import type { ExportPanelOptions } from './exportPanel'
import './styles.css'

function App(){
 const [surahNumber,setSurahNumber]=React.useState(1),[status,setStatus]=React.useState(''),[activeVerse,setActiveVerse]=React.useState(''),[exporting,setExporting]=React.useState(false),[exportProgress,setExportProgress]=React.useState(0),[exportUrl,setExportUrl]=React.useState<string|null>(null),[format,setFormat]=React.useState<'youtube-landscape'|'youtube-shorts'>('youtube-landscape')
 const exportCanvasRef=React.useRef<HTMLCanvasElement>(null),audioRef=React.useRef<HTMLAudioElement>(null),runtimeRef=React.useRef(createAppRuntime())
 const selectedSurah=surahCatalog.find(s=>s.number===surahNumber)??surahCatalog[0],mushafStyle:MushafStyleId='indo-pak-muhammadi'
 const [firstPage,setFirstPage]=React.useState(1)
 React.useEffect(()=>{let cancelled=false;setStatus('Loading Mushaf page…');void getChapterStartPage(surahNumber,mushafStyle).then(p=>{if(!cancelled)setFirstPage(p)}).catch(e=>{if(!cancelled)setStatus(e instanceof Error?e.message:'Unable to resolve Surah Mushaf page.')});return()=>{cancelled=true}},[surahNumber,mushafStyle])
 React.useEffect(()=>()=>{runtimeRef.current.destroy();if(exportUrl)URL.revokeObjectURL(exportUrl)},[exportUrl])
 React.useEffect(()=>runtimeRef.current.subscribe(state=>{setExporting(state.status==='recording');setExportProgress(state.progress);if(state.blobUrl)setExportUrl(previous=>{if(previous&&previous!==state.blobUrl)URL.revokeObjectURL(previous);return state.blobUrl??null});if(state.status==='error')setStatus(state.error||'Export failed')}),[])
 React.useEffect(()=>runtimeRef.current.setMedia({canvas:exportCanvasRef.current!,audio:audioRef.current}),[])
 React.useEffect(()=>{const canvas=exportCanvasRef.current;if(!canvas)return;const [width,height]=format==='youtube-shorts'?[1080,1920]:[1920,1080];if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height},[format])
 React.useEffect(()=>setActiveVerse(''),[surahNumber])
 const startExport=()=>{const options:ExportPanelOptions={resolution:format,fps:30,mushafStyle,translationLanguage:'none',playbackSpeed:1,filename:`waraq-${selectedSurah.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${format==='youtube-shorts'?'9x16':'16x9'}.webm`};runtimeRef.current.startExport(options);setStatus('Creating video…')}
 return <div className="app-shell"><div className="ambient ambient-one"/><div className="ambient ambient-two"/>
  <header className="topbar"><div className="brand-lockup"><div className="brand-icon"><BookOpen size={18}/></div><div><h1>Waraq Quran Reels</h1><p>Indo-Pak Mushaf · Ahmad Al-Ajmy</p></div></div><div className="top-pill"><Sparkles size={13}/> Quran video studio</div></header>
  <main className="workspace">
   <section className="hero"><div><span className="eyebrow">QURAN REELS</span><h2>Create a focused Mushaf recitation video.</h2><p>Choose a Surah, select a YouTube format, and follow the recitation line-by-line.</p></div><div className="hero-orb"><Volume2 size={28}/></div></section>
   <section className="glass-card selector-card" aria-label="Quran selection"><div className="card-heading"><div><span className="card-kicker">01</span><h3>Surah</h3></div><span className="format-chip">Indo-Pak · 15 lines</span></div><label className="select-wrap"><span>Select Surah</span><select value={surahNumber} onChange={e=>setSurahNumber(Number(e.target.value))}>{surahCatalog.map(s=><option key={s.number} value={s.number}>{s.number}. {s.name} · {s.arabic}</option>)}</select></label></section>
   <section className="glass-card format-card" aria-label="Video format"><div className="card-heading"><div><span className="card-kicker">02</span><h3>YouTube format</h3></div><span className="format-chip">{format==='youtube-shorts'?'9:16 · 1080×1920':'16:9 · 1920×1080'}</span></div><div className="format-switch"><button type="button" className={format==='youtube-landscape'?'format-option active':'format-option'} onClick={()=>setFormat('youtube-landscape')}><strong>16:9</strong><span>YouTube</span></button><button type="button" className={format==='youtube-shorts'?'format-option active':'format-option'} onClick={()=>setFormat('youtube-shorts')}><strong>9:16</strong><span>Shorts / Vertical</span></button></div></section>
   <section className="glass-card preview-card" aria-label="Mushaf preview"><div className="card-heading"><div><span className="card-kicker">03</span><h3>Mushaf preview</h3></div><span className="live-chip"><i/> Live sync</span></div><div className="preview-meta"><strong>{selectedSurah.name}</strong><span>{selectedSurah.arabic}</span></div><div className="preview-frame"><LiveMushafPreview styleId={mushafStyle} page={firstPage} chapterNumber={surahNumber} activeVerse={activeVerse} highlight="#ffd83d" showFinger={false} autoScroll scrollSpeed={50} vertical={format==='youtube-shorts'} onStatus={setStatus} exportCanvasRef={exportCanvasRef}/></div></section>
   <section className="glass-card recitation-card" aria-label="Ahmad Al-Ajmy recitation"><div className="card-heading"><div><span className="card-kicker">04</span><h3>Recitation</h3></div><span className="reciter-chip">Ahmad Al-Ajmy · أحمد العجمي</span></div><LiveRecitationControls chapterNumber={surahNumber} onSync={verse=>setActiveVerse(verse)} onStatus={setStatus}/></section>
   <section className="glass-card action-card"><div><div className="action-title">Ready to create</div><div className="action-copy">{status||`Hafs · Indo-Pak 15-line · ${format==='youtube-shorts'?'9:16 · 1080×1920':'16:9 · 1920×1080'} · 30 fps`}</div></div><div className="action-buttons">{exportUrl&&<a className="glass-button" href={exportUrl} download><Download size={15}/> Download</a>}<button type="button" className="primary-button" disabled={exporting} onClick={startExport}>{exporting?<><Loader2 size={16} className="spin"/> {Math.round(exportProgress)}%</>:<><Play size={16}/> Create video</>}</button></div></section>
  </main><footer>Waraq · Quran Reels <span>•</span> Original page imagery only — no rendered Quran text layer</footer></div>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>)
