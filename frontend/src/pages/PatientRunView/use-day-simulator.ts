import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Graph } from '@rainpath/shared'
import {
  coerceOutcomeForAdvance,
  hasContactForSendNode,
  observableStatusesForSendNode,
  preferredSuccessOutcome
} from './outcome-routing'
import { advancePatientRun, resetPatientRun, stepBackPatientRun } from '@/api/patient-runs'
import { queryKeys } from '@/api/query-keys'
import { describeError } from '@/api/error-messages'
import { dayAtNode, type PatientContactData } from './cumulative-days'

type HistoryEntry = { nodeId: string; outcome?: string }

interface Args {
  runId: string
  workflowId: string
  graph: Graph
  focusedNodeId: string | null
  activeFrontiers: readonly string[]
  actionableNodeIds: readonly string[]
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
 * The J+N cursor follows the focused node (`dayAtNode`), not the end of history,
 * so parallel branches and status picking stay aligned with the canvas card.
 *
 * Multi-current readiness: the backend still tracks a single currentNodeId, so
 * `currentNodeIds` is a one-element array in practice. The pending-status map
 * is keyed by nodeId so that the day a multi-incoming fan-out lands, no plumbing
 * change is needed here.
 */
export function useDaySimulator({
  runId, workflowId, graph, focusedNodeId, activeFrontiers, actionableNodeIds, history, profile
}: Args): DaySimulator {
  const qc = useQueryClient()

  const currentNodeDay = useMemo(
    () => (focusedNodeId ? dayAtNode(graph, history, focusedNodeId) : 0),
    [graph, history, focusedNodeId]
  )

  const currentNode = useMemo(
    () => focusedNodeId ? graph.nodes.find(n => n.id === focusedNodeId) ?? null : null,
    [graph, focusedNodeId]
  )

  const currentNodeIds = useMemo<readonly string[]>(() => {
    if (!focusedNodeId || !currentNode) return []
    if (currentNode.data.kind === 'end') return []
    if (currentNode.data.kind === 'start') return [focusedNodeId]
    if (activeFrontiers.includes(focusedNodeId)) return [focusedNodeId]
    if (actionableNodeIds.includes(focusedNodeId)) return [focusedNodeId]
    return []
  }, [focusedNodeId, currentNode, activeFrontiers, actionableNodeIds])

  // Pending per-node selections. Kept across focus changes so a status the
  // user already picked survives when they click another « À traiter » card
  // and come back, AND so step-back restores the prior pick. Stale entries
  // for nodes that have left the actionable set (advanced through, end of
  // run) are dropped — without that pruning, the picker would replay an
  // outcome after the user resumed a stepped-back branch.
  const [pendingByNode, setPendingByNode] = useState<Record<string, string | undefined>>({})
  useEffect(() => {
    setPendingByNode(prev => {
      let changed = false
      const next: Record<string, string | undefined> = {}
      for (const [id, status] of Object.entries(prev)) {
        if (actionableNodeIds.includes(id) || activeFrontiers.includes(id)) {
          next[id] = status
        } else {
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [actionableNodeIds, activeFrontiers])

  const nodesById = useMemo(() => new Map(graph.nodes.map(n => [n.id, n])), [graph.nodes])

  const profileKey = useMemo(
    () =>
      [
        profile.email ?? '',
        profile.phone ?? '',
        profile.whatsapp ?? '',
        profile.address?.street ?? '',
        profile.address?.postalCode ?? '',
        profile.address?.city ?? ''
      ].join('\0'),
    [profile.email, profile.phone, profile.whatsapp, profile.address]
  )

  // When contact data is newly available, suggest a success status; never overwrite an explicit user pick.
  const prevProfileKey = useRef<string | null>(null)
  const hadContactByNode = useRef<Record<string, boolean>>({})
  useEffect(() => {
    const profileChanged = prevProfileKey.current !== null && prevProfileKey.current !== profileKey
    prevProfileKey.current = profileKey
    if (currentNodeIds.length === 0) return

    setPendingByNode(prev => {
      let changed = false
      const next = { ...prev }
      for (const id of currentNodeIds) {
        const node = nodesById.get(id)
        if (!node || node.data.kind === 'start') continue
        const hasContact = hasContactForSendNode(node, profile)
        const hadContact = hadContactByNode.current[id] ?? false
        hadContactByNode.current[id] = hasContact

        const allowed = observableStatusesForSendNode(graph, id, node, profile)
        const cur = prev[id]
        if (cur && !allowed.includes(cur)) {
          next[id] = undefined
          changed = true
        }
        if (profileChanged && !hadContact && hasContact) {
          const success = preferredSuccessOutcome(graph, id, profile)
          if (success && !cur) {
            next[id] = success
            changed = true
          }
        }
      }
      return changed ? next : prev
    })
  }, [profileKey, currentNodeIds, graph, nodesById, profile])

  // `start` needs no status — it counts as "satisfied". For send_* the user
  // must have staged something in pendingByNode.
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
    const kind = currentNode.data.kind
    if (kind === 'end') return activeFrontiers.length === 0 ? 'end' : null
    if (kind === 'start') return null
    if (currentNode.data.params.output.mode === 'multi') return 'multi_output'
    return 'awaiting_status'
  }, [currentNode, activeFrontiers.length])

  const day = currentNodeDay
  const nextEventDay = useMemo(() => {
    if (!focusedNodeId || !currentNode) return null
    const outs = graph.edges.filter(e => e.source === focusedNodeId)
    if (outs.length === 0) return null
    let best: number | null = null
    for (const e of outs) {
      const t = currentNodeDay + e.daysAfter
      if (best === null || t < best) best = t
    }
    return best
  }, [graph.edges, focusedNodeId, currentNode, currentNodeDay])

  const advanceMut = useMutation({
    mutationFn: ({ nodeId, outcome }: { nodeId: string; outcome?: string }) =>
      advancePatientRun(runId, { nodeId, ...(outcome ? { outcome } : {}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.detail(runId) })
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.listForWorkflow(workflowId) })
    },
    onError: e => {
      toast.error(describeError(e, 'Échec de l\'avancement.'))
    }
  })

  const stepBackMut = useMutation({
    mutationFn: () => stepBackPatientRun(runId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.detail(runId) })
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.listForWorkflow(workflowId) })
      // Don't wipe pendingByNode — the actionable/frontier pruning useEffect
      // already drops picks that are no longer relevant, while keeping picks
      // on sibling branches the user staged but hasn't burned yet. Wiping
      // here was eating the user's pre-pick work each time they undid one
      // step.
    },
    onError: e => toast.error(describeError(e, 'Échec du retour en arrière.'))
  })

  const resetMut = useMutation({
    mutationFn: () => resetPatientRun(runId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.detail(runId) })
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.listForWorkflow(workflowId) })
      setPendingByNode({})
      toast.success('Parcours réinitialisé')
    },
    onError: e => toast.error(describeError(e, 'Échec de la réinitialisation.'))
  })

  const setPending = useCallback((nodeId: string, status: string | undefined) => {
    setPendingByNode(prev => ({ ...prev, [nodeId]: status }))
  }, [])

  // Snapshot of the latest pending picks — the `advanceAllPending` chain reads
  // from this ref so freshly-staged statuses are seen even between awaits.
  const pendingByNodeRef = useRef(pendingByNode)
  useEffect(() => { pendingByNodeRef.current = pendingByNode }, [pendingByNode])

  // Chain advances until we hit a node whose status the user hasn't staged
  // yet. Each iteration consults the **backend's** new `focusedNodeId` from
  // the mutation result (not the stale props closure) so we walk branches in
  // true chrono order, including jumping over to a sibling once the current
  // branch is consumed. `start` and `end` nodes need no status, every other
  // (send_*) node requires a pre-pick in `pendingByNode` to chain through.
  const advanceAllPending = useCallback(async (): Promise<boolean> => {
    if (!focusedNodeId) return false

    let focus: string | null = focusedNodeId
    const consumed = new Set<string>()

    while (focus) {
      const node = nodesById.get(focus)
      if (!node) break
      const kind = node.data.kind
      if (kind === 'end') break
      const requiresStatus = kind !== 'start'
      const pick = pendingByNodeRef.current[focus]
      if (requiresStatus && !pick) break

      const status = requiresStatus
        ? coerceOutcomeForAdvance(graph, focus, pick, profile)
        : undefined
      try {
        const updated = await advanceMut.mutateAsync({ nodeId: focus, outcome: status })
        consumed.add(focus)
        focus = updated.focusedNodeId
      } catch {
        break
      }
    }

    if (consumed.size > 0) {
      setPendingByNode(prev => {
        let changed = false
        const next = { ...prev }
        for (const id of consumed) {
          if (id in next) { delete next[id]; changed = true }
        }
        return changed ? next : prev
      })
    }
    return consumed.size > 0
    // mutateAsync is a stable reference from react-query
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedNodeId, nodesById, graph, profile])

  const canStepBack = history.length > 1
  const stepBackBusy = useRef(false)
  const stepBack = useCallback(async (): Promise<boolean> => {
    if (!canStepBack || stepBackBusy.current || stepBackMut.isPending) return false
    stepBackBusy.current = true
    try {
      await stepBackMut.mutateAsync()
      return true
    } finally {
      stepBackBusy.current = false
    }
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
