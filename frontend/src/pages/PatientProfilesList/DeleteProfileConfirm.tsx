import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import type { PatientProfile } from '@/api/patient-profiles'
import { formatPatientFullName } from '@/lib/format-person-name'

interface Props {
  open: boolean
  target: PatientProfile | null
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteProfileConfirm({ open, target, loading, onCancel, onConfirm }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={o => !o && onCancel()}
      title={`Supprimer « ${target ? formatPatientFullName(target) : ''} » ?`}
      description="Le profil est archivé (suppression douce). Les parcours existants restent visibles mais marqués « Patient supprimé »."
      size="sm"
    >
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" autoFocus onClick={onCancel}>Annuler</Button>
        <Button type="button" variant="danger" loading={loading} onClick={onConfirm}>Supprimer</Button>
      </div>
    </Dialog>
  )
}
