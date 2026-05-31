import { useEffect, type RefObject } from 'react'
import { useTimeScale } from './time-scale'

/**
 * Ctrl/Cmd + molette au-dessus de `ref` écarte (deltaY < 0) ou resserre
 * (deltaY > 0) l'axe temporel. `preventDefault` bloque le zoom-page natif du
 * navigateur sur Ctrl+molette. Sur le geste modificateur on appelle aussi
 * `stopPropagation` afin que l'événement n'atteigne pas le pane de React Flow
 * (descendant du conteneur) : sinon Cmd+molette (que le filtre interne de RF ne
 * rejette pas) panerait la vue en même temps qu'on l'étire. La molette seule est
 * laissée intacte pour que React Flow puisse paner (panOnScroll). Listener
 * non-passif en phase capture : `passive:false` autorise preventDefault ; la
 * capture garantit l'interception avant que RF ne gère l'événement wheel.
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
      e.stopPropagation()
      if (e.deltaY < 0) stretch()
      else if (e.deltaY > 0) compress()
    }
    el.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => el.removeEventListener('wheel', onWheel, { capture: true })
  }, [ref, stretch, compress])
}
