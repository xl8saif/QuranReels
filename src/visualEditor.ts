export type VisualEditorSettings = {
  quranX: number
  quranY: number
  quranScale: number
  translationX: number
  translationY: number
  translationScale: number
  logoX: number
  logoY: number
  logoSize: number
  logoOpacity: number
  backgroundX: number
  backgroundY: number
  backgroundZoom: number
  backgroundBlur: number
  backgroundDim: number
  gradientOverlay: boolean
  gradientStrength: number
  showSafeAreas: boolean
}

export const DEFAULT_VISUAL_EDITOR_SETTINGS: VisualEditorSettings = {
  quranX: 50,
  quranY: 42,
  quranScale: 100,
  translationX: 50,
  translationY: 76,
  translationScale: 100,
  logoX: 88,
  logoY: 90,
  logoSize: 12,
  logoOpacity: 100,
  backgroundX: 50,
  backgroundY: 50,
  backgroundZoom: 100,
  backgroundBlur: 0,
  backgroundDim: 0,
  gradientOverlay: true,
  gradientStrength: 28,
  showSafeAreas: false,
}

export const SAFE_AREA_INSETS: Record<'16:9' | '9:16' | '1:1', { x: number; y: number }> = {
  '16:9': { x: 6, y: 8 },
  '9:16': { x: 8, y: 9 },
  '1:1': { x: 7, y: 7 },
}

const STORAGE_KEY = 'qvm.visual-editor.v1'
let settings: VisualEditorSettings = loadSettings()
const listeners = new Set<(value: VisualEditorSettings) => void>()
let mounted = false

function loadSettings(): VisualEditorSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<VisualEditorSettings>
    return { ...DEFAULT_VISUAL_EDITOR_SETTINGS, ...stored }
  } catch {
    return { ...DEFAULT_VISUAL_EDITOR_SETTINGS }
  }
}

export function getVisualEditorSettings(): VisualEditorSettings {
  return { ...settings }
}

export function setVisualEditorSettings(patch: Partial<VisualEditorSettings>) {
  settings = { ...settings, ...patch }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch { /* optional */ }
  listeners.forEach(listener => listener(getVisualEditorSettings()))
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('qvm:visual-editor-change', { detail: getVisualEditorSettings() }))
}

export function resetVisualEditorSettings() {
  settings = { ...DEFAULT_VISUAL_EDITOR_SETTINGS }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch { /* optional */ }
  listeners.forEach(listener => listener(getVisualEditorSettings()))
}

export function subscribeVisualEditor(listener: (value: VisualEditorSettings) => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function clampVisualValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

export function safeAreaStyle(aspectRatio: '16:9' | '9:16' | '1:1') {
  const inset = SAFE_AREA_INSETS[aspectRatio]
  return { left: `${inset.x}%`, right: `${inset.x}%`, top: `${inset.y}%`, bottom: `${inset.y}%` }
}

export function mountVisualEditor() {
  // Visual Editor UI intentionally removed from the application.
}
