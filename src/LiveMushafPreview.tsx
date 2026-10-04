import React from 'react'
import { fetchChapterPages } from './mushafApi'
import { createExportCompositor } from './exportCompositor'
import { LiveRecitationControls } from './LiveRecitationControls'
import { loadIndoPakPage } from './indoPakMushaf'
import { type MushafStyleId } from './mushafStyles'

type Props = {
  styleId: MushafStyleId
  page: number
  chapterNumber?: number
  highlight: string
  showFinger?: boolean
  autoScroll?: boolean
  scrollSpeed?: number
  onStatus?: (message:string) => void
  exportCanvasRef?: React.RefObject<HTMLCanvasElement | null>
}

function verseNumber(key:string){
  const [sura,ayah]=key.split(':').map(Number)
  return (sura || 0)*1000+(ayah || 0)
}

function AppPage({ page, chapterNumber=1, onStatus, exportCanvasRef }:Props){
  const [displayPage,setDisplayPage]=React.useState(page || 1)
  const [activeVerse,setActiveVerse]=React.useState('')
  const [error,setError]=React.useState('')
  const [loading,setLoading]=React.useState(true)
  const imageRef=React.useRef<HTMLImageElement|null>(null)
  const compositorRef=React.useRef<{destroy:()=>void}|null>(null)

  React.useEffect(()=>setDisplayPage(page || 1),[page])

  React.useEffect(()=>{
    let cancelled=false
    if(!activeVerse)return
    void fetchChapterPages(chapterNumber,'indo-pak-muhammadi').then(result=>{
      if(cancelled)return
      const key=verseNumber(activeVerse)
      const match=Object.entries(result.pages).find(([,boundary])=>{
        return key>=verseNumber(boundary.from) && key<=verseNumber(boundary.to)
      })
      if(match)setDisplayPage(Number(match[0]))
    }).catch(()=>undefined)
    return()=>{cancelled=true}
  },[activeVerse,chapterNumber])

  React.useEffect(()=>{
    let cancelled=false
    setLoading(true)
    setError('')
    void loadIndoPakPage(displayPage).then(image=>{
      if(cancelled)return
      imageRef.current=image
      setLoading(false)
      onStatus?.('Indo-Pak Mushaf page '+displayPage+' loaded')
    }).catch(errorValue=>{
      if(cancelled)return
      setLoading(false)
      setError(errorValue instanceof Error ? errorValue.message : 'Unable to load the Mushaf page image.')
    })
    return()=>{cancelled=true}
  },[displayPage,onStatus])

  const drawMushaf=React.useCallback((ctx:CanvasRenderingContext2D,width:number,height:number)=>{
    ctx.fillStyle='#000'
    ctx.fillRect(0,0,width,height)
    const image=imageRef.current
    if(!image)return
    const scale=Math.min(width/image.naturalWidth,height/image.naturalHeight)
    const w=image.naturalWidth*scale
    const h=image.naturalHeight*scale
    ctx.drawImage(image,(width-w)/2,(height-h)/2,w,h)
  },[])

  React.useEffect(()=>{
    const canvas=exportCanvasRef?.current
    if(!canvas || !imageRef.current)return
    compositorRef.current?.destroy()
    compositorRef.current=null
    void createExportCompositor({
      canvas,
      width:canvas.width || 1920,
      height:canvas.height || 1080,
      drawMushaf
    }).then(compositor=>{ compositorRef.current=compositor })
      .catch(errorValue=>onStatus?.(errorValue instanceof Error ? errorValue.message : 'Export renderer failed.'))
    return()=>{
      compositorRef.current?.destroy()
      compositorRef.current=null
    }
  },[displayPage,drawMushaf,exportCanvasRef,onStatus,loading])

  return <div className="live-preview-shell">
    <div className="quran-live-page image-mushaf-page" dir="ltr">
      {loading && <div className="live-mushaf-state"><strong>Loading Mushaf page…</strong></div>}
      {!loading && error && <div className="live-mushaf-state error"><strong>Mushaf unavailable</strong><span>{error}</span></div>}
      {!loading && !error && imageRef.current && (
        <img
          className="real-mushaf-image"
          src={imageRef.current.src}
          alt={'Indo-Pak Mushaf page '+displayPage}
          draggable={false}
        />
      )}
      <div className="live-page-number">{displayPage}</div>
      <canvas ref={exportCanvasRef || undefined} width={1920} height={1080} aria-hidden="true" style={{position:'absolute',width:0,height:0,opacity:0,pointerEvents:'none'}} />
    </div>
    <LiveRecitationControls
      chapterNumber={chapterNumber}
      onSync={(verse)=>setActiveVerse(verse)}
      onStatus={onStatus}
    />
  </div>
}

export const LiveMushafPreview=React.memo(AppPage)
