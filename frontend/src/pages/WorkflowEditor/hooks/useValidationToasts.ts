import { useEffect, useRef } from 'react'
import { showAnchoredToast, type AnchoredToastType } from '@/components/AnchoredToasts'
import { useEditorStore } from '../store'
import { friendlyValidationMessage } from '../validation-messages'
import { formatNodeLabel } from '../format-node-label'
import type { ValidationError } from '../store'
import type { GraphNode } from '../snapshot'

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
/** Resolve the user-facing text for an entry: optional node label prefix + friendly body.
 *  `incomplete_status_coverage` / `status_not_in_channel` carry detail in their raw message
 *  (the actual statuses) — preserve it; everything else uses the friendly translation. */
function formatBody(e: ValidationError, nodes: ReadonlyArray<GraphNode>): string {
  const label = formatNodeLabel(e.nodeId, nodes)
  const useRaw = e.code === 'incomplete_status_coverage' || e.code === 'status_not_in_channel'
  const body = useRaw ? e.message : friendlyValidationMessage(e.code, e.message)
  return label ? `${label} — ${body}` : body
}

export function useValidationToasts() {
  const errors = useEditorStore(s => s.validationErrors)
  const warnings = useEditorStore(s => s.validationWarnings)
  const nodes = useEditorStore(s => s.nodes)
  const seenErrors = useRef<Set<string> | null>(null)
  const seenWarnings = useRef<Set<string> | null>(null)
  const mouse = useRef({ x: window.innerWidth / 2, y: 120 })

  useEffect(() => {
    const onMove = (e: MouseEvent) => { mouse.current.x = e.clientX; mouse.current.y = e.clientY }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [])

  // Fire toasts for both new errors AND new warnings. Warnings get the orange "warning"
  // tone so they're visually distinct from blocking errors. The popover in the top bar
  // still carries the persistent list — the toast is the in-the-moment nudge.
  useEffect(() => {
    function surface(entries: ValidationError[], seen: { current: Set<string> | null }, type: AnchoredToastType) {
      if (seen.current === null) {
        seen.current = new Set(entries.map(key))
        return
      }
      const currentKeys = new Set(entries.map(key))
      for (const e of entries) {
        if (seen.current.has(key(e))) continue
        const anchor = anchorForError(e) ?? { x: mouse.current.x, y: mouse.current.y + 24 }
        showAnchoredToast({
          message: formatBody(e, nodes),
          type,
          x: anchor.x,
          y: anchor.y,
          durationMs: 4500
        })
      }
      seen.current = currentKeys
    }
    surface(errors, seenErrors, 'error')
    surface(warnings, seenWarnings, 'warning')
  }, [errors, warnings, nodes])
}
