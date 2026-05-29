import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Graph } from '@rainpath/shared'
import { advancePatientRun, resetPatientRun, stepBackPatientRun } from '@/api/patient-runs'
import { queryKeys } from '@/api/query-keys'
import { describeError } from '@/api/error-messages'
import {
  dayOfHistory, nextDefaultEdge,
  type PatientContactData
} from './cumulative-days'

type HistoryEntry = { nodeId: string; outcome?: string }

interface Args {
  runId: string
  workflowId: string
  graph: Graph
  focusedNodeId: string | null
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
  /** True while an /advance mutation is in flight. */
  autoAdvancing: boolean
  /** Hint about why the run can't move on its own. null = ready to advance. */
  pauseReason: 'multi_output' | 'awaiting_status' | 'end' | null
  /** Jump straight to the day the next event fires. No-op if none is pending. */
  jumpToNextEvent: () => void
  /** Reset cursor back to currentNodeDay (used when the user wants to "back to now"). */
  syncToCurrentNode: () => void
  /** IDs of nodes currently awaiting an observed status from the user. */
  currentNodeIds: readonly string[]
  /** Pending status selections keyed by node id (cleared on advance / node-change). */
  pendingByNode: Readonly<Record<string, string | undefined>>
  /** Stage a status choice locally — mutation fires later via advanceAllPending. */
  setPending: (nodeId: string, status: string | undefined) => void
  /** True when every current node has a pending status (or there are no current nodes). */
  allCurrentsHaveStatus: boolean
  /** True when at least one node still needs a status from the user. */
  anyCurrentMissingStatus: boolean
  /**
   * Fire /advance for every current node that has a pending status, sequentially.
   * No-op (returns false) when any current node is missing a selection.
   * Returns true on full success.
   */
  advanceAllPending: () => Promise<boolean>
  /** True when the run has visited at least one node beyond Start (i.e. step-back is meaningful). */
  canStepBack: boolean
  /** Pop the last history entry and rewind currentNodeId to the previous one. */
  stepBack: () => Promise<boolean>
  /** Wipe the run back to its Start node with an empty history. Always available. */
  resetRun: () => Promise<boolean>
}

/**
 * Drives the patient-run time cursor and the user-driven per-node status
 * resolution. All forward progress is explicit — the user picks an observed
 * status on each current send_* card and clicks the top-bar "Prochain", which
 * fires `advanceAllPending`.
 *
 * Cursor lives on the frontend (per the spec — progression is "simulée"):
 *   - `day = max(userCursor, currentNodeDay)` — auto-snaps forward when an
 *     advance moves the patient past the user's cursor.
 *   - Detects a reset (history shrinks back to [start]) and rewinds the cursor.
 *
 * Multi-current readiness: the backend still tracks a single currentNodeId, so
 * `currentNodeIds` is a one-element array in practice. The pending-status map
 * is keyed by nodeId so that the day a multi-incoming fan-out lands, no plumbing
 * change is needed here.
 */
