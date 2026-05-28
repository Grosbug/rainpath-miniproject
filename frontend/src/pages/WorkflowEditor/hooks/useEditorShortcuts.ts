import { useEffect } from 'react'
import { useEditorStore } from '../store'

interface Options {
  saveNow: () => void
}

/**
 * Wires Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z (redo), Cmd/Ctrl+S (save),
 * Delete/Backspace (remove selected node or edge). Ignored when focus is in
 * an input/textarea or `contenteditable` to avoid hijacking text editing.
 */
export function useEditorShortcuts({ saveNow }: Options) {
  const undo = useEditorStore(s => s.undo)
  const redo = useEditorStore(s => s.redo)
  const removeNode = useEditorStore(s => s.removeNode)
  const removeEdge = useEditorStore(s => s.removeEdge)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const isEditing =
        tag === 'input' || tag === 'textarea' || (target?.isContentEditable ?? false)

      const mod = e.ctrlKey || e.metaKey

      if (mod && e.key.toLowerCase() === 'z' && e.shiftKey) {
        e.preventDefault()
        redo()
        return
      }
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveNow()
        return
      }
      if (!isEditing && (e.key === 'Delete' || e.key === 'Backspace')) {
        const s = useEditorStore.getState()
        if (s.selectedNodeId) {
          e.preventDefault()
          removeNode(s.selectedNodeId)
        } else if (s.selectedEdgeId) {
          e.preventDefault()
          removeEdge(s.selectedEdgeId)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, removeNode, removeEdge, saveNow])
}
