import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { queryKeys } from '@/api/query-keys'
import {
  deleteWorkflow,
  duplicateWorkflow,
  listWorkflows,
  type WorkflowSummary
} from '@/api/workflows'
import { WorkflowsTable } from './WorkflowsTable'
import { CreateWorkflowDialog } from './CreateWorkflowDialog'
import { DeleteWorkflowConfirm } from './DeleteWorkflowConfirm'

export default function WorkflowsList() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [toDelete, setToDelete] = useState<WorkflowSummary | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.workflows.list(),
    queryFn: listWorkflows
  })

  const duplicateMut = useMutation({
    mutationFn: (id: string) => duplicateWorkflow(id, {}),
    onSuccess: wf => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.list() })
      toast.success(`Workflow dupliqué : « ${wf.name} »`)
    },
    onError: () => toast.error('Échec de la duplication')
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteWorkflow(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.list() })
      const name = data?.find(w => w.id === id)?.name ?? 'le workflow'
      toast.success(`« ${name} » supprimé`)
      setToDelete(null)
    },
    onError: () => toast.error('Échec de la suppression')
  })

  return (
    <div className='mx-auto max-w-6xl px-6 py-8'>
      <header className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold tracking-tight text-fg'>Workflows</h1>
        <div className='flex gap-2'>
          <Button variant='primary' onClick={() => setCreateOpen(true)}>
            <Icon name='Plus' size={16} />
            Nouveau workflow
          </Button>
        </div>
      </header>

      <div className='mt-8'>
        {isLoading ? (
          <div role="status" aria-live="polite" className='rounded-lg border border-border bg-surface p-8 text-center text-sm text-fg-muted'>
            Chargement…
          </div>
        ) : error ? (
          <div role="alert" className='rounded-lg border border-border bg-surface p-8 text-center'>
            <p className='text-sm text-fg'>Impossible de charger les workflows.</p>
            <Button variant='secondary' className='mt-4' onClick={() => refetch()}>
              <Icon name='RotateCw' size={16} />
              Réessayer
            </Button>
          </div>
        ) : !data || data.length === 0 ? (
          <div className='mx-auto max-w-md rounded-lg border border-border bg-surface p-8 text-center'>
            <Icon name='ListPlus' size={24} className='mx-auto text-fg-muted' />
            <p className='mt-4 text-sm text-fg'>Aucun workflow créé pour le moment.</p>
            <Button variant='primary' className='mt-4' onClick={() => setCreateOpen(true)}>
              Créer mon premier workflow
            </Button>
          </div>
        ) : (
          <WorkflowsTable
            rows={data}
            onDuplicate={id => duplicateMut.mutate(id)}
            onDelete={row => setToDelete(row)}
          />
        )}
      </div>

      <CreateWorkflowDialog open={createOpen} onOpenChange={setCreateOpen} />
      <DeleteWorkflowConfirm
        open={!!toDelete}
        target={toDelete}
        loading={deleteMut.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteMut.mutate(toDelete.id)}
      />
    </div>
  )
}
