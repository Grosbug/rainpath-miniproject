import { useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updateWorkflow } from '@/api/workflows'
import { queryKeys } from '@/api/query-keys'
import { ApiError } from '@/api/client'
import { useEditorStore } from '../store'
import { hashSnapshot } from '../snapshot'
import type { ValidationError } from '../store'

const DEBOUNCE_MS = 1500
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000]

export function useAutoSave(): { saveNow: () => void } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef(false)
  const retryIxRef = useRef(0)
  const qc = useQueryClient()

  const performSave = useCallback(async () => {
    const s = useEditorStore.getState()
    if (!s.workflowId) return
    const isInvalid = s.validationErrors.length > 0
    const snap = s.snapshot()
    const hash = hashSnapshot(snap)
    if (hash === s.lastSavedSnapshotHash) {
      // Nothing changed; stay at last status.
      return
    }
    if (inFlightRef.current) {
      s.setPendingSave(true)
      return
    }
    inFlightRef.current = true
    s.setSaveStatus('saving')

    try {
      await updateWorkflow(s.workflowId, {
        name: snap.name,
        description: snap.description,
        graph: { nodes: snap.nodes, edges: snap.edges }
      })
      // Backend accepts invalid workflows (validation is enforced only when activating
      // a run). Reflect that nuance to the user via a distinct "saved with errors" state.
      s.markSaved(hash, new Date())
      if (isInvalid) s.setSaveStatus('saved_invalid', new Date())
      retryIxRef.current = 0
      qc.invalidateQueries({ queryKey: queryKeys.workflows.list() })
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        const errs: ValidationError[] = (e.body.errors ?? []).map(x => ({
          code: x.code,
          message: x.message,
          nodeId: x.nodeId,
          edgeId: x.edgeId
        }))
        s.setValidationErrors(errs)
        s.setSaveStatus('invalid')
      } else {
        s.setSaveStatus(retryIxRef.current >= RETRY_DELAYS.length ? 'offline' : 'error')
        const delay = RETRY_DELAYS[Math.min(retryIxRef.current, RETRY_DELAYS.length - 1)]
        retryIxRef.current = Math.min(retryIxRef.current + 1, RETRY_DELAYS.length)
        setTimeout(() => {
          // If another save has started since the failure, skip — that save replaces this retry.
          if (inFlightRef.current) return
          void performSave()
        }, delay)
      }
    } finally {
      inFlightRef.current = false
      if (useEditorStore.getState().pendingSave) {
        useEditorStore.getState().setPendingSave(false)
        // Defer to the microtask queue so React state updates settle first.
        Promise.resolve().then(() => { void performSave() })
      }
    }
  }, [qc])

  // Debounced trigger watching mutations.
  const nodes = useEditorStore(s => s.nodes)
  const edges = useEditorStore(s => s.edges)
  const name = useEditorStore(s => s.name)
  const description = useEditorStore(s => s.description)
  const workflowId = useEditorStore(s => s.workflowId)

  useEffect(() => {
    if (!workflowId) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { void performSave() }, DEBOUNCE_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [nodes, edges, name, description, workflowId, performSave])

  const saveNow = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    void performSave()
  }, [performSave])

  return { saveNow }
}
