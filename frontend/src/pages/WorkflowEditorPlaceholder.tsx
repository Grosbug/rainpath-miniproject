import { Link, useParams } from 'react-router-dom'
import { Icon } from '@/components/Icon'

export default function WorkflowEditorPlaceholder() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="flex min-h-[calc(100dvh-48px)] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <Icon name="Construction" size={24} className="mx-auto text-fg-muted" />
        <h1 className="mt-4 text-2xl font-semibold text-fg">Éditeur — Phase 1B-B</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Workflow <span className="font-mono text-xs">{id}</span> ouvert ici dans la prochaine itération.
        </p>
        <Link
          to="/workflows"
          className="mt-6 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Retour à la liste
        </Link>
      </div>
    </div>
  )
}
