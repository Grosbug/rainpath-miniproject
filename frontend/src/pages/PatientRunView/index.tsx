import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { queryKeys } from '@/api/query-keys'
import { getPatientRun } from '@/api/patient-runs'
import { PatientCanvas } from './PatientCanvas'
import { PatientProfilePanel } from './PatientProfilePanel'
import { PatientAdvanceControls } from './PatientAdvanceControls'
import { PatientHistoryList } from './PatientHistoryList'

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
            {run.patient.deletedAt ? (
              <span className="ml-2 inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs text-fg-muted">
                Patient supprimé
              </span>
            ) : null}
          </h1>
          <p className="truncate text-xs text-fg-muted">{run.workflow.name}</p>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[1fr_360px] overflow-hidden">
        <div className="relative">
          <PatientCanvas
            graph={run.workflow.graph}
            profile={run.patient}
            currentNodeId={run.currentNodeId}
            history={run.history}
          />
        </div>

        <aside className="flex flex-col gap-6 overflow-y-auto border-l border-border bg-surface p-6">
          <PatientAdvanceControls
            runId={run.id}
            workflowId={run.workflowId}
            graph={run.workflow.graph}
            currentNodeId={run.currentNodeId}
          />
          <div className="h-px bg-border" />
          <PatientProfilePanel patient={run.patient} runId={run.id} />
          <div className="h-px bg-border" />
          <PatientHistoryList graph={run.workflow.graph} history={run.history} />
        </aside>
      </div>
    </div>
  )
}
