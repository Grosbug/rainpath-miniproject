import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { queryKeys } from '@/api/query-keys'
import { ApiError } from '@/api/client'
import { focusPatientRun, getPatientRun } from '@/api/patient-runs'
import { describeError } from '@/api/error-messages'
import { formatPatientFullName } from '@/lib/format-person-name'
import { displayRunTitle } from '@/lib/display-run-title'
import { toast } from 'sonner'
import { PatientCanvas } from './PatientCanvas'
import { PatientProfilePanel } from './PatientProfilePanel'
// PatientAdvanceControls is intentionally no longer mounted — status resolution
// now happens inline on each `current` send_* card (T10). The file remains in
// the directory for reference.
import { PatientHistoryList } from './PatientHistoryList'
import { DayCursorControls } from './DayCursorControls'
import { useDaySimulator } from './use-day-simulator'
import { useSidebarCollapsed } from './use-sidebar-collapsed'
import {
  PATIENT_RUN_TOOLBAR_DIVIDER,
  PATIENT_RUN_TOOLBAR_GRID,
  PATIENT_RUN_TOOLBAR_INSET
} from './patient-run-toolbar-layout'

export default function PatientRunView() {
  const { id: workflowId, runId } = useParams<{ id: string; runId: string }>()
  const { data: run, isLoading, error } = useQuery({
    queryKey: runId ? queryKeys.patientRuns.detail(runId) : ['patient-runs', 'detail', 'none'],
    queryFn: () => getPatientRun(runId!),
    enabled: !!runId
  })

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <Icon name="LoaderCircle" size={20} className="animate-spin" />
          Chargement…
        </div>
      </div>
    )
  }

  if (error || !run) {
    const notFound = error instanceof ApiError && error.status === 404
    const backTo = workflowId ? `/workflows/${workflowId}/patient-runs` : '/workflows'
    const backLabel = workflowId ? 'Retour aux parcours' : 'Retour aux workflows'
    return (
      <div className="flex min-h-dvh items-center justify-center p-8">
        <div className="max-w-md text-center">
          <Icon
            name={notFound ? 'MapPinOff' : 'CircleAlert'}
            size={24}
            className={`mx-auto ${notFound ? 'text-fg-muted' : 'text-danger'}`}
          />
          <h1 className="mt-4 text-xl font-semibold text-fg">
            {notFound ? 'Parcours introuvable' : 'Erreur de chargement'}
          </h1>
          <p className="mt-2 text-sm text-fg-muted">
            {notFound
              ? "Ce parcours n'existe pas ou son workflow a été supprimé."
              : describeError(error, 'Impossible de charger ce parcours.')}
          </p>
          <Link
            to={backTo}
            className="mt-6 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Icon name="ArrowLeft" size={16} />
            {backLabel}
          </Link>
        </div>
      </div>
    )
  }

  return <LoadedView run={run} workflowId={workflowId} />
}

function LoadedView({ run, workflowId }: { run: import('@/api/patient-runs').PatientRunFull; workflowId: string | undefined }) {
  const qc = useQueryClient()
  const [panelCollapsed, setPanelCollapsed] = useSidebarCollapsed('panel')
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
    <div className="flex h-dvh flex-col">
      {/* `h-12` on the OUTER grid (with border-box) makes the page header 48px
          total — same as the sidebar's `h-12 border-b` header — so the bottom
          border line sits at the same y across the sidebar/main boundary.
          Children drop their own `h-12` and stretch to the grid row instead;
          otherwise the parent (48px content + 1px border = 49px) was 1px taller
          than the sidebar and the line visibly broke at the boundary. */}
      <div className={
        `sticky top-0 z-10 grid h-12 shrink-0 border-b border-border bg-surface ` +
        (panelCollapsed ? 'grid-cols-1' : 'grid-cols-[1fr_360px]')
      }>
        <div className={`relative min-w-0 ${PATIENT_RUN_TOOLBAR_GRID} ${PATIENT_RUN_TOOLBAR_INSET}`}>
          <Link
            to={`/workflows/${workflowId}/patient-runs`}
            className="flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
          >
            <Icon name="ArrowLeft" size={16} />
            Parcours
          </Link>
          <div className={PATIENT_RUN_TOOLBAR_DIVIDER} aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-fg" data-rp-tooltip={displayRunTitle(run.title)}>
              {displayRunTitle(run.title)}
            </h1>
            <p className="truncate text-xs text-fg-muted">
              {formatPatientFullName(run.patient)}
              <span className="mx-1.5 text-fg-subtle">·</span>
              {run.workflow.name}
              <span className="mx-1.5 text-fg-subtle">·</span>
              J+0 le {new Date(run.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              {run.patient.deletedAt ? (
                <span className="ml-2 inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs text-fg-muted">
                  Patient supprimé
                </span>
              ) : null}
            </p>
          </div>
          {/* Collapsed-state chevron: sits at the right edge of the canvas
              area (= where the side panel used to start) at the top-bar's
              vertical level, so the user can always see the toggle. */}
          {panelCollapsed ? (
            <button
              type="button"
              onClick={() => setPanelCollapsed(false)}
              className={
                'absolute right-2 top-1/2 z-20 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center ' +
                'rounded-md border border-border bg-surface-muted text-fg hover:bg-surface ' +
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
              }
              aria-label="Déplier le panneau latéral"
              aria-expanded={false}
              data-rp-tooltip="Déplier le panneau latéral"
            >
              <Icon name="ChevronsLeft" size={16} />
            </button>
          ) : null}
        </div>
        {!panelCollapsed ? (
          <div className="relative flex items-center border-l border-border">
            {/* Expanded-state chevron: at the LEFT edge of the side panel's
                column. Clicking it collapses the whole right section (top-bar
                slot + aside below). The "Éditer le workflow" button used to
                live here too; it moved into DayCursorControls next to
                "Réinitialiser" so the central toolbar groups all run actions. */}
            <button
              type="button"
              onClick={() => setPanelCollapsed(true)}
              className={
                'absolute left-1 top-1/2 z-20 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center ' +
                'rounded-md border border-border bg-surface-muted text-fg hover:bg-surface ' +
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
              }
              aria-label="Réduire le panneau latéral"
              aria-expanded={true}
              data-rp-tooltip="Réduire le panneau latéral"
            >
              <Icon name="ChevronsRight" size={16} />
            </button>
          </div>
        ) : null}
      </div>

      <div className={
        `grid flex-1 overflow-hidden ` +
        (panelCollapsed ? 'grid-cols-1' : 'grid-cols-[1fr_360px]')
      }>
        <div className="relative flex flex-col">
          <div className="border-b border-border bg-surface px-4 py-2">
            <DayCursorControls
              sim={sim}
              graph={run.workflow.graph}
              activeFrontiers={run.activeFrontiers}
              workflowId={run.workflowId}
              workflowName={run.workflow.name}
            />
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

        {!panelCollapsed ? (
          <aside className="flex flex-col gap-6 overflow-y-auto border-l border-border bg-surface p-6">
            <PatientProfilePanel patient={run.patient} runId={run.id} />
            <div className="h-px bg-border" />
            <PatientHistoryList graph={run.workflow.graph} history={run.history} startDate={run.startDate} />
          </aside>
        ) : null}
      </div>
    </div>
  )
}
