import { useEffect, useRef, useState, useCallback } from 'react'
import type { Connection, Edge } from '@xyflow/react'
import { useEditorStore } from '../store'
import { showAnchoredToast } from '@/components/AnchoredToasts'
import { friendlyValidationMessage } from '../validation-messages'
import { validateConnection } from './validate-connection'

export type HandleRef = {
  nodeId: string
  /** React Flow handle id — null/undefined for nodes with a single implicit slot. */
  handleId: string | null
  type: 'source' | 'target'
}

export type ConnectionInteraction =
  | { mode: 'idle' }
  | { mode: 'creating-edge'; from: HandleRef }

/**
 * Map a React Flow handle DOM element back to its semantic identity.
 * Handles use `data-nodeid` + `data-handleid` + a `source` | `target` class.
 */
function extractHandle(el: HTMLElement): HandleRef | null {
  const nodeId = el.getAttribute('data-nodeid')
  const rawHandleId = el.getAttribute('data-handleid')
  const type: 'source' | 'target' | null = el.classList.contains('source')
    ? 'source'
    : el.classList.contains('target')
    ? 'target'
    : null
  if (!nodeId || !type) return null
  const handleId = rawHandleId && rawHandleId !== 'null' ? rawHandleId : null
  return { nodeId, handleId, type }
}

const REJECTION_FRIENDLY: Record<string, string> = {
  self_loop: 'Auto-connexion impossible',
  cycle: 'Boucle détectée — connexion impossible',
  handle_conflict: 'Cette sortie est déjà utilisée',
  dangling: 'Nœud cible inexistant',
  edge_into_start: 'Impossible d\'entrer dans le nœud Départ',
  edge_from_end: 'Impossible de partir d\'un nœud Fin',
  unreachable_source: 'Connectez d\'abord ce nœud au flux principal avant d\'en partir',
  invalid_source_handle: 'Reliez depuis la poignée Succès ou Échec du nœud (pas depuis le corps de la carte).',
  incompatible_handles: 'Sortie incompatible — utilisez la poignée Succès ou Échec correspondante.'
}

/**
 * Click-based edge CREATION state machine. Reconnect / detach mode has been removed —
 * clicking a handle always starts a new connection; modifying an existing edge means
 * deleting it (chip popover) and re-drawing.
 *
 *   idle ──click handle──► creating-edge ──click compatible handle──► commit ► idle
 *                                       └─right-click / pane click / Esc──► idle
 *
 * Implementation notes:
 *   • Uses event-delegation on `document` (capture phase) so the listener runs ahead of any
 *     React Flow handlers — RF's built-in click connection mode is also disabled in Canvas.tsx
 *     to avoid two systems fighting for the same handle clicks.
 *   • Source-side rules ARE the validation layer in `store.addEdge` (cycle, unreachable_source,
 *     handle_conflict, …). Clicking a discrete source slot that is already used surfaces a
 *     friendly `handle_conflict` toast on commit.
 */
