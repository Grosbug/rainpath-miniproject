import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { relativeFromNow } from '@/lib/format-date'
import { queryKeys } from '@/api/query-keys'
import { listPatientRunsForWorkflow } from '@/api/patient-runs'
import { getWorkflow } from '@/api/workflows'
import { CreateRunDialog } from './CreateRunDialog'

export default function PatientRunsList() {
  const { id: workflowId } = useParams<{ id: string }>()
  const [createOpen, setCreateOpen] = useState(false)

  const wfQuery = useQuery({
    queryKey: queryKeys.workflows.detail(workflowId!),
    queryFn: () => getWorkflow(workflowId!),
    enabled: !!workflowId
  })

  const runsQuery = useQuery({
    queryKey: queryKeys.patientRuns.listForWorkflow(workflowId!),
    queryFn: () => listPatientRunsForWorkflow(workflowId!),
    enabled: !!workflowId
  })

  if (!workflowId) return null

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link
        to="/workflows"
        className="mb-3 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
      >
        <Icon name="ArrowLeft" size={16} />
        Workflows
      </Link>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Parcours patients</h1>
          {wfQuery.data ? (
            <p className="mt-1 text-sm text-fg-muted">{wfQuery.data.name}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Link
            to={`/workflows/${workflowId}`}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-fg hover:bg-surface-muted"
          >
            <Icon name="Pencil" size={16} />
            Éditer le workflow
          </Link>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Icon name="Plus" size={16} />
            Nouveau parcours
          </Button>
        </div>
      </header>

      <div className="mt-8">
        {runsQuery.isLoading ? (
          <div role="status" className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-fg-muted">
            Chargement…
          </div>
        ) : runsQuery.error ? (
          <div role="alert" className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-fg">
            Impossible de charger les parcours.
          </div>
        ) : !runsQuery.data || runsQuery.data.length === 0 ? (
          <div className="mx-auto max-w-md rounded-lg border border-border bg-surface p-8 text-center">
            <Icon name="ListPlus" size={24} className="mx-auto text-fg-muted" />
            <p className="mt-4 text-sm text-fg">Aucun parcours pour ce workflow.</p>
            <Button variant="primary" className="mt-4" onClick={() => setCreateOpen(true)}>
              Démarrer un parcours
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-xs font-medium uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Nœud courant</th>
                  <th className="px-4 py-3 text-right">Modifié</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runsQuery.data.map(r => (
                  <tr key={r.id} className="hover:bg-surface-muted">
                    <td className="px-4 py-3">
                      <Link
                        to={`/workflows/${workflowId}/patient-runs/${r.id}`}
                        className="font-medium text-fg hover:text-primary focus-visible:outline-none focus-visible:underline"
                      >
                        {r.patient.name}
                      </Link>
                      {r.patient.deletedAt ? (
                        <span className="ml-2 inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs text-fg-muted">
                          Patient supprimé
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-fg-muted">{r.currentNodeId ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-fg-muted tabular-nums">{relativeFromNow(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateRunDialog open={createOpen} onOpenChange={setCreateOpen} workflowId={workflowId} />
    </div>
  )
}
