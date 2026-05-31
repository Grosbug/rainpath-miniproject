import { useEffect, type RefObject } from 'react'
import { useTimeScale } from './time-scale'

/**
 * Ctrl/Cmd + molette au-dessus de `ref` écarte (deltaY < 0) ou resserre
 * (deltaY > 0) l'axe temporel. `preventDefault` bloque le zoom-page natif du
 * navigateur sur Ctrl+molette. La molette seule est laissée intacte pour que
 * React Flow puisse paner (panOnScroll). Listener non-passif en phase capture :
 * `passive:false` autorise preventDefault ; la capture garantit l'interception
 * avant que React Flow ne gère (et n'arrête) potentiellement l'événement wheel.
 */
export function useTimeStretchGesture(ref: RefObject<HTMLElement>): void {
  const stretch = useTimeScale(s => s.stretch)
  const compress = useTimeScale(s => s.compress)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      if (e.deltaY < 0) stretch()
      else if (e.deltaY > 0) compress()
    }
    el.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => el.removeEventListener('wheel', onWheel, { capture: true })
  }, [ref, stretch, compress])
}
