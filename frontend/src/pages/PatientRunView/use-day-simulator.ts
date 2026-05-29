import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Graph } from '@rainpath/shared'
import { advancePatientRun } from '@/api/patient-runs'
import { queryKeys } from '@/api/query-keys'
import { describeError } from '@/api/error-messages'
import {
  dayOfHistory, defaultOutcomeFor, nextDefaultEdge,
  type PatientContactData
} from './cumulative-days'

type HistoryEntry = { nodeId: string; outcome?: string }

interface Args {
  runId: string
  workflowId: string
  graph: Graph
  currentNodeId: string | null
  history: HistoryEntry[]
  profile: PatientContactData
}

export interface DaySimulator {
  /** Cursor day (J+N) — never less than the day the current node was entered. */
  day: number
  /** Day at which the current node was entered (sum of daysAfter on traversed edges). */
  currentNodeDay: number
  /** Day at which the next default event would fire. Null when nothing is pending. */
  nextEventDay: number | null
  /** True while an auto-advance mutation is in flight. */
  autoAdvancing: boolean
  /** Why auto-advance is paused. null = runs free. */
  pauseReason: 'multi_output' | 'end' | null
  /** Jump straight to the day the next event fires. No-op if none is pending. */
  jumpToNextEvent: () => void
  /** Reset cursor back to currentNodeDay (used when the user wants to "back to now"). */
  syncToCurrentNode: () => void
}

/**
 * Drives the patient-run time cursor and the auto-advance loop.
 *
 * Cursor lives on the frontend (per the spec — progression is "simulée"):
 *   - `day = max(userCursor, currentNodeDay)` — auto-snaps forward when a
 *     manual advance moves the patient past the user's cursor.
 *   - Whenever `day >= currentNodeDay + nextDefaultEdge.daysAfter`, we POST
 *     /advance with the default success outcome, refetch, and the effect
 *     re-evaluates against the new node.
 *   - Pauses on multi-output / end — user picks a branch in
 *     PatientAdvanceControls and the loop resumes.
 *   - Detects a reset (history shrinks back to [start]) and rewinds the cursor.
 */
export function useDaySimulator({ runId, workflowId, graph, currentNodeId, history, profile }: Args): DaySimulator {
  const qc = useQueryClient()

  const currentNodeDay = useMemo(() => dayOfHistory(graph, history), [graph, history])

  const pendingEdge = useMemo(
    () => currentNodeId ? nextDefaultEdge(graph, currentNodeId) : undefined,
    [graph, currentNodeId]
  )

  const pauseReason = useMemo<DaySimulator['pauseReason']>(() => {
    if (!currentNodeId) return null
    const node = graph.nodes.find(n => n.id === currentNodeId)
    if (!node) return null
    if (node.data.kind === 'end') return 'end'
    if (node.data.kind !== 'start' && node.data.params.output.mode === 'multi') return 'multi_output'
    return null
  }, [graph, currentNodeId])

  const [userCursor, setUserCursor] = useState(0)
  const day = Math.max(userCursor, currentNodeDay)
  const nextEventDay = pendingEdge ? currentNodeDay + pendingEdge.daysAfter : null

  // Reset detection: history shrinking back to a single start entry means the
  // patient run was reset — rewind the user cursor to 0 so the simulator starts
  // fresh instead of auto-advancing through the whole workflow again.
  const lastHistoryLen = useRef(history.length)
  useEffect(() => {
    if (history.length === 1 && lastHistoryLen.current > 1) {
      setUserCursor(0)
    }
    lastHistoryLen.current = history.length
  }, [history.length])

  const advanceMut = useMutation({
    mutationFn: (outcome: string | undefined) =>
      advancePatientRun(runId, outcome ? { outcome } : {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.detail(runId) })
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.listForWorkflow(workflowId) })
    },
    onError: e => {
      toast.error(describeError(e, 'Échec de l\'auto-avancement.'))
      // Pull the cursor back to "now" so the loop doesn't immediately retry.
      setUserCursor(currentNodeDay)
    }
  })

  // Auto-advance loop: fire one /advance per render tick when the cursor has
  // crossed the next event day. After the refetch, currentNodeDay jumps up,
  // pendingEdge is recomputed, and the effect runs again until either the
  // cursor catches the node again or we hit a pause condition.
  useEffect(() => {
    if (advanceMut.isPending) return
    if (pauseReason) return
    if (!pendingEdge) return
    if (nextEventDay === null) return
    if (day < nextEventDay) return
    if (!currentNodeId) return
    const outcome = defaultOutcomeFor(graph, currentNodeId, profile)
    if (outcome === undefined) return // no realistic outcome (no contact data + no failure status) → pause
    advanceMut.mutate(outcome)
    // advanceMut.mutate / advanceMut.isPending stable refs across renders, safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, pendingEdge, nextEventDay, pauseReason, advanceMut.isPending, currentNodeId, graph, profile])

  const jumpToNextEvent = useCallback(() => {
    if (nextEventDay === null) return
    setUserCursor(prev => Math.max(prev, nextEventDay))
  }, [nextEventDay])

  const syncToCurrentNode = useCallback(() => setUserCursor(currentNodeDay), [currentNodeDay])

  return {
    day,
    currentNodeDay,
    nextEventDay,
    autoAdvancing: advanceMut.isPending,
    pauseReason,
    jumpToNextEvent,
    syncToCurrentNode
  }
}
