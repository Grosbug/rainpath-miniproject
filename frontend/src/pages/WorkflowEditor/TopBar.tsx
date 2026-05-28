import { KeyboardEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Icon } from '@/components/Icon'
import { IconButton } from '@/components/ui/IconButton'
import {
  DropdownMenu, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator
} from '@/components/ui/DropdownMenu'
import { downloadJson } from '@/lib/download-json'
import { duplicateWorkflow, deleteWorkflow, getWorkflow } from '@/api/workflows'
import { queryKeys } from '@/api/query-keys'
import { useEditorStore } from './store'
import { SaveStatusBadge } from './SaveStatusBadge'

interface Props {
  saveNow: () => void
}

export function TopBar({ saveNow }: Props) {
  const id = useEditorStore(s => s.workflowId)
  const name = useEditorStore(s => s.name)
  const description = useEditorStore(s => s.description)
  const setName = useEditorStore(s => s.setName)
  const setDescription = useEditorStore(s => s.setDescription)
  const undo = useEditorStore(s => s.undo)
  const redo = useEditorStore(s => s.redo)
  const canUndo = useEditorStore(s => s.historyIndex > 0)
  const canRedo = useEditorStore(s => s.historyIndex < s.history.length - 1)

  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(name)
  const [editingDesc, setEditingDesc] = useState(false)
  const [draftDesc, setDraftDesc] = useState(description)

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

  const handleExport = async () => {
    if (!id) return
    try {
      const wf = await getWorkflow(id)
      downloadJson(`${(wf.name || 'workflow').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}.json`, wf)
      toast.success('Export téléchargé')
    } catch {
      toast.error('Échec de l\'export')
    }
  }

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

      <div className='flex min-w-0 flex-1 flex-col'>
        {editingName ? (
          <input
            autoFocus
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onBlur={() => { setName(draftName.trim() || name); setEditingName(false) }}
            onKeyDown={onNameKey}
            className='h-7 w-full max-w-md rounded border border-border bg-surface px-2 text-sm font-semibold text-fg'
          />
        ) : (
          <button
            type='button'
            onClick={() => { setDraftName(name); setEditingName(true) }}
            className='truncate text-left text-sm font-semibold text-fg hover:underline'
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

      <SaveStatusBadge />

      <div className='flex items-center gap-1'>
        <IconButton icon='Undo2' aria-label='Annuler' onClick={undo} disabled={!canUndo} />
        <IconButton icon='Redo2' aria-label='Rétablir' onClick={redo} disabled={!canRedo} />
        <IconButton icon='Save' aria-label='Enregistrer maintenant' onClick={saveNow} />
        <DropdownMenu>
          <DropdownTrigger asChild>
            <IconButton icon='EllipsisVertical' aria-label="Plus d'actions" />
          </DropdownTrigger>
          <DropdownContent>
            <DropdownItem icon='Copy' onSelect={() => dupMut.mutate()}>Dupliquer</DropdownItem>
            <DropdownItem icon='Download' onSelect={handleExport}>Exporter en JSON</DropdownItem>
            <DropdownSeparator />
            <DropdownItem icon='Trash2' danger onSelect={() => delMut.mutate()}>Supprimer</DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
