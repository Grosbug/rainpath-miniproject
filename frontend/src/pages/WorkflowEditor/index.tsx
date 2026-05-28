import { useParams } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { useWorkflowLoader } from './hooks/useWorkflowLoader'
import { useAutoSave } from './hooks/useAutoSave'
import { useEditorShortcuts } from './hooks/useEditorShortcuts'
import { TopBar } from './TopBar'
import { Canvas } from './Canvas'

export default function WorkflowEditor() {
  const { id } = useParams<{ id: string }>()
  const query = useWorkflowLoader(id)
  const { saveNow } = useAutoSave()
  useEditorShortcuts({ saveNow })

  if (query.isLoading) {
    return (
      <div className="flex min-h-[calc(100dvh-48px)] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <Icon name="LoaderCircle" size={20} className="animate-spin" />
          Chargement…
        </div>
      </div>
    )
  }

  if (query.error || !query.data) {
    return (
      <div className="flex min-h-[calc(100dvh-48px)] items-center justify-center p-8">
        <div className="max-w-md text-center">
          <Icon name="CircleAlert" size={24} className="mx-auto text-danger" />
          <h1 className="mt-4 text-xl font-semibold text-fg">Workflow introuvable</h1>
          <p className="mt-2 text-sm text-fg-muted">
            Ce workflow n'existe pas, a été supprimé, ou le serveur est inaccessible.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-48px)] flex-col">
      <TopBar saveNow={saveNow} />
      <div className="relative flex-1">
        <Canvas />
      </div>
    </div>
  )
}
