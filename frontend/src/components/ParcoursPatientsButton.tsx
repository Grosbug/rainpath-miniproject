import { useNavigate } from 'react-router-dom'
import { PatientRunsBadge } from '@/components/PatientRunsBadge'

interface Props {
  workflowId: string
  className?: string
}

/** Accès aux parcours patients — pilule Play + libellé, pour barres d’outils. */
export function ParcoursPatientsButton({ workflowId, className }: Props) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(`/workflows/${workflowId}/patient-runs`)}
      className={
        'inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg ' +
        'transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 ' +
        'focus-visible:ring-ring focus-visible:ring-offset-2 ' +
        (className ?? '')
      }
    >
      <PatientRunsBadge />
      Parcours patients
    </button>
  )
}
