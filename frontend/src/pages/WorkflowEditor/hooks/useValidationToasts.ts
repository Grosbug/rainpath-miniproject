import { useEffect, useRef } from 'react'
import { showAnchoredToast } from '@/components/AnchoredToasts'
import { useEditorStore } from '../store'
import { friendlyValidationMessage } from '../validation-messages'

/** Stable identity for a validation entry — same code + same target = same problem. */
function key(e: { code: string; nodeId?: string; edgeId?: string }): string {
  return `${e.code}|${e.nodeId ?? ''}|${e.edgeId ?? ''}`
}

/** Resolve the affected DOM element for an error, when one exists. Edge-id errors look at
 *  the `+ N j` chip; node-id errors look at the rendered React Flow node. */
function anchorForError(e: { nodeId?: string; edgeId?: string }): { x: number; y: number } | null {
  if (e.edgeId) {
    const el = document.querySelector(`[data-edge-label-id="${CSS.escape(e.edgeId)}"]`)
    if (el) {
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
  }
  if (e.nodeId) {
    const el = document.querySelector(`.react-flow__node[data-id="${CSS.escape(e.nodeId)}"]`)
    if (el) {
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
  }
  return null
}

/**
 * Surface validation errors as transient anchored toasts whenever a user action introduces
 * a NEW one. Errors with a `nodeId` / `edgeId` anchor to that specific element; "global"
 * errors (e.g. `no_path_start_to_end`, `cycle`) — and node/edge errors whose target wasn't
 * found in the DOM — fall back to the **cursor's last position**, slightly below it. That
 * keeps the message glued to where the user just clicked, rather than dropping it in the
 * top-center "lost in space" zone, which felt disconnected from the action.
 *
 * Initial load is silent: only NEW errors trigger toasts. Loading an already-broken workflow
 * doesn't spam the user — the persistent ValidationStatusBadge in the top bar covers that.
 */
export function useValidationToasts() {
  const errors = useEditorStore(s => s.validationErrors)
  const seen = useRef<Set<string> | null>(null)
  const mouse = useRef({ x: window.innerWidth / 2, y: 120 })

  useEffect(() => {
    const onMove = (e: MouseEvent) => { mouse.current.x = e.clientX; mouse.current.y = e.clientY }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [])

  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(errors.map(key))
      return
    }
    const currentKeys = new Set(errors.map(key))
    for (const e of errors) {
      const k = key(e)
      if (seen.current.has(k)) continue
      // Prefer the affected element; otherwise drop the toast right below the cursor's
      // current position so it visibly relates to the user's latest action.
      const fallback = { x: mouse.current.x, y: mouse.current.y + 24 }
      const anchor = anchorForError(e) ?? fallback
      showAnchoredToast({
        message: friendlyValidationMessage(e.code, e.message),
        type: 'error',
        x: anchor.x,
        y: anchor.y,
        durationMs: 4500
      })
    }
    seen.current = currentKeys
  }, [errors])
}
