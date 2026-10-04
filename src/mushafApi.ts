export type MushafApiConfig = { accessToken?: string; clientId?: string }
export type MushafApiStyle = 'hafs-arabic-naskh' | 'indo-pak-muhammadi' | 'king-fahd-uthmanic-hafs'
export type ApiWord = { id?: number; position:number; verse_key:string; page_number:number; line_number:number; text_uthmani?:string; text_indopak?:string; text_qpc_hafs?:string; code_v2?:string; audio_url?:string }
export type ApiTranslation = { resource_id?:number; text:string; language_name?:string; resource_name?:string }
export type ApiVerse = { verse_key:string; verse_number:number; page_number:number; text_uthmani?:string; text_indopak?:string; text_qpc_hafs?:string; words?:ApiWord[]; translations?:ApiTranslation[] }
export type MushafPageBoundary = { from:string; to:string; first_verse_key:string; last_verse_key:string }
export type PagesLookupResponse = { lookup_range:{from:string;to:string}; pages:Record<string,MushafPageBoundary>; total_page:number }
type PageStart = { page:number; sura:number; aya:number }

export function getMushafId(style:MushafApiStyle){ return style==='indo-pak-muhammadi'?6:4 }

// Resolve bundled data through Vite's base URL. Absolute /data paths 404 on GitHub Pages project sites.
const DATA_ROOT = new URL('data/', document.baseURI).toString()
const dataUrl = (file:string) => new URL(file, DATA_ROOT).toString()
const QURAN_FILES={uthmani:dataUrl('quran/arabic/quran-uthmani-min.txt'),simple:dataUrl('quran/arabic/quran-simple-clean.txt')} as const
const PAGE_MAP=dataUrl('mushaf/page-map.json')
const INDOPAK_PAGE_COUNT=610
let uthmaniPromise:Promise<Map<number,string[]>>|null=null
let simplePromise:Promise<Map<number,string[]>>|null=null
let pageMapPromise:Promise<PageStart[]>|null=null

async function loadQuran(path:string){
 const response=await fetch(path,{headers:{accept:'text/plain'}})
 if(!response.ok) throw new Error(`Bundled Quran text unavailable (${response.status})`)
 const text=await response.text(); const result=new Map<number,string[]>()
 for(const raw of text.split(/\r?\n/)){const line=raw.trim();const match=line.match(/^(\d+)\|(\d+)\|(.*)$/);if(!match)continue;const s=Number(match[1]),a=Number(match[2]);const values=result.get(s)||[];values[a]=match[3];result.set(s,values)}
 return result
}

async function loadPageMap(){
 const response=await fetch(PAGE_MAP,{headers:{accept:'application/json'}})
 if(!response.ok) throw new Error(`Bundled Mushaf page map unavailable (${response.status})`)
 const data=await response.json()
 if(!Array.isArray(data)||data.length!==INDOPAK_PAGE_COUNT) throw new Error(`Invalid bundled Mushaf page map (${Array.isArray(data)?data.length:'unknown'} pages)`)
 return data.map((item:PageStart)=>({page:Number(item.page),sura:Number(item.sura),aya:Number(item.aya)})).sort((a,b)=>a.page-b.page)
}

function getQuran(style:MushafApiStyle){if(style==='indo-pak-muhammadi'){simplePromise ||= loadQuran(QURAN_FILES.simple);return simplePromise}uthmaniPromise ||= loadQuran(QURAN_FILES.uthmani);return uthmaniPromise}
function getPageMap(){pageMapPromise ||= loadPageMap();return pageMapPromise}
function key(sura:number,aya:number){return `${sura}:${aya}`}

function orderedVerses(quran:Map<number,string[]>){
 const result:{sura:number;aya:number;text:string;verseKey:string}[]=[]
 for(const [sura,verses] of quran.entries()) for(let aya=1;aya<verses.length;aya++){const text=verses[aya];if(text)result.push({sura,aya,text,verseKey:key(sura,aya)})}
 return result
}

