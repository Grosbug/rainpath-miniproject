import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import type { WorkflowSummary } from '@/api/workflows'

interface Props {
  open: boolean
  target: WorkflowSummary | null
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteWorkflowConfirm({ open, target, loading, onCancel, onConfirm }: Props) {
  const name = target?.name ?? ''
  return (
    <Dialog
      open={open}
      onOpenChange={o => !o && onCancel()}
      title={`Supprimer « ${name} » ?`}
      description="L'élément est archivé (suppression douce) et n'apparaît plus dans la liste."
      size="sm"
    >
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" autoFocus onClick={onCancel}>
          Annuler
        </Button>
        <Button type="button" variant="danger" loading={loading} onClick={onConfirm}>
          Supprimer
        </Button>
      </div>
    </Dialog>
  )
}
