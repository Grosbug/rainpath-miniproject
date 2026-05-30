import { KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Icon } from '@/components/Icon'
import { ParcoursPatientsButton } from '@/components/ParcoursPatientsButton'
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
import { TOOLBAR_DIVIDER, TOOLBAR_LEADING_GRID } from '@/lib/toolbar-layout'

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
  const prettifyLayout = useEditorStore(s => s.prettifyLayout)
  const nodeCount = useEditorStore(s => s.nodes.length)

  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(name)
  const [editingDesc, setEditingDesc] = useState(false)
  const [draftDesc, setDraftDesc] = useState(description)
  const [savePulse, setSavePulse] = useState(false)
  const savePulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [prettifyPulse, setPrettifyPulse] = useState(false)
  const prettifyPulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (savePulseTimer.current) clearTimeout(savePulseTimer.current)
    if (prettifyPulseTimer.current) clearTimeout(prettifyPulseTimer.current)
  }, [])

  const handlePrettifyClick = () => {
    prettifyLayout()
    toast.success('Schéma réorganisé')
    setPrettifyPulse(true)
    if (prettifyPulseTimer.current) clearTimeout(prettifyPulseTimer.current)
    prettifyPulseTimer.current = setTimeout(() => setPrettifyPulse(false), 800)
  }

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
    <div className='relative flex h-12 items-center gap-4 border-b border-border bg-surface px-6'>
      <div className={`min-w-0 flex-1 ${TOOLBAR_LEADING_GRID}`}>
        <button
          type='button'
          onClick={() => navigate('/workflows')}
          className='flex shrink-0 items-center gap-1 whitespace-nowrap text-sm text-fg-muted hover:text-fg'
        >
          <Icon name='ArrowLeft' size={16} />
          Workflows
        </button>
        <div className={TOOLBAR_DIVIDER} aria-hidden='true' />
        <div className='flex min-w-0 flex-col'>
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
      </div>

      {/* Validation badge — geometric center of the full bar width. */}
      <div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
        <div className='pointer-events-auto'>
          <ValidationStatusBadge />
        </div>
      </div>

      <div className='relative z-[1] flex flex-1 items-center justify-end gap-2'>
        <div className='flex items-center gap-1'>
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
          icon='Wand'
          aria-label='Réorganiser le schéma'
          onClick={handlePrettifyClick}
          disabled={nodeCount === 0}
          className={prettifyPulse ? 'animate-pulse bg-primary/15 text-primary ring-2 ring-primary/40' : undefined}
          data-rp-tooltip='Réorganiser le schéma (sans changer les délais)'
        />
        {/* Save status sits inline between the redo and save buttons so the "saved a few
            seconds ago" tooltip is right next to the action that triggered it. */}
        <SaveStatusBadge />
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
        {id ? <ParcoursPatientsButton workflowId={id} /> : null}
      </div>
    </div>
  )
}
