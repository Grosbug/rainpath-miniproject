import { useState } from 'react'
import { toast } from 'sonner'
import type { Graph } from '@rainpath/shared'
import { Button } from '@/components/ui/Button'
import { Icon, type IconName } from '@/components/Icon'
import type { DaySimulator } from './use-day-simulator'

interface Props {
  sim: DaySimulator
  graph: Graph
  activeFrontiers: readonly string[]
}

/** Short, in-sentence label for a node id ("Email « Relance 1 »"). */
function shortNodeLabel(graph: Graph, nodeId: string): string {
  const n = graph.nodes.find(x => x.id === nodeId)
  if (!n) return nodeId
  const d = n.data
  if (d.kind === 'start') return 'Départ'
  if (d.kind === 'end') return 'Fin'
  if (d.kind === 'send_email')    return `Email « ${d.params.subject || '(sans sujet)'} »`
  if (d.kind === 'send_sms')      return `SMS « ${d.params.body.slice(0, 24) || '(vide)'} »`
  if (d.kind === 'send_whatsapp') return `WhatsApp « ${d.params.body.slice(0, 24) || '(vide)'} »`
  if (d.kind === 'send_postal')   return `Courrier « ${d.params.body.slice(0, 24) || '(vide)'} »`
  return nodeId
}

function joinFr(labels: readonly string[]): string {
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]!
  return `${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}`
}

type BannerTone = 'info' | 'danger' | 'success'
interface BannerSpec { tone: BannerTone; icon: IconName; text: string }

/** Decide which actionable hint to surface to the right of the controls. */
function bannerFor(sim: DaySimulator, graph: Graph, activeFrontiers: readonly string[]): BannerSpec | null {
  if (sim.pauseReason === 'end') {
    return { tone: 'success', icon: 'CircleCheck', text: 'Parcours terminé.' }
  }
  // Send_* nodes awaiting a status — list the labels of any still missing.
  const missing = sim.currentNodeIds.filter(id => {
    const n = graph.nodes.find(x => x.id === id)
    if (!n) return false
    if (n.data.kind === 'start') return false
    return !sim.pendingByNode[id]
  })
  if (missing.length > 0) {
    const labels = missing.map(id => shortNodeLabel(graph, id))
    const verb = labels.length > 1
      ? 'Sélectionnez les statuts observés pour'
      : 'Sélectionnez le statut observé pour'
    return { tone: 'danger', icon: 'TriangleAlert', text: `${verb} ${joinFr(labels)}.` }
  }
  if (sim.currentNodeIds.length > 0 && sim.allCurrentsHaveStatus) {
    return { tone: 'info', icon: 'Info', text: 'Prêt à passer à l\'étape suivante.' }
  }
  if (sim.currentNodeIds.length === 0 && activeFrontiers.length > 0) {
    return {
      tone: 'info',
      icon: 'Info',
      text: 'Cliquez sur une carte « À traiter » sur le schéma pour continuer une autre branche.'
    }
  }
  return null
}

const TONE_CLASS: Record<BannerTone, string> = {
  info:    'border-info/40 bg-[#EFF6FF] text-info',
  danger:  'border-danger/40 bg-[#FEF2F2] text-danger',
  success: 'border-success/40 bg-[#DCFCE7] text-success'
}

export function DayCursorControls({ sim, graph, activeFrontiers }: Props) {
  const {
    day, nextEventDay, autoAdvancing,
    allCurrentsHaveStatus, anyCurrentMissingStatus,
    advanceAllPending, currentNodeIds, pauseReason,
    canStepBack, stepBack, resetRun
  } = sim
  const daysUntilNext = nextEventDay !== null ? nextEventDay - day : null

  const banner = bannerFor(sim, graph, activeFrontiers)
  const [advancing, setAdvancing] = useState(false)
  const inFlight = advancing || autoAdvancing

  const canAdvance =
    pauseReason !== 'end' &&
    currentNodeIds.length > 0 &&
    allCurrentsHaveStatus &&
    !inFlight

  const onClickProchain = async () => {
    if (anyCurrentMissingStatus) {
      toast.info('Sélectionnez un statut sur chaque nœud en cours avant de passer à la suite.')
      return
    }
    setAdvancing(true)
    try {
      await advanceAllPending()
    } finally {
      setAdvancing(false)
    }
  }

  const onClickPrecedent = async () => {
    if (!canStepBack || inFlight) return
    setAdvancing(true)
    try {
      await stepBack()
    } finally {
      setAdvancing(false)
    }
  }
  const onClickReset = async () => {
    if (inFlight) return
    await resetRun()
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface px-3 py-2 shadow-elev-1">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Aujourd'hui</span>
          <span className="font-mono text-base font-semibold tabular-nums text-primary">J+{day}</span>
        </div>

        <div className="mx-1 h-8 w-px bg-border" aria-hidden="true" />

        <div className="flex items-center gap-1">
          <Button
            type="button" variant="secondary" size="sm"
            onClick={onClickPrecedent}
            disabled={!canStepBack || inFlight}
            aria-label="Revenir au nœud précédent"
            data-rp-tooltip={canStepBack ? 'Revenir au nœud précédent (efface la dernière étape)' : 'Déjà au point de départ'}
          >
            <Icon name="ArrowLeft" size={16} />
            Précédent
          </Button>
          <Button
            type="button" variant="primary" size="sm"
            onClick={onClickProchain}
            loading={inFlight}
            disabled={!canAdvance}
            aria-label="Passer à l'étape suivante du parcours"
            data-rp-tooltip={
              anyCurrentMissingStatus
                ? 'Sélectionnez un statut sur chaque nœud en cours'
                : pauseReason === 'end' ? 'Parcours terminé' : 'Avancer le parcours'
            }
          >
            <Icon name="ArrowRight" size={16} />
            Prochain
          </Button>
          <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
          <Button
            type="button" variant="ghost" size="sm"
            onClick={onClickReset}
            disabled={!canStepBack || inFlight}
            aria-label="Réinitialiser le parcours au tout début"
            data-rp-tooltip={canStepBack ? 'Réinitialiser le parcours au tout début' : 'Déjà au point de départ'}
          >
            <Icon name="RotateCw" size={16} />
            Réinitialiser
          </Button>
        </div>
      </div>

      {banner ? (
        <div
          role="status"
          aria-live="polite"
          className={`inline-flex max-w-full items-start gap-1.5 self-start rounded-md border px-2.5 py-1 text-xs ${TONE_CLASS[banner.tone]}`}
        >
          <Icon name={banner.icon} size={16} className="mt-0.5 shrink-0" />
          <span className="leading-snug">{banner.text}</span>
        </div>
      ) : null}

      <p className="min-h-[1rem] text-[11px] leading-tight text-fg-muted">
        {inFlight
          ? 'Avancement en cours…'
          : nextEventDay !== null && daysUntilNext !== null && daysUntilNext > 0
            ? `Prochain événement par défaut à J+${nextEventDay} (dans ${daysUntilNext} j)`
            : pauseReason === 'end'
              ? 'Fin du parcours atteinte.'
              : 'Choisissez un statut sur chaque nœud en cours puis cliquez sur Prochain.'}
      </p>
    </div>
  )
}
