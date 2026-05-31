import { FormEvent, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { validateGraph } from '@rainpath/shared'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/Icon'
import { describeError } from '@/api/error-messages'
import { listPatientProfiles } from '@/api/patient-profiles'
import { createPatientRun } from '@/api/patient-runs'
import { listWorkflows, getWorkflow } from '@/api/workflows'
import { queryKeys } from '@/api/query-keys'
import { formatPatientDisplayName } from '@/lib/format-person-name'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  workflowId?: string
  patientId?: string
}

function todayIso(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function CreateRunDialog({ open, onOpenChange, workflowId, patientId }: Props) {
  const [selectedPatient, setSelectedPatient] = useState<string>('')
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('')
  const [title, setTitle] = useState<string>('')
  const [startDate, setStartDate] = useState<string>(todayIso())
  const [error, setError] = useState<string | null>(null)
  const qc = useQueryClient()
  const navigate = useNavigate()

  const lockedPatient = !!patientId
  const lockedWorkflow = !!workflowId

  useEffect(() => {
    if (open) {
      setSelectedPatient(patientId ?? '')
      setSelectedWorkflow(workflowId ?? '')
      setTitle('')
      setStartDate(todayIso())
      setError(null)
    }
  }, [open, patientId, workflowId])

  const { data: profiles } = useQuery({
    queryKey: queryKeys.patientProfiles.list(),
    queryFn: listPatientProfiles,
    enabled: open && !lockedPatient
  })

  const { data: workflowList } = useQuery({
    queryKey: queryKeys.workflows.list(),
    queryFn: () => listWorkflows(),
    enabled: open && !lockedWorkflow
  })
  const workflows = workflowList?.items

  // Eagerly fetch the chosen workflow's graph so we can block run creation when the
  // workflow is invalid — backend enforces the same rule, but surfacing it pre-submit
  // is much friendlier than a 422 after clicking Démarrer.
  const { data: detail, isFetching: detailLoading } = useQuery({
    queryKey: selectedWorkflow ? queryKeys.workflows.detail(selectedWorkflow) : ['workflow', 'detail', 'none'],
    queryFn: () => getWorkflow(selectedWorkflow),
    enabled: open && !!selectedWorkflow
  })

  const validation = detail ? validateGraph(detail.graph) : null
  const workflowInvalid = !!validation && validation.errors.length > 0

  const createMut = useMutation({
    mutationFn: () => createPatientRun(selectedWorkflow, {
      patientId: selectedPatient,
      title: title.trim(),
      startDate: new Date(startDate + 'T00:00:00.000Z').toISOString()
    }),
    onSuccess: run => {
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.listForWorkflow(selectedWorkflow) })
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.all })
      toast.success('Parcours créé')
      onOpenChange(false)
      navigate(`/workflows/${selectedWorkflow}/patient-runs/${run.id}`)
    },
    onError: e => setError(describeError(e, 'Impossible de créer le parcours.'))
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!selectedPatient) { setError('Choisissez un profil patient'); return }
    if (!selectedWorkflow) { setError('Choisissez un workflow'); return }
    if (!title.trim()) { setError('Saisissez un intitulé pour le parcours'); return }
    if (!startDate) { setError('Choisissez une date de début'); return }
    createMut.mutate()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nouveau parcours patient"
      description="Démarre une simulation d'avancement du workflow pour le profil choisi."
      size="md"
    >
      <form onSubmit={submit} className="space-y-3">
        {!lockedWorkflow ? (
          <div>
            <label htmlFor="run-workflow" className="mb-1 block text-sm font-medium text-fg">
              Workflow <span className="text-danger">*</span>
            </label>
            <select
              id="run-workflow"
              value={selectedWorkflow}
              onChange={e => setSelectedWorkflow(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Choisir un workflow…</option>
              {workflows?.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        ) : null}
        {!lockedPatient ? (
          <div>
            <label htmlFor="run-patient" className="mb-1 block text-sm font-medium text-fg">
              Profil patient <span className="text-danger">*</span>
            </label>
            <select
              id="run-patient"
              value={selectedPatient}
              onChange={e => setSelectedPatient(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Choisir un profil…</option>
              {profiles?.map(p => (
                <option key={p.id} value={p.id}>{formatPatientDisplayName(p.name)}{p.email ? ` (${p.email})` : ''}</option>
              ))}
            </select>
            {profiles && profiles.length === 0 ? (
              <p className="mt-1 text-xs text-fg-muted">
                Aucun profil. Créez-en un depuis la page <em>Patients</em>.
              </p>
            ) : null}
          </div>
        ) : null}
        <div>
          <label htmlFor="run-title" className="mb-1 block text-sm font-medium text-fg">
            Intitulé du parcours <span className="text-danger">*</span>
          </label>
          <input
            id="run-title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Ex. Suivi post-opératoire — mars 2026"
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div>
          <label htmlFor="run-start" className="mb-1 block text-sm font-medium text-fg">
            Date de début (J+0) <span className="text-danger">*</span>
          </label>
          <input
            id="run-start"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        {workflowInvalid ? (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-danger bg-[#FEF2F2] p-3 text-xs text-danger">
            <Icon name="CircleAlert" size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Ce workflow contient {validation!.errors.length} erreur{validation!.errors.length > 1 ? 's' : ''} de validation.</p>
              <p className="mt-0.5 text-fg-muted">
                Un parcours patient ne peut être démarré que sur un workflow valide. Ouvrez l'éditeur
                pour corriger les erreurs avant de réessayer.
              </p>
            </div>
          </div>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            type="submit"
            variant="primary"
            loading={createMut.isPending || detailLoading}
            disabled={!selectedPatient || !selectedWorkflow || !title.trim() || !startDate || workflowInvalid}
          >
            Démarrer
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
