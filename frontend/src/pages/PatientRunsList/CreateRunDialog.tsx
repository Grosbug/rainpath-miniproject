import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { ApiError } from '@/api/client'
import { listPatientProfiles } from '@/api/patient-profiles'
import { createPatientRun } from '@/api/patient-runs'
import { queryKeys } from '@/api/query-keys'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  workflowId: string
}

export function CreateRunDialog({ open, onOpenChange, workflowId }: Props) {
  const [patientId, setPatientId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: profiles } = useQuery({
    queryKey: queryKeys.patientProfiles.list(),
    queryFn: listPatientProfiles,
    enabled: open
  })

  const createMut = useMutation({
    mutationFn: () => createPatientRun(workflowId, { patientId }),
    onSuccess: run => {
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.listForWorkflow(workflowId) })
      toast.success('Parcours créé')
      onOpenChange(false)
      navigate(`/workflows/${workflowId}/patient-runs/${run.id}`)
    },
    onError: e => setError(e instanceof ApiError ? e.body.errors?.[0]?.message ?? e.message : 'Erreur')
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!patientId) {
      setError('Choisissez un profil patient')
      return
    }
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
        <div>
          <label htmlFor="run-patient" className="mb-1 block text-sm font-medium text-fg">
            Profil patient <span className="text-danger">*</span>
          </label>
          <select
            id="run-patient"
            value={patientId}
            onChange={e => setPatientId(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Choisir un profil…</option>
            {profiles?.map(p => (
              <option key={p.id} value={p.id}>{p.name}{p.email ? ` (${p.email})` : ''}</option>
            ))}
          </select>
          {profiles && profiles.length === 0 ? (
            <p className="mt-1 text-xs text-fg-muted">
              Aucun profil. Créez-en un depuis la page <em>Patients</em>.
            </p>
          ) : null}
        </div>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="submit" variant="primary" loading={createMut.isPending} disabled={!patientId}>
            Démarrer
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