export function useDaySimulator({ runId, workflowId, graph, focusedNodeId, history, profile }: Args): DaySimulator {
  const qc = useQueryClient()

  const currentNodeDay = useMemo(() => dayOfHistory(graph, history), [graph, history])

  const pendingEdge = useMemo(
    () => focusedNodeId ? nextDefaultEdge(graph, focusedNodeId) : undefined,
    [graph, focusedNodeId]
  )

  const currentNode = useMemo(
    () => focusedNodeId ? graph.nodes.find(n => n.id === focusedNodeId) ?? null : null,
    [graph, focusedNodeId]
  )

  const currentNodeIds = useMemo<readonly string[]>(() => {
    if (!focusedNodeId || !currentNode) return []
    if (currentNode.data.kind === 'end') return []
    return [focusedNodeId]
  }, [focusedNodeId, currentNode])

  // Pending per-node selections. Reset whenever the set of current ids changes
  // (i.e. after an advance moves the run forward) so stale selections don't
  // leak into the next node.
  const [pendingByNode, setPendingByNode] = useState<Record<string, string | undefined>>({})
  const lastCurrentKey = useRef<string>('')
  useEffect(() => {
    const key = [...currentNodeIds].sort().join('|')
    if (key !== lastCurrentKey.current) {
      lastCurrentKey.current = key
      setPendingByNode({})
    }
  }, [currentNodeIds])

  // `start` needs no status — it counts as "satisfied". For send_* the user
  // must have staged something in pendingByNode.
  const nodesById = useMemo(() => new Map(graph.nodes.map(n => [n.id, n])), [graph.nodes])
  const needsStatus = useCallback(
    (id: string) => nodesById.get(id)?.data.kind !== 'start',
    [nodesById]
  )
  const allCurrentsHaveStatus =
    currentNodeIds.length === 0 ||
    currentNodeIds.every(id => !needsStatus(id) || !!pendingByNode[id])
  const anyCurrentMissingStatus =
    currentNodeIds.length > 0 &&
    currentNodeIds.some(id => needsStatus(id) && !pendingByNode[id])

  const pauseReason = useMemo<DaySimulator['pauseReason']>(() => {
    if (!currentNode) return null
    if (currentNode.data.kind === 'end') return 'end'
    if (currentNode.data.kind === 'start') return null
    if (currentNode.data.params.output.mode === 'multi') return 'multi_output'
    return 'awaiting_status'
  }, [currentNode])

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
    mutationFn: ({ nodeId, outcome }: { nodeId: string; outcome?: string }) =>
      advancePatientRun(runId, { nodeId, ...(outcome ? { outcome } : {}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.detail(runId) })
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.listForWorkflow(workflowId) })
    },
    onError: e => {
      toast.error(describeError(e, 'Échec de l\'avancement.'))
      setUserCursor(currentNodeDay)
    }
  })

  const stepBackMut = useMutation({
    mutationFn: () => stepBackPatientRun(runId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.detail(runId) })
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.listForWorkflow(workflowId) })
      setPendingByNode({})
    },
    onError: e => toast.error(describeError(e, 'Échec du retour en arrière.'))
  })

  const resetMut = useMutation({
    mutationFn: () => resetPatientRun(runId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.detail(runId) })
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.listForWorkflow(workflowId) })
      setPendingByNode({})
      setUserCursor(0)
      toast.success('Parcours réinitialisé')
    },
    onError: e => toast.error(describeError(e, 'Échec de la réinitialisation.'))
  })

  // Auto-advance is gone: every node now waits on the user's "Prochain" button
  // in the top bar (start needs no status; send_* needs a pending pick). The
  // day cursor still advances visually when currentNodeDay jumps forward after
  // a successful /advance, so the J+N line on the canvas stays in sync.

  const jumpToNextEvent = useCallback(() => {
    if (nextEventDay === null) return
    setUserCursor(prev => Math.max(prev, nextEventDay))
  }, [nextEventDay])

  const syncToCurrentNode = useCallback(() => setUserCursor(currentNodeDay), [currentNodeDay])

  const setPending = useCallback((nodeId: string, status: string | undefined) => {
    setPendingByNode(prev => ({ ...prev, [nodeId]: status }))
  }, [])

  // Fire one /advance per current node sequentially. The backend's currentNodeId
  // changes after each call, so the second mutation only makes sense once the
  // first has settled — hence the await per call. `start` nodes advance with no
  // outcome; send_* nodes use the staged pending status. Returns false (no-op)
  // when any send_* node is missing a selection.
  const advanceAllPending = useCallback(async (): Promise<boolean> => {
    if (currentNodeIds.length === 0) return false
    for (const id of currentNodeIds) {
      if (needsStatus(id) && !pendingByNode[id]) return false
    }
    for (const id of currentNodeIds) {
      const status = needsStatus(id) ? pendingByNode[id] : undefined
      await advanceMut.mutateAsync({ nodeId: id, outcome: status })
    }
    setPendingByNode({})
    return true
    // mutateAsync is a stable reference from react-query
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNodeIds, pendingByNode, needsStatus])

  const canStepBack = history.length > 1
  const stepBack = useCallback(async (): Promise<boolean> => {
    if (!canStepBack) return false
    await stepBackMut.mutateAsync()
    return true
    // mutateAsync is stable from react-query
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canStepBack])

  const resetRun = useCallback(async (): Promise<boolean> => {
    await resetMut.mutateAsync()
    return true
    // mutateAsync is stable from react-query
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    day,
    currentNodeDay,
    nextEventDay,
    autoAdvancing: advanceMut.isPending || stepBackMut.isPending || resetMut.isPending,
    pauseReason,
    jumpToNextEvent,
    syncToCurrentNode,
    currentNodeIds,
    pendingByNode,
    setPending,
    allCurrentsHaveStatus,
    anyCurrentMissingStatus,
    advanceAllPending,
    canStepBack,
    stepBack,
    resetRun
  }
}
