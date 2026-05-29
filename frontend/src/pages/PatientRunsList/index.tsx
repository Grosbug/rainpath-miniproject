import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Graph } from '@rainpath/shared'
import { nodeDisplayTitle } from '@rainpath/shared'
import { Icon, IconName } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { relativeFromNow } from '@/lib/format-date'
import { formatPatientDisplayName } from '@/lib/format-person-name'
import { displayRunTitle } from '@/lib/display-run-title'
import { queryKeys } from '@/api/query-keys'
import { listPatientRunsForWorkflow } from '@/api/patient-runs'
import { getWorkflow } from '@/api/workflows'
import { PageHeader } from '@/components/PageHeader'
import { CreateRunDialog } from './CreateRunDialog'

interface CurrentNodeInfo {
  icon: IconName
  family: string
  kindLabel: string
  title: string
}

/**
 * Resolve a `currentNodeId` against the workflow graph to a richer descriptor:
 * an icon, a "Email" / "SMS" / … kind label, and the node's own title (subject for
 * emails, body excerpt for SMS, etc.). Returns null when the id can't be matched
 * (workflow edited after the run was created) so the caller can render a fallback.
 */
function describeCurrentNode(graph: Graph | undefined, nodeId: string | null): CurrentNodeInfo | null {
  if (!graph || !nodeId) return null
  const node = graph.nodes.find(n => n.id === nodeId)
  if (!node) return null
  const d = node.data
  if (d.kind === 'start') return { icon: 'Play', family: 'start', kindLabel: 'Départ', title: 'Examen effectué' }
  if (d.kind === 'end')   return { icon: 'Square', family: 'end', kindLabel: 'Fin', title: 'Patient relancé' }
  if (d.kind === 'send_email')    return { icon: 'Mail', family: 'email', kindLabel: 'Email', title: nodeDisplayTitle(d) }
  if (d.kind === 'send_sms')      return { icon: 'MessageSquare', family: 'sms', kindLabel: 'SMS', title: nodeDisplayTitle(d) }
  if (d.kind === 'send_whatsapp') return { icon: 'MessageCircle', family: 'whatsapp', kindLabel: 'WhatsApp', title: nodeDisplayTitle(d) }
  if (d.kind === 'send_postal')   return { icon: 'Inbox', family: 'postal', kindLabel: 'Courrier', title: nodeDisplayTitle(d) }
  return null
}

export default function PatientRunsList() {
  const { id: workflowId } = useParams<{ id: string }>()
  const navigate = useNavigate()
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
      <PageHeader
        title={
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Parcours patients</h1>
            {wfQuery.data ? (
              <p className="mt-1 text-sm text-fg-muted">{wfQuery.data.name}</p>
            ) : null}
          </div>
        }
        actions={
          <>
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
          </>
        }
      />

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
              <thead className="bg-surface-muted text-xs font-medium uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 text-left">Intitulé</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">Patient</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">Nœud courant</th>
                  <th className="w-28 whitespace-nowrap px-4 py-3 text-left">Début</th>
                  <th className="w-32 whitespace-nowrap px-4 py-3 text-left">Modifié</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runsQuery.data.map(r => {
                  const to = `/workflows/${workflowId}/patient-runs/${r.id}`
                  const cur = describeCurrentNode(wfQuery.data?.graph, r.currentNodeId)
                  return (
                    <tr
                      key={r.id}
                      className="cursor-pointer hover:bg-surface-muted"
                      onClick={() => navigate(to)}
                    >
                      <td className="max-w-[14rem] px-4 py-3">
                        <Link
                          to={to}
                          onClick={e => e.stopPropagation()}
                          className="block truncate font-medium text-fg hover:text-primary focus-visible:outline-none focus-visible:underline"
                          data-rp-tooltip={displayRunTitle(r.title)}
                        >
                          {displayRunTitle(r.title)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={to}
                          onClick={e => e.stopPropagation()}
                          className="font-medium text-fg hover:text-primary focus-visible:outline-none focus-visible:underline"
                        >
                          {formatPatientDisplayName(r.patient.name)}
                        </Link>
                        {r.patient.deletedAt ? (
                          <span className="ml-2 inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs text-fg-muted">
                            Patient supprimé
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {cur ? (
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                              style={{
                                backgroundColor: `var(--node-${cur.family}-bg)`,
                                color: `var(--node-${cur.family}-accent)`
                              }}
                              aria-hidden="true"
                            >
                              <Icon name={cur.icon} size={16} />
                            </span>
                            <div className="min-w-0">
                              <div className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">
                                {cur.kindLabel}
                              </div>
                              <div className="truncate text-sm text-fg" data-rp-tooltip={cur.title}>{cur.title}</div>
                            </div>
                          </div>
                        ) : r.currentNodeId ? (
                          <span className="font-mono text-xs text-fg-muted" data-rp-tooltip={`Identifiant : ${r.currentNodeId}`}>
                            Nœud introuvable
                          </span>
                        ) : (
                          <span className="text-xs text-fg-subtle">—</span>
                        )}
                      </td>
                      <td
                        className="px-4 py-3 text-left text-fg-muted tabular-nums"
                        data-rp-tooltip={new Date(r.startDate).toLocaleString('fr-FR')}
                      >
                        {new Date(r.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-left text-fg-muted tabular-nums">{relativeFromNow(r.updatedAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateRunDialog open={createOpen} onOpenChange={setCreateOpen} workflowId={workflowId} />
    </div>
  )
}
