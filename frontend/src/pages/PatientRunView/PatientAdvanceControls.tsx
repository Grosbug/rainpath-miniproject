import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CHANNEL_STATUSES } from '@rainpath/shared'
import type { Graph } from '@rainpath/shared'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/Icon'
import { advancePatientRun, resetPatientRun } from '@/api/patient-runs'
import { queryKeys } from '@/api/query-keys'
import { ApiError } from '@/api/client'

interface Props {
  runId: string
  workflowId: string
  graph: Graph
  currentNodeId: string | null
}

type NodeData = Graph['nodes'][number]['data']

const STATUS_LABEL: Record<string, string> = {
  delivered: 'Livré',
  bounced: 'Rebondi',
  rejected: 'Rejeté',
  opened: 'Ouvert',
  clicked: 'Cliqué',
  unopened: 'Non ouvert',
  sent: 'Envoyé',
  failed: 'Échec',
  read: 'Lu',
  returned: 'Retourné'
}

function channelStatusesFor(data: NodeData): string[] | null {
  if (data.kind === 'send_email') return [...CHANNEL_STATUSES.email]
  if (data.kind === 'send_sms') return [...CHANNEL_STATUSES.sms]
  if (data.kind === 'send_whatsapp') return [...CHANNEL_STATUSES.whatsapp]
  if (data.kind === 'send_postal') {
    return data.params.tracked ? [...CHANNEL_STATUSES.postal_tracked] : [...CHANNEL_STATUSES.postal_untracked]
  }
  return null
}

export function PatientAdvanceControls({ runId, workflowId, graph, currentNodeId }: Props) {
  const node = currentNodeId ? graph.nodes.find(n => n.id === currentNodeId) : null
  const data = node?.data

  const [outcome, setOutcome] = useState<string>('')
  const qc = useQueryClient()

  const advanceMut = useMutation({
    mutationFn: () =>
      advancePatientRun(runId, outcome ? { outcome } : {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.detail(runId) })
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.listForWorkflow(workflowId) })
      setOutcome('')
    },
    onError: e => {
      const msg = e instanceof ApiError
        ? e.body.errors?.[0]?.message ?? `Erreur ${e.status}`
        : 'Échec de l\'avancement'
      toast.error(msg)
    }
  })

  const resetMut = useMutation({
    mutationFn: () => resetPatientRun(runId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.detail(runId) })
      toast.success('Parcours réinitialisé')
      setOutcome('')
    },
    onError: () => toast.error('Échec de la réinitialisation')
  })

  if (!data) {
    return (
      <div className="rounded-md border border-border bg-surface-muted p-3 text-sm text-fg-muted">
        Parcours non démarré.
      </div>
    )
  }

  if (data.kind === 'end') {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-success bg-[#DCFCE7] p-3 text-sm text-fg">
          <Icon name="CircleCheck" size={16} className="mr-1 inline text-success" />
          Parcours terminé.
        </div>
        <Button variant="secondary" onClick={() => resetMut.mutate()} loading={resetMut.isPending}>
          <Icon name="RotateCw" size={16} />
          Réinitialiser le parcours
        </Button>
      </div>
    )
  }

  const channelStatuses = channelStatusesFor(data)
  const isCondition = data.kind === 'condition'
  const noOutcomeNeeded =
    data.kind === 'start' ||
    (channelStatuses !== null && data.kind !== 'condition' && (data as any).params?.output?.mode === 'single')

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">Avancement</h2>

      {isCondition ? (
        <div className="flex gap-2">
          <label className={`flex h-9 flex-1 cursor-pointer items-center justify-center rounded-md border text-sm font-medium ${
            outcome === 'true' ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface text-fg-muted'
          }`}>
            <input type="radio" className="sr-only" checked={outcome === 'true'} onChange={() => setOutcome('true')} />
            Vrai
          </label>
          <label className={`flex h-9 flex-1 cursor-pointer items-center justify-center rounded-md border text-sm font-medium ${
            outcome === 'false' ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface text-fg-muted'
          }`}>
            <input type="radio" className="sr-only" checked={outcome === 'false'} onChange={() => setOutcome('false')} />
            Faux
          </label>
        </div>
      ) : noOutcomeNeeded ? (
        <p className="text-xs text-fg-muted">Aucun statut à fournir, cliquez sur Avancer.</p>
      ) : channelStatuses ? (
        <div>
          <label htmlFor="run-outcome" className="mb-1 block text-xs font-medium text-fg-muted">
            Statut observé
          </label>
          <select
            id="run-outcome"
            value={outcome}
            onChange={e => setOutcome(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Choisir un statut…</option>
            {channelStatuses.map(s => (
              <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="primary"
          loading={advanceMut.isPending}
          disabled={
            (isCondition && !outcome) ||
            (!isCondition && channelStatuses !== null && !noOutcomeNeeded && !outcome)
          }
          onClick={() => advanceMut.mutate()}
        >
          <Icon name="ArrowRight" size={16} />
          Étape suivante
        </Button>
        <Button
          type="button"
          variant="secondary"
          loading={resetMut.isPending}
          onClick={() => resetMut.mutate()}
        >
          <Icon name="RotateCw" size={16} />
          Réinitialiser
        </Button>
      </div>
    </div>
  )
}
