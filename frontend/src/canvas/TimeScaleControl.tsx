import { IconButton } from '@/components/ui/IconButton'
import { MIN_SCALE, MAX_SCALE, useTimeScale } from './time-scale'

const EPS = 1e-6

/**
 * Contrôle de densité de l'axe temporel : boutons resserrer/écarter, slider
 * continu, et un bouton % qui réinitialise à 100 %. Pilote le store partagé
 * `useTimeScale` — monté dans les deux vues (éditeur + parcours patient).
 */
export function TimeScaleControl() {
  const timeScale = useTimeScale(s => s.timeScale)
  const stretch = useTimeScale(s => s.stretch)
  const compress = useTimeScale(s => s.compress)
  const setScale = useTimeScale(s => s.setScale)
  const reset = useTimeScale(s => s.reset)
  const pct = Math.round(timeScale * 100)

  return (
    <div className='flex items-center gap-1' aria-label="Densité de l'axe temporel">
      <IconButton
        icon='Minus'
        aria-label="Resserrer l'axe temporel"
        onClick={compress}
        disabled={timeScale <= MIN_SCALE + EPS}
        data-rp-tooltip='Resserrer les nœuds'
      />
      <input
        type='range'
        min={MIN_SCALE}
        max={MAX_SCALE}
        step={0.05}
        value={timeScale}
        onChange={e => setScale(Number.parseFloat(e.target.value))}
        aria-label="Échelle de l'axe temporel"
        className='h-1 w-24 cursor-pointer accent-primary'
      />
      <IconButton
        icon='Plus'
        aria-label="Écarter l'axe temporel"
        onClick={stretch}
        disabled={timeScale >= MAX_SCALE - EPS}
        data-rp-tooltip='Écarter les nœuds'
      />
      <button
        type='button'
        onClick={reset}
        className='min-w-[3ch] text-xs tabular-nums text-fg-muted hover:text-fg'
        aria-label='Réinitialiser la densité'
        data-rp-tooltip='Réinitialiser la densité (100 %)'
      >
        {pct}%
      </button>
    </div>
  )
}
