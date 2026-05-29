import { useCallback } from 'react'
import { toast } from 'sonner'
import { useEditorStore } from '../store'

/**
 * Single source of truth for undo/redo behavior — both the TopBar buttons and the
 * Ctrl/Cmd+Z keyboard shortcut go through here so user feedback (toast + canUndo/canRedo
 * guards) stays consistent regardless of the trigger.
 */
export function useHistoryActions() {
  const undo = useEditorStore(s => s.undo)
  const redo = useEditorStore(s => s.redo)
  const canUndo = useEditorStore(s => s.historyIndex > 0)
  const canRedo = useEditorStore(s => s.historyIndex < s.history.length - 1)
  const undoCount = useEditorStore(s => s.historyIndex)
  const redoCount = useEditorStore(s => Math.max(0, s.history.length - 1 - s.historyIndex))

  const handleUndo = useCallback(() => {
    if (!canUndo) {
      toast('Rien à annuler', { duration: 1200 })
      return
    }
    undo()
    toast.success('Action annulée', { duration: 1500 })
  }, [canUndo, undo])

  const handleRedo = useCallback(() => {
    if (!canRedo) {
      toast('Rien à rétablir', { duration: 1200 })
      return
    }
    redo()
    toast.success('Action rétablie', { duration: 1500 })
  }, [canRedo, redo])

  return { handleUndo, handleRedo, canUndo, canRedo, undoCount, redoCount }
}
