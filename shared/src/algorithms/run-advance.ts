import type { Graph } from '../schemas/primitives'
import {
  chronoEarliestActionableNodeId,
  computeActiveFrontiers,
  nodeRunAction,
  pickRoutedEdgeFromSource,
  runDayAtNode,
  type RunHistoryEntry,
  visitedNodeIds
} from './compute-run-frontiers'

export type AdvanceRunErrorCode =
  | 'node_not_actionable'
  | 'frontier_not_open'
  | 'advance_failed'

export class AdvanceRunError extends Error {
  constructor(
    public readonly code: AdvanceRunErrorCode,
    public readonly detail?: Record<string, unknown>
  ) {
    super(code)
    this.name = 'AdvanceRunError'
  }
}

export interface ResolveAdvanceFn {
  (ctx: { graph: Graph; currentNodeId: string; outcome?: string }): {
    nextNodeId: string
    outcome?: string
  }
}

/**
 * Apply one advance step on `nodeId` (enter a frontier node or leave an visited one).
 * Returns the new history and suggested focus.
 */
export function applyRunAdvance(
  graph: Graph,
  history: RunHistoryEntry[],
  nodeId: string,
  outcome: string | undefined,
  resolveAdvance: ResolveAdvanceFn
): { history: RunHistoryEntry[]; focusNodeId: string | null } {
  const frontiers = computeActiveFrontiers(graph, history)
  const action = nodeRunAction(graph, history, frontiers, nodeId)
  if (!action) {
    throw new AdvanceRunError('node_not_actionable', { nodeId, frontiers })
  }

  const now = new Date().toISOString()

  // Step 1 — enter the node if it's a frontier. For Start (no observable
  // outcome) and for the common path where the user pre-picked a status on
  // the focused frontier card, we fall through into the leave step below so
  // a single Prochain click both enters AND exits the node. Without this,
  // each send_* costs two clicks (enter, then leave) — `chronoEarliest`
  // snaps focus back onto the just-entered node as a leave candidate, which
  // looks to the user like Prochain "does nothing".
  let workingHistory: RunHistoryEntry[] = history
  if (action === 'enter') {
    if (!frontiers.includes(nodeId)) {
      throw new AdvanceRunError('frontier_not_open', { nodeId, frontiers })
    }
    workingHistory = [...history, { nodeId, enteredAt: now }]
  }

  // Step 2 — leave the node when the caller is positioned to: either we
  // entered an already-actionable leave node, or we just entered a node that
  // can be left immediately. Re-running `nodeRunAction` against the appended
  // history is what gates "should we fuse?" — if the node still reports
  // 'enter' (impossible by construction here) or null (Start always reports
  // 'leave' after being visited; send_* reports 'leave' once entered), we
  // stop with just the enter step. The leave step requires an outcome for
  // send_* nodes; if the user didn't pre-pick, we stop after enter and let
  // them stage the status on the next render.
  const node = graph.nodes.find(n => n.id === nodeId)
  const isSend = !!node && (
    node.data.kind === 'send_email' || node.data.kind === 'send_sms' ||
    node.data.kind === 'send_whatsapp' || node.data.kind === 'send_postal'
  )
  const canLeaveNow = action === 'leave' || (
    action === 'enter' &&
    !!node &&
    (node.data.kind === 'start' || (isSend && outcome !== undefined))
  )
  if (!canLeaveNow) {
    return { history: workingHistory, focusNodeId: pickNextFocus(graph, workingHistory) }
  }

  let result: { nextNodeId: string; outcome?: string }
  try {
    result = resolveAdvance({ graph, currentNodeId: nodeId, outcome })
  } catch (e) {
    throw new AdvanceRunError('advance_failed', { nodeId, cause: String(e) })
  }

  // Attach the observed outcome to the **source's** history entry (the node
  // whose status was just observed). Pre-refactor runs attached the outcome
  // to the target instead; `runDayAtNode` / `hasExitedNode` keep a back-compat
  // fallback so old runs still compute correctly, but every new advance now
  // records on the source so multi-incoming joins can tell which branches
  // have fired without inspecting interleaved target entries.
  const withSourceOutcome = result.outcome !== undefined
    ? markLatestEntryOutcome(workingHistory, nodeId, result.outcome)
    : workingHistory

  // Fuse leave+enter only for **single-source** targets — the common, linear
  // case. Convergent join targets (≥ 2 distinct incoming sources) are left
  // pending so the next `computeActiveFrontiers` pass exposes them as a
  // frontier the user explicitly enters once every branch has fed in. Without
  // this, an early leave on one branch would race the join target into
  // history before its other branches even had a chance to record outcomes.
  const targetIncoming = graph.edges.filter(e => e.target === result.nextNodeId)
  const distinctSources = new Set(targetIncoming.map(e => e.source))
  const targetAlreadyVisited = withSourceOutcome.some(h => h.nodeId === result.nextNodeId)

  let nextHistory: RunHistoryEntry[] = withSourceOutcome
  if (distinctSources.size === 1 && !targetAlreadyVisited) {
    nextHistory = [...withSourceOutcome, { nodeId: result.nextNodeId, enteredAt: now }]
  }

  return { history: nextHistory, focusNodeId: pickNextFocus(graph, nextHistory) }
}