function makeWords(text:string,verseKey:string,pageNumber:number,lineNumber:number,indopak=false):ApiWord[]{return text.split(/\s+/).filter(Boolean).map((word,index)=>({id:index+1,position:index+1,verse_key:verseKey,page_number:pageNumber,line_number:lineNumber,text_uthmani:indopak?undefined:word,text_qpc_hafs:indopak?undefined:word,text_indopak:indopak?word:undefined}))}

export async function fetchChapterPages(chapterNumber:number,style:MushafApiStyle,_config?:MushafApiConfig):Promise<PagesLookupResponse>{
 const [quran,pageMap]=await Promise.all([getQuran(style),getPageMap()])
 const verses=quran.get(chapterNumber)||[];const ayahs=verses.slice(1).filter(Boolean).length
 if(!ayahs) throw new Error(`Bundled Quran surah ${chapterNumber} unavailable`)
 const all=orderedVerses(quran);const index=new Map(all.map((verse,i)=>[verse.verseKey,i]))
 const firstKey=key(chapterNumber,1),lastKey=key(chapterNumber,ayahs)
 const firstIndex=index.get(firstKey),lastIndex=index.get(lastKey)
 if(firstIndex===undefined||lastIndex===undefined) throw new Error(`Bundled Quran index missing surah ${chapterNumber}`)
 const startPage=pageMap.reduce((best,item)=>{const i=index.get(key(item.sura,item.aya));return i!==undefined&&i<=firstIndex&&item.page>best.page?item:best},{page:0,sura:0,aya:0} as PageStart)
 const endPage=pageMap.reduce((best,item)=>{const i=index.get(key(item.sura,item.aya));return i!==undefined&&i<=lastIndex&&item.page>best.page?item:best},startPage)
 const pages:Record<string,MushafPageBoundary>={}
 for(let page=startPage.page;page<=endPage.page;page++){
  const current=pageMap[page-1],next=pageMap[page]
  const currentIndex=index.get(key(current.sura,current.aya)) ?? 0
  const nextIndex=next ? (index.get(key(next.sura,next.aya)) ?? all.length) - 1 : all.length-1
  const fromIndex=Math.max(firstIndex,currentIndex),toIndex=Math.min(lastIndex,nextIndex)
  if(fromIndex>toIndex) continue
  const from=all[fromIndex].verseKey,to=all[toIndex].verseKey
  pages[String(page)]={from,to,first_verse_key:from,last_verse_key:to}
 }
 return {lookup_range:{from:firstKey,to:lastKey},pages,total_page:Object.keys(pages).length}
}

export async function fetchPage(pageNumber:number,style:MushafApiStyle,_config?:MushafApiConfig,_translationIds:number[]=[]):Promise<{verses:ApiVerse[]}>
{
 const [quran,pageMap]=await Promise.all([getQuran(style),getPageMap()])
 const page=Math.min(INDOPAK_PAGE_COUNT,Math.max(1,Math.floor(pageNumber)))
 const all=orderedVerses(quran);const index=new Map(all.map((verse,i)=>[verse.verseKey,i]))
 const current=pageMap[page-1],next=pageMap[page]
 const start=index.get(key(current.sura,current.aya))
 if(start===undefined) throw new Error(`Bundled Mushaf page ${page} start boundary unavailable`)
 const end=next ? (index.get(key(next.sura,next.aya)) ?? all.length)-1 : all.length-1
 const selected=all.slice(start,end+1)
 const lineCount=Math.max(1,Math.min(15,selected.length))
 const wordsPerLine=Math.max(1,Math.ceil(selected.reduce((sum,v)=>sum+v.text.split(/\s+/).filter(Boolean).length,0)/lineCount))
 let wordCursor=0
 return {verses:selected.map((verse)=>{const wordCount=verse.text.split(/\s+/).filter(Boolean).length;const lineNumber=Math.min(15,Math.floor(wordCursor/wordsPerLine)+1);wordCursor+=wordCount;const words=makeWords(verse.text,verse.verseKey,page,lineNumber,style==='indo-pak-muhammadi');return {verse_key:verse.verseKey,verse_number:verse.aya,page_number:page,text_uthmani:style==='indo-pak-muhammadi'?undefined:verse.text,text_indopak:style==='indo-pak-muhammadi'?verse.text:undefined,text_qpc_hafs:style==='indo-pak-muhammadi'?undefined:verse.text,words}})}
}