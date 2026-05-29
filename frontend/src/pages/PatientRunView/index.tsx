import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { queryKeys } from '@/api/query-keys'
import { focusPatientRun, getPatientRun } from '@/api/patient-runs'
import { describeError } from '@/api/error-messages'
import { toast } from 'sonner'
import { PatientCanvas } from './PatientCanvas'
import { PatientProfilePanel } from './PatientProfilePanel'
// PatientAdvanceControls is intentionally no longer mounted — status resolution
// now happens inline on each `current` send_* card (T10). The file remains in
// the directory for reference.
import { PatientHistoryList } from './PatientHistoryList'
import { DayCursorControls } from './DayCursorControls'
import { useDaySimulator } from './use-day-simulator'

export default function PatientRunView() {
  const { id: workflowId, runId } = useParams<{ id: string; runId: string }>()
  const { data: run, isLoading, error } = useQuery({
    queryKey: runId ? queryKeys.patientRuns.detail(runId) : ['patient-runs', 'detail', 'none'],
    queryFn: () => getPatientRun(runId!),
    enabled: !!runId
  })

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100dvh-48px)] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <Icon name="LoaderCircle" size={20} className="animate-spin" />
          Chargement…
        </div>
      </div>
    )
  }

  if (error || !run) {
    return (
      <div className="flex min-h-[calc(100dvh-48px)] items-center justify-center p-8">
        <div className="max-w-md text-center">
          <Icon name="CircleAlert" size={24} className="mx-auto text-danger" />
          <h1 className="mt-4 text-xl font-semibold text-fg">Parcours introuvable</h1>
          <p className="mt-2 text-sm text-fg-muted">Ce parcours n'existe pas ou a été supprimé.</p>
        </div>
      </div>
    )
  }

  return <LoadedView run={run} workflowId={workflowId} />
}

function LoadedView({ run, workflowId }: { run: import('@/api/patient-runs').PatientRunFull; workflowId: string | undefined }) {
  const qc = useQueryClient()
  const focusMut = useMutation({
    mutationFn: (nodeId: string) => focusPatientRun(run.id, { nodeId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.detail(run.id) })
    },
    onError: e => toast.error(describeError(e, 'Impossible de changer de branche.'))
  })

  const sim = useDaySimulator({
    runId: run.id,
    workflowId: run.workflowId,
    graph: run.workflow.graph,
    focusedNodeId: run.focusedNodeId ?? run.currentNodeId,
    activeFrontiers: run.activeFrontiers,
    actionableNodeIds: run.actionableNodeIds,
    history: run.history,
    profile: {
      email: run.patient.email,
      phone: run.patient.phone,
      whatsapp: run.patient.whatsapp,
      address: run.patient.address
    }
  })

  return (
    <div className="flex h-[calc(100dvh-48px)] flex-col">
      <div className="sticky top-12 z-10 flex h-12 items-center gap-4 border-b border-border bg-surface px-6">
        <Link
          to={`/workflows/${workflowId}/patient-runs`}
          className="flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
        >
          <Icon name="ArrowLeft" size={16} />
          Parcours
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-fg">
            {run.patient.name}
            <span className="ml-2 text-xs font-normal text-fg-muted">
              · J+0 le {new Date(run.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
            {run.patient.deletedAt ? (
              <span className="ml-2 inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs text-fg-muted">
                Patient supprimé
              </span>
            ) : null}
          </h1>
          <p className="truncate text-xs text-fg-muted">{run.workflow.name}</p>
        </div>
        <Link
          to={`/workflows/${run.workflowId}`}
          className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs font-medium text-fg hover:bg-surface-muted"
          data-rp-tooltip={`Ouvrir « ${run.workflow.name} » dans l'éditeur`}
        >
          <Icon name="Pencil" size={16} />
          Éditer le workflow
        </Link>
      </div>

      <div className="grid flex-1 grid-cols-[1fr_360px] overflow-hidden">
        <div className="relative flex flex-col">
          <div className="border-b border-border bg-surface px-4 py-2">
            <DayCursorControls sim={sim} graph={run.workflow.graph} activeFrontiers={run.activeFrontiers} />
          </div>
          <div className="relative flex-1">
            <PatientCanvas
              graph={run.workflow.graph}
              profile={run.patient}
              focusedNodeId={run.focusedNodeId ?? run.currentNodeId}
              activeFrontiers={run.activeFrontiers}
              actionableNodeIds={run.actionableNodeIds}
              history={run.history}
              dayCursor={sim.day}
              pendingByNode={sim.pendingByNode}
              onPendingChange={sim.setPending}
              onFocusNode={nodeId => focusMut.mutate(nodeId)}
            />
          </div>
        </div>

        <aside className="flex flex-col gap-6 overflow-y-auto border-l border-border bg-surface p-6">
          <PatientProfilePanel patient={run.patient} runId={run.id} />
          <div className="h-px bg-border" />
          <PatientHistoryList graph={run.workflow.graph} history={run.history} startDate={run.startDate} />
        </aside>
      </div>
    </div>
  )
}
