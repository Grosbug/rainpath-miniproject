import { FormEvent, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { ApiError } from '@/api/client'
import { createWorkflow } from '@/api/workflows'
import { queryKeys } from '@/api/query-keys'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateWorkflowDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const qc = useQueryClient()
  const navigate = useNavigate()

  const mut = useMutation({
    mutationFn: () =>
      createWorkflow({ name: name.trim(), description: description.trim() || undefined }),
    onSuccess: wf => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.list() })
      toast.success('Workflow créé')
      reset()
      onOpenChange(false)
      navigate(`/workflows/${wf.id}`)
    },
    onError: err => {
      setError(err instanceof ApiError ? err.body.errors?.[0]?.message ?? err.message : 'Erreur')
    }
  })

  const reset = () => {
    setName('')
    setDescription('')
    setError(null)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Le nom est requis')
      return
    }
    mut.mutate()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Nouveau workflow"
      description="Donnez-lui un nom pour démarrer. Vous pourrez modifier description et graphe ensuite."
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="wf-name" className="mb-1 block text-sm font-medium text-fg">
            Nom <span className="text-danger">*</span>
          </label>
          <input
            id="wf-name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div>
          <label htmlFor="wf-desc" className="mb-1 block text-sm font-medium text-fg">
            Description
          </label>
          <textarea
            id="wf-desc"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" loading={mut.isPending}>
            Créer
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
