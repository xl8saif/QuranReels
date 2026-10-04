import React from 'react'
import { ChapterPageNavigator } from './ChapterPageNavigator'
import { LiveMushafPreview } from '../LiveMushafPreview'
import type { MushafStyleId } from '../mushafStyles'

type Props = {
  chapterNumber: number
  styleId: MushafStyleId
  page: number
  onPageChange: (page: number) => void
  highlight: string
  showFinger?: boolean
  autoScroll?: boolean
  scrollSpeed?: number
  onStatus?: (message: string) => void
  exportCanvasRef?: React.RefObject<HTMLCanvasElement | null>
}

export function MushafChapterView({
  chapterNumber,
  styleId,
  page,
  onPageChange,
  highlight,
  showFinger,
  autoScroll,
  scrollSpeed,
  onStatus,
  exportCanvasRef,
}: Props) {
  return (
    <section className="mushaf-chapter-view" aria-label="Quran Mushaf chapter">
      <ChapterPageNavigator
        chapterNumber={chapterNumber}
        styleId={styleId}
        page={page}
        onPageChange={onPageChange}
      />
      <LiveMushafPreview
        styleId={styleId}
        page={page}
        highlight={highlight}
        showFinger={showFinger}
        autoScroll={autoScroll}
        scrollSpeed={scrollSpeed}
        onStatus={onStatus}
        exportCanvasRef={exportCanvasRef}
      />
    </section>
  )
}