function markLatestEntryOutcome(
  history: RunHistoryEntry[],
  nodeId: string,
  outcome: string
): RunHistoryEntry[] {
  let lastIdx = -1
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.nodeId === nodeId) { lastIdx = i; break }
  }
  if (lastIdx < 0) return history
  return history.map((h, i) => i === lastIdx ? { ...h, outcome } : h)
}

/**
 * Pick the focus the run lands on after a step. Always the chronologically
 * earliest actionable node so the "Prochain" auto-pilot keeps walking branches
 * in temporal order without requiring the user to manually re-focus another
 * card. Falls back to the most recent history entry (typically the just-entered
 * node) when nothing is actionable yet, then null at the end of the run.
 */
function pickNextFocus(graph: Graph, nextHistory: RunHistoryEntry[]): string | null {
  const nextFrontiers = computeActiveFrontiers(graph, nextHistory)
  const chrono = chronoEarliestActionableNodeId(graph, nextHistory, nextFrontiers)
  if (chrono) return chrono
  const last = nextHistory[nextHistory.length - 1]
  if (!last) return null
  const node = graph.nodes.find(n => n.id === last.nodeId)
  if (node && node.data.kind !== 'end') return last.nodeId
  return null
}

/**
 * Pop the **temporally latest** history entry — not the latest in array
 * order. The array follows click order; in chain mode + asymmetric parallel
 * branches the two diverge (B's branch may resolve at J+6 while A's resolves
 * at J+10, but B was clicked after A so B's entry sits later in the array).
 * The user expects step-back to undo the most recent event in the patient's
 * simulated timeline, which is the entry with the largest `runDayAtNode`.
 *
 * When the popped entry was the routed target of a source visible in the
 * remaining history (i.e. fused leave+enter), we also clear that source's
 * outcome — otherwise the source would still be flagged as exited and the
 * target would re-open as a frontier immediately, defeating the rewind.
 *
 * Multi-source join targets entered via an explicit `enter` action don't
 * have a matching source-outcome to clear: their incoming sources already
 * had their outcomes recorded by their respective leave steps, which sit
 * upstream of the join target and remain valid after rewinding it.
 */
export function rewindLastStep(
  graph: Graph,
  history: RunHistoryEntry[]
): RunHistoryEntry[] {
  if (history.length <= 1) return history

  // Find the entry with the highest cumulative day. Start (idx 0) is the
  // anchor — never popped. Tie-break favors the entry that appears later in
  // the array so click-order still breaks day ties deterministically.
  let bestIdx = -1
  let bestDay = -Infinity
  for (let i = 1; i < history.length; i++) {
    const day = runDayAtNode(graph, history, history[i]!.nodeId)
    if (day > bestDay || (day === bestDay && i > bestIdx)) {
      bestDay = day
      bestIdx = i
    }
  }
  if (bestIdx < 0) return history

  const popped = history[bestIdx]!
  let trimmed: RunHistoryEntry[] = [
    ...history.slice(0, bestIdx),
    ...history.slice(bestIdx + 1)
  ]

  const incoming = graph.edges.filter(e => e.target === popped.nodeId)
  for (const incomingEdge of incoming) {
    let srcIdx = -1
    for (let i = trimmed.length - 1; i >= 0; i--) {
      if (trimmed[i]!.nodeId === incomingEdge.source) { srcIdx = i; break }
    }
    if (srcIdx < 0) continue
    const srcEntry = trimmed[srcIdx]!
    if (srcEntry.outcome === undefined) continue
    const routed = pickRoutedEdgeFromSource(graph, trimmed, srcEntry, popped.nodeId)
    if (!routed || routed.id !== incomingEdge.id) continue
    const { outcome: _outcome, ...rest } = srcEntry
    trimmed = [
      ...trimmed.slice(0, srcIdx),
      rest as RunHistoryEntry,
      ...trimmed.slice(srcIdx + 1)
    ]
  }
  return trimmed
}

/** Nodes the user may click to act on (enter or leave). */
export function actionableNodeIds(
  graph: Graph,
  history: RunHistoryEntry[],
  frontiers: string[]
): string[] {
  const visited = visitedNodeIds(history)
  const ids = new Set<string>(frontiers)
  for (const id of visited) {
    if (nodeRunAction(graph, history, frontiers, id) === 'leave') ids.add(id)
  }
  return [...ids].sort()
}
