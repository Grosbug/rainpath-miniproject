import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useEditorStore } from '../store'
import { friendlyValidationMessage } from '../validation-messages'
import { formatNodeLabel } from '../format-node-label'
import type { ValidationError } from '../store'
import type { GraphNode } from '../snapshot'

/** Stable identity for a validation entry — same code + same target = same problem. */
function key(e: { code: string; nodeId?: string; edgeId?: string }): string {
  return `${e.code}|${e.nodeId ?? ''}|${e.edgeId ?? ''}`
}

/** Resolve the user-facing text for an entry: optional node label prefix + friendly body.
 *  `incomplete_status_coverage` / `status_not_in_channel` carry detail in their raw message
 *  (the actual statuses) — preserve it; everything else uses the friendly translation. */
function formatBody(e: ValidationError, nodes: ReadonlyArray<GraphNode>): string {
  const label = formatNodeLabel(e.nodeId, nodes)
  const useRaw = e.code === 'incomplete_status_coverage' || e.code === 'status_not_in_channel'
  const body = useRaw ? e.message : friendlyValidationMessage(e.code, e.message)
  return label ? `${label} — ${body}` : body
}

/**
 * Surface validation errors AND warnings as Sonner toasts in the bottom-right corner.
 * Previously these used the cursor-anchored bubble system, but the editor was already busy
 * (canvas + popovers + inline pip badges on the nodes), so a fixed corner is now the
 * agreed home for validation-delta notifications. The pip on the node + the persistent
 * popover in the ValidationStatusBadge cover the "where exactly" question.
 *
 * Initial load is silent: only NEW errors / warnings trigger toasts. Same key — same code
 * + same nodeId/edgeId — is deduped so a single re-render storm doesn't fire twice.
 */
export function useValidationToasts() {
  const errors = useEditorStore(s => s.validationErrors)
  const warnings = useEditorStore(s => s.validationWarnings)
  const nodes = useEditorStore(s => s.nodes)
  const seenErrors = useRef<Set<string> | null>(null)
  const seenWarnings = useRef<Set<string> | null>(null)

  useEffect(() => {
    function surface(
      entries: ValidationError[],
      seen: { current: Set<string> | null },
      kind: 'error' | 'warning'
    ) {
      if (seen.current === null) {
        seen.current = new Set(entries.map(key))
        return
      }
      const currentKeys = new Set(entries.map(key))
      for (const e of entries) {
        const k = key(e)
        if (seen.current.has(k)) continue
        const message = formatBody(e, nodes)
        // `id: k` makes Sonner dedupe — the same code+target won't pile up two toasts
        // when validation runs twice in quick succession.
        if (kind === 'error') toast.error(message, { id: k, duration: 5000 })
        else toast.warning(message, { id: k, duration: 5000 })
      }
      seen.current = currentKeys
    }
    surface(errors, seenErrors, 'error')
    surface(warnings, seenWarnings, 'warning')
  }, [errors, warnings, nodes])
}