export function useClickConnection() {
  const [interaction, setInteraction] = useState<ConnectionInteraction>({ mode: 'idle' })
  const nodes = useEditorStore(s => s.nodes)
  const edges = useEditorStore(s => s.edges)
  const addEdge = useEditorStore(s => s.addEdge)

  // Latest values snapshot — event listeners are registered once and read through this ref
  // so they always see fresh nodes / edges without re-binding on every render.
  const latest = useRef({ interaction, nodes, edges, addEdge })
  latest.current = { interaction, nodes, edges, addEdge }

  const cancel = useCallback(() => setInteraction({ mode: 'idle' }), [])

  useEffect(() => {
    function complete(target: HandleRef, eventX: number, eventY: number) {
      const it = latest.current.interaction
      if (it.mode !== 'creating-edge') return
      // Compatible = opposite type. Source can only connect to target, and vice versa.
      if (target.type === it.from.type) {
        showAnchoredToast({
          message: 'Connectez une sortie à une entrée (ou inversement)',
          type: 'error',
          x: eventX, y: eventY
        })
        return
      }
      const sourceH = it.from.type === 'source' ? it.from : target
      const targetH = it.from.type === 'target' ? it.from : target

      // Compute daysAfter so the target keeps its current X (same trick as the drag path).
      const srcNode = latest.current.nodes.find(n => n.id === sourceH.nodeId)
      const tgtNode = latest.current.nodes.find(n => n.id === targetH.nodeId)
      const daysAfter = srcNode && tgtNode
        ? Math.max(0, Math.round(tgtNode.position.x - srcNode.position.x))
        : 0

      const result = latest.current.addEdge({
        source: sourceH.nodeId,
        target: targetH.nodeId,
        sourceHandle: sourceH.handleId ?? undefined,
        daysAfter
      })
      if (!result.ok) {
        showAnchoredToast({
          message: REJECTION_FRIENDLY[result.reason] ?? friendlyValidationMessage(result.reason),
          type: 'error',
          x: eventX, y: eventY
        })
      }
      setInteraction({ mode: 'idle' })
    }

    function onClick(e: MouseEvent) {
      if (e.button !== 0) return // only left-click drives the state machine
      const target = e.target as HTMLElement | null
      const handleEl = target?.closest<HTMLElement>('.react-flow__handle')
      if (!handleEl) {
        // Click anywhere off a handle while interacting → cancel (idle clicks: no-op).
        if (latest.current.interaction.mode !== 'idle') {
          // Don't cancel for clicks on the edge chips / popovers / kebabs etc. — only the
          // pane (the React Flow background) should clear the interaction.
          if (target?.closest('.react-flow__pane')) {
            setInteraction({ mode: 'idle' })
          }
        }
        return
      }
      // Beat any default handlers (RF, edge selection, etc.) — we own click behavior on handles.
      e.stopPropagation()
      e.preventDefault()

      const h = extractHandle(handleEl)
      if (!h) return

      const it = latest.current.interaction
      if (it.mode === 'idle') {
        // Always create. If the clicked handle is an already-used discrete source slot,
        // the validation layer will reject the commit with a friendly handle_conflict toast.
        setInteraction({ mode: 'creating-edge', from: h })
      } else {
        complete(h, e.clientX, e.clientY)
      }
    }

    function onContextMenu(e: MouseEvent) {
      if (latest.current.interaction.mode !== 'idle') {
        e.preventDefault()
        setInteraction({ mode: 'idle' })
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && latest.current.interaction.mode !== 'idle') {
        setInteraction({ mode: 'idle' })
      }
    }

    /**
     * Proactive validity feedback: while an interaction is active, the handle currently
     * under the cursor is tagged via `data-rp-conn-state="valid|invalid"`. CSS in
     * globals.css picks that up to paint a green / red ring, so the user knows whether
     * a click here would commit cleanly without having to attempt it. Cleared on mouseout
     * and on interaction reset.
     */
    let lastHovered: HTMLElement | null = null
    function clearHover() {
      if (lastHovered) {
        lastHovered.removeAttribute('data-rp-conn-state')
        lastHovered = null
      }
    }
    function onMouseOver(e: MouseEvent) {
      const it = latest.current.interaction
      if (it.mode === 'idle') { clearHover(); return }
      const target = e.target as HTMLElement | null
      const handleEl = target?.closest<HTMLElement>('.react-flow__handle')
      if (!handleEl) { clearHover(); return }
      if (handleEl === lastHovered) return
      clearHover()
      const h = extractHandle(handleEl)
      if (!h) return
      const sourceH = it.from.type === 'source' ? it.from : h
      const targetH = it.from.type === 'target' ? it.from : h
      const verdict = validateConnection(
        {
          sourceNodeId: sourceH.nodeId,
          sourceHandleId: sourceH.handleId,
          targetNodeId: targetH.nodeId,
          sourceType: sourceH.type,
          targetType: targetH.type
        },
        { nodes: latest.current.nodes, edges: latest.current.edges }
      )
      handleEl.setAttribute('data-rp-conn-state', verdict === 'ok' ? 'valid' : 'invalid')
      lastHovered = handleEl
    }

    document.addEventListener('click', onClick, true)
    document.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mouseover', onMouseOver)
    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mouseover', onMouseOver)
      clearHover()
    }
  }, [])

  /**
   * `isValidConnection` hook for ReactFlow — runs during native drag-to-connect (the path
   * we don't fully own). Returns false for any rejection so RF paints the connection line
   * red and refuses to fire onConnect.
   */
  const isValidConnection = useCallback((c: Edge | Connection): boolean => {
    if (!c.source || !c.target) return false
    return validateConnection(
      {
        sourceNodeId: c.source,
        sourceHandleId: c.sourceHandle ?? null,
        targetNodeId: c.target,
        sourceType: 'source',
        targetType: 'target'
      },
      latest.current
    ) === 'ok'
  }, [])

  return { interaction, cancel, isValidConnection }
}
