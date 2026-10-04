import React from 'react'
import { Pause, Play } from 'lucide-react'
import { fetchChapterAudio } from './recitationApi'
import { findActiveTiming, timingDuration, type ChapterAudioTiming } from './recitationTiming'
import './liveRecitationControls.css'

type Props = {
  chapterNumber: number
  onSync?: (verseKey: string, wordIndex: number, timeMs: number) => void
  onStatus?: (message: string) => void
}

const AHMAD_AL_AJMY_ID = 5

export function LiveRecitationControls({ chapterNumber, onSync, onStatus }: Props) {
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const statusRef = React.useRef(onStatus)
  const [audio, setAudio] = React.useState<ChapterAudioTiming | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [playing, setPlaying] = React.useState(false)
  const [currentMs, setCurrentMs] = React.useState(0)
  const [error, setError] = React.useState('')

  React.useEffect(() => { statusRef.current = onStatus }, [onStatus])

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setPlaying(false)
    setCurrentMs(0)
    audioRef.current?.pause()

    void fetchChapterAudio(AHMAD_AL_AJMY_ID, chapterNumber, undefined, true)
      .then(result => {
        if (cancelled) return
        if (!result.audioUrl) throw new Error('No Ahmad Al-Ajmy recitation is available for this Surah.')
        setAudio(result)
        if (audioRef.current) {
          audioRef.current.src = result.audioUrl
          audioRef.current.playbackRate = 1
          audioRef.current.load()
        }
        statusRef.current?.('Ahmad Al-Ajmy recitation loaded')
      })
      .catch(errorValue => {
        if (!cancelled) {
          setAudio(null)
          setError(errorValue instanceof Error ? errorValue.message : 'Unable to load recitation.')
          statusRef.current?.('Ahmad Al-Ajmy recitation unavailable')
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [chapterNumber])

  const handleTime = (timeMs: number) => {
    setCurrentMs(timeMs)
    if (!audio) return
    const active = findActiveTiming(audio.timestamps, timeMs)
    if (active.verseKey) onSync?.(active.verseKey, active.wordIndex, timeMs)
  }

  const durationMs = Math.max(
    audio?.timestamps.length ? timingDuration(audio.timestamps) : 0,
    audioRef.current?.duration ? audioRef.current.duration * 1000 : 0
  )
  const progress = durationMs > 0 ? Math.min(100, currentMs / durationMs * 100) : 0

  const togglePlayback = () => {
    const element = audioRef.current
    if (!element || !audio) return
    if (element.paused) {
      void element.play().catch(() => {
        setError('Playback was blocked. Tap Play again to start the recitation.')
        statusRef.current?.('Recitation playback blocked')
      })
    } else {
      element.pause()
    }
  }

  const seek = (value: number) => {
    const element = audioRef.current
    if (!element || !durationMs) return
    element.currentTime = value / 100 * (durationMs / 1000)
    handleTime(element.currentTime * 1000)
  }

  return <div className="live-recitation-controls">
    <div className="recitation-row">
      <button
        className="primary"
        type="button"
        onClick={togglePlayback}
        disabled={!audio || loading}
        aria-label={playing ? 'Pause recitation' : 'Play recitation'}
      >
        {playing ? <Pause size={15}/> : <Play size={15}/>} {playing ? 'Pause' : 'Play'}
      </button>
      <span className="reciter-fixed">Ahmad Al-Ajmy · أحمد بن علي العجمي</span>
    </div>

    <input
      aria-label="Recitation progress"
      type="range"
      min="0"
      max="100"
      step="0.1"
      value={progress}
      disabled={!audio || !durationMs}
      onChange={event => seek(Number(event.target.value))}
    />

    <audio
      id="qvm-export-audio"
      ref={audioRef}
      crossOrigin="anonymous"
      preload="metadata"
      onTimeUpdate={event => handleTime(event.currentTarget.currentTime * 1000)}
      onError={() => {
        setPlaying(false)
        setError('Ahmad Al-Ajmy recitation could not be played.')
        statusRef.current?.('Recitation audio failed to play')
      }}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => {
        setPlaying(false)
        handleTime(durationMs)
      }}
    />

    <small className="hint">
      {error || (loading ? 'Loading Ahmad Al-Ajmy recitation…' : audio ? `${formatTime(currentMs)} / ${formatTime(durationMs)}` : 'Recitation unavailable')}
    </small>
  </div>
}

function formatTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
