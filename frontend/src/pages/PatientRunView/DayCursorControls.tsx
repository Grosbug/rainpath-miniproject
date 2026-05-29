import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/Icon'
import type { DaySimulator } from './use-day-simulator'

interface Props {
  sim: DaySimulator
}

const PAUSE_LABEL: Record<NonNullable<DaySimulator['pauseReason']>, string> = {
  multi_output: 'En attente d\'un statut — choisis-en un ci-dessous',
  end: 'Parcours terminé'
}

export function DayCursorControls({ sim }: Props) {
  const { day, currentNodeDay, nextEventDay, pauseReason, autoAdvancing, jumpToNextEvent, syncToCurrentNode } = sim
  const daysUntilNext = nextEventDay !== null ? nextEventDay - day : null
  const hasJump = nextEventDay !== null && nextEventDay > day

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface px-3 py-2 shadow-elev-1">
      <div className="flex items-center gap-3">
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Aujourd'hui</span>
          <span className="font-mono text-base font-semibold tabular-nums text-primary">J+{day}</span>
        </div>

        <div className="mx-1 h-8 w-px bg-border" aria-hidden="true" />

        <div className="flex items-center gap-1">
          <Button
            type="button" variant="secondary" size="sm"
            onClick={jumpToNextEvent}
            disabled={!hasJump || autoAdvancing || !!pauseReason}
            aria-label="Aller au prochain événement"
            data-rp-tooltip={hasJump ? `Aller à J+${nextEventDay}` : 'Aucun événement à venir'}
          >
            <Icon name="FastForward" size={16} />
            Prochain
          </Button>
          <Button
            type="button" variant="ghost" size="sm"
            onClick={syncToCurrentNode}
            disabled={day === currentNodeDay || autoAdvancing}
            aria-label="Revenir au jour de l'étape courante"
            data-rp-tooltip="Revenir au jour de l'étape courante"
          >
            <Icon name="RotateCcw" size={16} />
          </Button>
        </div>
      </div>

      <p className="min-h-[1rem] text-[11px] leading-tight text-fg-muted">
        {autoAdvancing
          ? 'Avancement en cours…'
          : pauseReason
            ? PAUSE_LABEL[pauseReason]
            : nextEventDay !== null && daysUntilNext !== null
              ? `Prochain événement à J+${nextEventDay} (dans ${daysUntilNext} j)`
              : 'Aucun événement automatique en attente'}
      </p>
    </div>
  )
}
