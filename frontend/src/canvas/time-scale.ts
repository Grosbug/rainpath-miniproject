import { create } from 'zustand'

/** Pixels entre deux jours adjacents à timeScale = 1 et zoom React Flow = 1. */
export const BASE_PX_PER_DAY = 28
export const MIN_SCALE = 0.5 // → 14 px/jour (compact)
export const MAX_SCALE = 4 // → 112 px/jour (très aéré)
export const STEP_RATIO = 1.2 // facteur multiplicatif par cran
export const STORAGE_KEY = 'rainpath:time-scale'

/** Ramène n dans [MIN_SCALE, MAX_SCALE] ; 1 si non fini. */
export function clampScale(n: number): number {
  if (!Number.isFinite(n)) return 1
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, n))
}

/** Lit l'échelle persistée (clampée), 1 par défaut. SSR-safe. */
export function readInitialScale(): number {
  if (typeof window === 'undefined' || !window.localStorage) return 1
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === null) return 1
  return clampScale(Number.parseFloat(raw))
}

function persist(scale: number): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  window.localStorage.setItem(STORAGE_KEY, String(scale))
}

interface TimeScaleState {
  /** Multiplicateur d'échelle temporelle (défaut 1). Partagé par les deux vues. */
  timeScale: number
  setScale(next: number): void
  stretch(): void
  compress(): void
  reset(): void
}

export const useTimeScale = create<TimeScaleState>(set => ({
  timeScale: readInitialScale(),
  setScale: next => set(() => {
    const s = clampScale(next)
    persist(s)
    return { timeScale: s }
  }),
  stretch: () => set(state => {
    const s = clampScale(state.timeScale * STEP_RATIO)
    persist(s)
    return { timeScale: s }
  }),
  compress: () => set(state => {
    const s = clampScale(state.timeScale / STEP_RATIO)
    persist(s)
    return { timeScale: s }
  }),
  reset: () => set(() => {
    persist(1)
    return { timeScale: 1 }
  })
}))

/**
 * Pixels par jour à l'échelle courante (coordonnées « monde », avant zoom RF).
 * Sélecteur renvoyant un primitif → sûr vis-à-vis de la comparaison Object.is
 * de zustand (pas de nouvel objet par render).
 */
export function usePxPerDay(): number {
  return useTimeScale(s => BASE_PX_PER_DAY * s.timeScale)
}
