import type { Graph } from '../schemas/primitives'
import {
  computeActiveFrontiers,
  nodeRunAction,
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

  if (action === 'enter') {
    if (!frontiers.includes(nodeId)) {
      throw new AdvanceRunError('frontier_not_open', { nodeId, frontiers })
    }
    const nextHistory: RunHistoryEntry[] = [...history, { nodeId, enteredAt: now }]
    const nextFrontiers = computeActiveFrontiers(graph, nextHistory)
    const node = graph.nodes.find(n => n.id === nodeId)
    const focus =
      node && node.data.kind !== 'end'
        ? nodeId
        : nextFrontiers[0] ?? null
    return { history: nextHistory, focusNodeId: focus }
  }

  let result: { nextNodeId: string; outcome?: string }
  try {
    result = resolveAdvance({ graph, currentNodeId: nodeId, outcome })
  } catch (e) {
    throw new AdvanceRunError('advance_failed', { nodeId, cause: String(e) })
  }

  const entry: RunHistoryEntry = { nodeId: result.nextNodeId, enteredAt: now }
  if (result.outcome !== undefined) entry.outcome = result.outcome
  const nextHistory = [...history, entry]
  const nextFrontiers = computeActiveFrontiers(graph, nextHistory)
  const landed = graph.nodes.find(n => n.id === result.nextNodeId)
  const focus =
    landed && landed.data.kind !== 'end'
      ? result.nextNodeId
      : nextFrontiers[0] ?? null

  return { history: nextHistory, focusNodeId: focus }
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
