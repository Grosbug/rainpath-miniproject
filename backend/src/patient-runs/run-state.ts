import type { Graph } from '@rainpath/shared'
import {
  actionableNodeIds,
  computeActiveFrontiers,
  resolveFocusedNodeId,
  type RunHistoryEntry
} from '@rainpath/shared'

export type RunSimulationState = {
  activeFrontiers: string[]
  focusedNodeId: string | null
  actionableNodeIds: string[]
  /** Mirrors focusedNodeId for list endpoints / legacy clients. */
  currentNodeId: string | null
}

export function buildRunSimulationState(
  graph: Graph,
  history: RunHistoryEntry[],
  storedFocus: string | null
): RunSimulationState {
  const activeFrontiers = computeActiveFrontiers(graph, history)
  const focusedNodeId = resolveFocusedNodeId(graph, history, activeFrontiers, storedFocus)
  return {
    activeFrontiers,
    focusedNodeId,
    actionableNodeIds: actionableNodeIds(graph, history, activeFrontiers),
    currentNodeId: focusedNodeId
  }
}
