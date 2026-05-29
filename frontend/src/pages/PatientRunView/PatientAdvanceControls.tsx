import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CHANNEL_STATUSES } from '@rainpath/shared'
import type { Graph } from '@rainpath/shared'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/Icon'
import { advancePatientRun, resetPatientRun } from '@/api/patient-runs'
import { queryKeys } from '@/api/query-keys'
import { describeError } from '@/api/error-messages'
import { frStatus } from '@/pages/WorkflowEditor/modal/status-labels'
import {
  hasChannelData, failureStatusesForNode, missingChannelLabel,
  type PatientContactData
} from './cumulative-days'

interface Props {
  runId: string
  workflowId: string
  graph: Graph
  currentNodeId: string | null
  profile: PatientContactData
}

type NodeData = Graph['nodes'][number]['data']

function channelStatusesFor(data: NodeData): string[] | null {
  if (data.kind === 'send_email') return [...CHANNEL_STATUSES.email]
  if (data.kind === 'send_sms') return [...CHANNEL_STATUSES.sms]
  if (data.kind === 'send_whatsapp') return [...CHANNEL_STATUSES.whatsapp]
  if (data.kind === 'send_postal') {
    return data.params.tracked ? [...CHANNEL_STATUSES.postal_tracked] : [...CHANNEL_STATUSES.postal_untracked]
  }
  return null
}

/**
 * Statuses the simulator can actually route from this node. For simple mode every
 * channel status is acceptable (anything not in the success list falls into failure).
 * For multi mode, only statuses listed in at least one output map to a handle —
 * picking any other one would crash with `unhandled_outcome` on the backend, so we
 * hide them from the dropdown. Coverage gaps are surfaced at edit time by the
 * MissingStatusesAlert; this filter is the runtime mirror.
 *
 * When the patient lacks the contact data the channel needs (no email for
 * `send_email`, no postal address for `send_postal`, etc.), success-class
 * statuses are filtered out too — "delivered" / "opened" / "read" can't be
 * observed if the message never reached the recipient. Only the failure set
 * remains.
 */
function routableStatusesFor(data: NodeData, profile: PatientContactData): string[] | null {
  const channel = channelStatusesFor(data)
  if (!channel) return null
  let candidates = channel
  if (
    data.kind === 'send_email' || data.kind === 'send_sms' ||
    data.kind === 'send_whatsapp' || data.kind === 'send_postal'
  ) {
    const out = data.params.output
    if (out.mode === 'multi') {
      const routed = new Set(out.outputs.flatMap(o => o.condition.statuses))
      candidates = candidates.filter(s => routed.has(s))
    }
  }
  if (!hasChannelData(data, profile)) {
    const failures = new Set<string>(failureStatusesForNode(data))
    candidates = candidates.filter(s => failures.has(s))
  }
  return candidates
}

export function PatientAdvanceControls({ runId, workflowId, graph, currentNodeId, profile }: Props) {
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
    onError: e => toast.error(describeError(e, 'Échec de l\'avancement.'))
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

  const channelStatuses = routableStatusesFor(data, profile)
  const noOutcomeNeeded = data.kind === 'start'
  const lacksData = !hasChannelData(data, profile)
  const missingLabel = lacksData ? missingChannelLabel(data) : null
  // Empty dropdown can mean either: multi mode mis-configured (no routed status),
  // OR the patient lacks contact data AND no failure status exists (postal_untracked).
  const noOutcomeAvailable =
    channelStatuses !== null && channelStatuses.length === 0

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">Avancement</h2>

      {lacksData && missingLabel ? (
        <p className="rounded-md border border-warning bg-[#FFFBEB] p-2 text-xs text-fg" role="status">
          <Icon name="TriangleAlert" size={16} className="mr-1 inline text-warning" />
          Patient sans <strong>{missingLabel}</strong> — seuls les statuts d'échec sont proposés.
        </p>
      ) : null}

      {noOutcomeNeeded ? (
        <p className="text-xs text-fg-muted">Aucun statut à fournir, cliquez sur Avancer.</p>
      ) : noOutcomeAvailable ? (
        <p className="rounded-md border border-warning bg-[#FFFBEB] p-2 text-xs text-warning">
          {lacksData
            ? 'Ce canal n\'a pas de statut d\'échec routé — impossible de simuler ce nœud tant que la donnée manque ou que la sortie d\'échec n\'est pas configurée.'
            : 'Ce nœud n\'a aucun statut routé vers une sortie. Ajoutez au moins un statut dans la configuration du nœud avant d\'avancer.'}
        </p>
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
              <option key={s} value={s}>{frStatus(s)}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="primary"
          loading={advanceMut.isPending}
          disabled={noOutcomeAvailable || (channelStatuses !== null && !noOutcomeNeeded && !outcome)}
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
