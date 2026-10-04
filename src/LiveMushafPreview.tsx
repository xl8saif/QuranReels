import React from 'react'
import { loadIndoPakPage } from './indoPakMushaf'
import { createExportCompositor } from './exportCompositor'
import { fetchChapterPages, fetchPage } from './mushafApi'
import { type MushafStyleId } from './mushafStyles'

type Props={styleId:MushafStyleId;page:number;chapterNumber?:number;activeVerse?:string;highlight:string;showFinger?:boolean;autoScroll?:boolean;scrollSpeed?:number;vertical?:boolean;onStatus?:(message:string)=>void;exportCanvasRef?:React.RefObject<HTMLCanvasElement|null>}
function verseNumber(key:string){const [sura,ayah]=key.split(':').map(Number);return(sura||0)*1000+(ayah||0)}

function AppPage({page,chapterNumber=1,activeVerse='',onStatus,exportCanvasRef,highlight='#ffd83d',vertical=false}:Props){
 const [displayPage,setDisplayPage]=React.useState(page||1),[error,setError]=React.useState(''),[loading,setLoading]=React.useState(true),[activeLine,setActiveLine]=React.useState(1)
 const imageRef=React.useRef<HTMLImageElement|null>(null),compositorRef=React.useRef<{destroy:()=>void}|null>(null)
 React.useEffect(()=>setDisplayPage(page||1),[page])
 React.useEffect(()=>{let cancelled=false;if(!activeVerse){setActiveLine(1);return}
  void Promise.all([fetchChapterPages(chapterNumber,'indo-pak-muhammadi'),fetchPage(displayPage,'indo-pak-muhammadi')]).then(([result,pageData])=>{if(cancelled)return;const key=verseNumber(activeVerse);const match=Object.entries(result.pages).find(([,boundary])=>key>=verseNumber(boundary.from)&&key<=verseNumber(boundary.to));if(match)setDisplayPage(Number(match[0]));const verse=pageData.verses.find(item=>item.verse_key===activeVerse);const line=verse?.words?.[0]?.line_number;if(line)setActiveLine(Math.max(1,Math.min(15,line))) }).catch(errorValue=>onStatus?.(errorValue instanceof Error?errorValue.message:'Unable to synchronize Mushaf page.'));return()=>{cancelled=true}},[activeVerse,chapterNumber,displayPage,onStatus])
 React.useEffect(()=>{let cancelled=false;setLoading(true);setError('');void loadIndoPakPage(displayPage).then(image=>{if(cancelled)return;imageRef.current=image;setLoading(false);onStatus?.('Indo-Pak Mushaf page '+displayPage+' loaded')}).catch(errorValue=>{if(cancelled)return;setLoading(false);setError(errorValue instanceof Error?errorValue.message:'Unable to load the Mushaf page image.')});return()=>{cancelled=true}},[displayPage,onStatus])
 const drawMushaf=React.useCallback((ctx:CanvasRenderingContext2D,width:number,height:number)=>{ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);const image=imageRef.current;if(!image)return;const scale=Math.min(width/image.naturalWidth,height/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;ctx.drawImage(image,(width-w)/2,(height-h)/2,w,h)},[])
 React.useEffect(()=>{const canvas=exportCanvasRef?.current;if(!canvas||!imageRef.current)return;compositorRef.current?.destroy();compositorRef.current=null;void createExportCompositor({canvas,width:canvas.width||1920,height:canvas.height||1080,drawMushaf}).then(compositor=>{compositorRef.current=compositor}).catch(errorValue=>onStatus?.(errorValue instanceof Error?errorValue.message:'Export renderer failed.'));return()=>{compositorRef.current?.destroy();compositorRef.current=null}},[displayPage,drawMushaf,exportCanvasRef,onStatus,loading])
 const pan=Math.max(0,Math.min(18,((activeLine-1)/14)*18))
 return <div className={'live-preview-shell '+(vertical?'vertical-preview':'')}><div className='quran-live-page image-mushaf-page' dir='ltr'>
 {loading&&<div className='live-mushaf-state'><strong>Loading Mushaf page…</strong></div>}
 {!loading&&error&&<div className='live-mushaf-state error'><strong>Mushaf unavailable</strong><span>{error}</span></div>}
 {!loading&&!error&&imageRef.current&&<div className='mushaf-image-stage' style={{transform:'translateY(-'+pan+'%)'}}><img className='real-mushaf-image' src={imageRef.current.src} alt={'Indo-Pak Mushaf page '+displayPage} draggable={false}/><div className='active-line-highlight' style={{top:((activeLine-1)/15)*100+'%',height:'6.67%',background:highlight}}/></div>}
 <div className='live-page-number'>{displayPage}</div><canvas ref={exportCanvasRef||undefined} width={1920} height={1080} aria-hidden='true' style={{position:'absolute',width:0,height:0,opacity:0,pointerEvents:'none'}}/></div></div>
}
export const LiveMushafPreview=React.memo(AppPage)