import { getVisualEditorSettings } from './visualEditor'

export interface ExportCompositorOptions {
  canvas: HTMLCanvasElement
  width: number
  height: number
  background?: { url?: string; kind?: 'image' | 'video' | 'upload'; opacity?: number; fit?: 'cover' | 'contain' | 'fill'; x?: number; y?: number }
  logo?: { url?: string; opacity?: number; size?: number; x?: number; y?: number }
  translations?: Array<{ language: string; text: string }>
  drawMushaf: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
}

const imageCache = new Map<string, HTMLImageElement>()

function isRemoteHttpUrl(url: string) {
  return /^https?:\/\//i.test(url)
}

function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url)
  if (cached) return Promise.resolve(cached)
  return new Promise((resolve, reject) => {
    const image = new Image()
    if (isRemoteHttpUrl(url) && new URL(url, window.location.href).origin !== window.location.origin) image.crossOrigin = 'anonymous'
    image.onload = () => { imageCache.set(url, image); resolve(image) }
    image.onerror = () => reject(new Error(`Unable to load image: ${url}`))
    image.src = url
  })
}

function drawFit(ctx: CanvasRenderingContext2D, source: CanvasImageSource & { width: number; height: number }, width: number, height: number, fit: 'cover' | 'contain' | 'fill', x: number, y: number) {
  if (!source.width || !source.height) return
  if (fit === 'fill') { ctx.drawImage(source, 0, 0, width, height); return }
  const scale = fit === 'contain' ? Math.min(width / source.width, height / source.height) : Math.max(width / source.width, height / source.height)
  const sw = source.width * scale, sh = source.height * scale
  ctx.drawImage(source, (width - sw) * x / 100, (height - sh) * y / 100, sw, sh)
}

export function isRtlLanguage(language: string) {
  return /^(ar|ur|fa|ps|ku)([-_]|$)/i.test(language.trim())
}

export function translationFont(language: string, size: number) {
  const normalized = language.trim().toLowerCase()
  if (/^ur([-_]|$)/.test(normalized)) return `${size}px "Noto Nastaliq Urdu", "Noto Naskh Arabic", Amiri, serif`
  if (isRtlLanguage(normalized)) return `${size}px "Noto Naskh Arabic", Amiri, serif`
  return `${size}px system-ui, sans-serif`
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (!line || ctx.measureText(candidate).width <= maxWidth) line = candidate
    else { lines.push(line); line = word }
  }
  if (line) lines.push(line)
  return lines
}

function safeAreaForCanvas(width: number, height: number) {
  const ratio = width / Math.max(1, height)
  if (ratio < 0.8) return { top: 0.12, right: 0.06, bottom: 0.16, left: 0.06 }
  if (ratio < 1.2) return { top: 0.08, right: 0.06, bottom: 0.08, left: 0.06 }
  return { top: 0.06, right: 0.04, bottom: 0.06, left: 0.04 }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export async function createExportCompositor(options: ExportCompositorOptions) {
  const { canvas } = options
  let backgroundImage: HTMLImageElement | null = null
  let backgroundVideo: HTMLVideoElement | null = null
  const logo = options.logo?.url ? await loadImage(options.logo.url).catch(() => null) : null

  if (options.background?.url) {
    if (options.background.kind === 'video') {
      backgroundVideo = document.createElement('video')
      if (isRemoteHttpUrl(options.background.url) && new URL(options.background.url, window.location.href).origin !== window.location.origin) backgroundVideo.crossOrigin = 'anonymous'
      backgroundVideo.src = options.background.url
      backgroundVideo.muted = true
      backgroundVideo.loop = true
      backgroundVideo.playsInline = true
      backgroundVideo.preload = 'auto'
      void backgroundVideo.play().catch(() => undefined)
    } else backgroundImage = await loadImage(options.background.url).catch(() => null)
  }

  const draw = () => {
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const width = canvas.width || options.width
    const height = canvas.height || options.height
    const safe = safeAreaForCanvas(width, height)
    const safeLeft = width * safe.left
    const safeTop = height * safe.top
    const safeWidth = width * (1 - safe.left - safe.right)
    const safeHeight = height * (1 - safe.top - safe.bottom)
    const visual = getVisualEditorSettings()

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, height)
    try { options.drawMushaf(ctx, width, height) } catch { /* External Mushaf artwork may be canvas-tainted; keep the live DOM preview running. */ }

    if (options.translations?.length) {
      const blockWidth = safeWidth * 0.9 * (visual.translationScale / 100)
      const baseSize = Math.max(20, Math.min(36, safeWidth / 55)) * (visual.translationScale / 100)
      const labelSize = Math.max(14, Math.min(22, safeWidth / 85)) * (visual.translationScale / 100)
      const anchorX = safeLeft + safeWidth * (visual.translationX / 100)
      let cursorY = safeTop + safeHeight * (visual.translationY / 100)
      const gap = Math.max(14, height / 180) * (visual.translationScale / 100)

      for (let index = options.translations.length - 1; index >= 0; index -= 1) {
        const translation = options.translations[index]
        const rtl = isRtlLanguage(translation.language)
        const size = rtl && /^ur([-_]|$)/i.test(translation.language.trim()) ? baseSize * 0.9 : baseSize
        ctx.direction = rtl ? 'rtl' : 'ltr'
        ctx.textAlign = 'center'
        ctx.fillStyle = '#40372b'
        ctx.font = `600 ${labelSize}px system-ui, sans-serif`
        ctx.fillText(translation.language.toUpperCase(), anchorX, cursorY)
        cursorY -= labelSize + 8

        ctx.font = translationFont(translation.language, size)
        const lines = wrapText(ctx, translation.text, blockWidth)
        const lineHeight = size * 1.45
        for (let lineIndex = lines.length - 1; lineIndex >= 0; lineIndex -= 1) {
          if (cursorY < safeTop) break
          ctx.fillText(lines[lineIndex], anchorX, cursorY)
          cursorY -= lineHeight
        }
        cursorY -= gap
      }
      ctx.direction = 'ltr'; ctx.textAlign = 'start'; ctx.font = '10px sans-serif'
    }

    if (visual.gradientOverlay) {
      const gradient = ctx.createLinearGradient(0, height, 0, height * 0.35)
      gradient.addColorStop(0, `rgba(0,0,0,${visual.gradientStrength / 100})`)
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height)
    }

    if (logo) {
      const size = Math.min(width, height) * (visual.logoSize / 100)
      const requestedX = safeLeft + safeWidth * (visual.logoX / 100)
      const requestedY = safeTop + safeHeight * (visual.logoY / 100)
      const x = clamp(requestedX, safeLeft + size / 2, safeLeft + safeWidth - size / 2)
      const y = clamp(requestedY, safeTop + size / 2, safeTop + safeHeight - size / 2)
      ctx.globalAlpha = visual.logoOpacity / 100
      ctx.drawImage(logo, x - size / 2, y - size / 2, size, size)
      ctx.globalAlpha = 1
    }
  }

  let animationFrame = 0
  const animate = () => { draw(); animationFrame = window.requestAnimationFrame(animate) }
  animate()

  return {
    draw,
    destroy: () => {
      window.cancelAnimationFrame(animationFrame)
      if (backgroundVideo) { backgroundVideo.pause(); backgroundVideo.removeAttribute('src'); backgroundVideo.load() }
    },
  }
}
