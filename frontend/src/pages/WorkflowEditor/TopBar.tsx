import { KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import {
  DropdownMenu, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator
} from '@/components/ui/DropdownMenu'
import { duplicateWorkflow, deleteWorkflow } from '@/api/workflows'
import { queryKeys } from '@/api/query-keys'
import { useEditorStore } from './store'
import { useHistoryActions } from './hooks/useHistoryActions'
import { SaveStatusBadge } from './SaveStatusBadge'
import { ValidationStatusBadge } from './ValidationStatusBadge'

interface Props {
  saveNow: () => void
}

export function TopBar({ saveNow }: Props) {
  const id = useEditorStore(s => s.workflowId)
  const name = useEditorStore(s => s.name)
  const description = useEditorStore(s => s.description)
  const setName = useEditorStore(s => s.setName)
  const setDescription = useEditorStore(s => s.setDescription)
  const { handleUndo, handleRedo, canUndo, canRedo, undoCount, redoCount } = useHistoryActions()

  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(name)
  const [editingDesc, setEditingDesc] = useState(false)
  const [draftDesc, setDraftDesc] = useState(description)
  const [savePulse, setSavePulse] = useState(false)
  const savePulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (savePulseTimer.current) clearTimeout(savePulseTimer.current)
  }, [])

  const handleSaveClick = () => {
    saveNow()
    toast.success('Enregistrement déclenché')
    setSavePulse(true)
    if (savePulseTimer.current) clearTimeout(savePulseTimer.current)
    savePulseTimer.current = setTimeout(() => setSavePulse(false), 800)
  }

  useEffect(() => {
    if (!editingName) setDraftName(name)
  }, [name, editingName])
  useEffect(() => {
    if (!editingDesc) setDraftDesc(description)
  }, [description, editingDesc])

  const qc = useQueryClient()
  const navigate = useNavigate()

  const dupMut = useMutation({
    mutationFn: () => duplicateWorkflow(id!, {}),
    onSuccess: wf => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.list() })
      toast.success('Workflow dupliqué')
      navigate(`/workflows/${wf.id}`)
    },
    onError: () => toast.error('Échec de la duplication')
  })

  const delMut = useMutation({
    mutationFn: () => deleteWorkflow(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.list() })
      toast.success('Workflow supprimé')
      navigate('/workflows')
    },
    onError: () => toast.error('Échec de la suppression')
  })

  const onNameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { setName(draftName.trim() || name); setEditingName(false) }
    if (e.key === 'Escape') { setDraftName(name); setEditingName(false) }
  }
  const onDescKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { setDescription(draftDesc); setEditingDesc(false) }
    if (e.key === 'Escape') { setDraftDesc(description); setEditingDesc(false) }
  }

  return (
    <div className='sticky top-12 z-10 flex h-12 items-center gap-4 border-b border-border bg-surface px-6'>
      <button
        type='button'
        onClick={() => navigate('/workflows')}
        className='flex items-center gap-1 text-sm text-fg-muted hover:text-fg'
      >
        <Icon name='ArrowLeft' size={16} />
        Workflows
      </button>

      {/* Left-aligned with a small leading gap so the title/description sit slightly
          further from the back button than the default flex `gap-4` allows, without
          drifting into the centered position. */}
      <div className='flex min-w-0 flex-1 flex-col pl-6'>
        {editingName ? (
          <input
            autoFocus
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onBlur={() => { setName(draftName.trim() || name); setEditingName(false) }}
            onKeyDown={onNameKey}
            className='h-7 w-full max-w-md rounded border border-border bg-surface px-2 text-base font-semibold text-fg'
          />
        ) : (
          <button
            type='button'
            onClick={() => { setDraftName(name); setEditingName(true) }}
            className='truncate text-left text-base font-semibold text-fg hover:underline'
          >
            {name || '(sans titre)'}
          </button>
        )}
        {editingDesc ? (
          <input
            autoFocus
            value={draftDesc}
            onChange={e => setDraftDesc(e.target.value)}
            onBlur={() => { setDescription(draftDesc); setEditingDesc(false) }}
            onKeyDown={onDescKey}
            className='mt-0.5 h-6 w-full max-w-md rounded border border-border bg-surface px-2 text-xs text-fg-muted'
          />
        ) : (
          <button
            type='button'
            onClick={() => { setDraftDesc(description); setEditingDesc(true) }}
            className='truncate text-left text-xs text-fg-muted hover:text-fg'
          >
            {description || 'Ajouter une description'}
          </button>
        )}
      </div>

      <div className='flex items-center gap-3'>
        <ValidationStatusBadge />
        <SaveStatusBadge />
      </div>

      <div className='flex items-center gap-1'>
        <Button
          variant='secondary'
          size='sm'
          onClick={() => navigate(`/workflows/${id}/patient-runs`)}
        >
          <Icon name='Play' size={16} />
          Parcours patients
        </Button>
        <IconButton
          icon='Undo2'
          aria-label='Annuler'
          onClick={handleUndo}
          disabled={!canUndo}
          data-rp-tooltip={canUndo ? `Annuler (${undoCount} action${undoCount > 1 ? 's' : ''} en arrière)` : 'Rien à annuler'}
        />
        <IconButton
          icon='Redo2'
          aria-label='Rétablir'
          onClick={handleRedo}
          disabled={!canRedo}
          data-rp-tooltip={canRedo ? `Rétablir (${redoCount} action${redoCount > 1 ? 's' : ''} en avant)` : 'Rien à rétablir'}
        />
        <IconButton
          icon='Save'
          aria-label='Enregistrer maintenant'
          onClick={handleSaveClick}
          className={savePulse ? 'animate-pulse bg-success/15 text-success ring-2 ring-success/40' : undefined}
        />
        <DropdownMenu>
          <DropdownTrigger asChild>
            <IconButton icon='EllipsisVertical' aria-label="Plus d'actions" />
          </DropdownTrigger>
          <DropdownContent>
            <DropdownItem icon='Copy' onSelect={() => dupMut.mutate()}>Dupliquer</DropdownItem>
            <DropdownSeparator />
            <DropdownItem icon='Trash2' danger onSelect={() => delMut.mutate()}>Supprimer</DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
