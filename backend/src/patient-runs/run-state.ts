import type { Graph } from '@rainpath/shared';
import {
  actionableNodeIds,
  computeActiveFrontiers,
  resolveFocusedNodeId,
  type RunHistoryEntry,
} from '@rainpath/shared';

export type RunSimulationState = {
  activeFrontiers: string[];
  focusedNodeId: string | null;
  actionableNodeIds: string[];
  /**
   * Tip of the simulated path (last entry in history). Distinct from the UI
   * focus: `focusedNodeId` can be null at end-of-run while `currentNodeId`
   * still points to the terminal end node, and `focusedNodeId` can override
   * to a sibling branch the user clicked into without changing the path tip.
   */
  currentNodeId: string | null;
};

export function buildRunSimulationState(
  graph: Graph,
  history: RunHistoryEntry[],
  storedFocus: string | null,
): RunSimulationState {
  const activeFrontiers = computeActiveFrontiers(graph, history);
  const focusedNodeId = resolveFocusedNodeId(
    graph,
    history,
    activeFrontiers,
    storedFocus,
  );
  const tip = history[history.length - 1]?.nodeId ?? null;
  return {
    activeFrontiers,
    focusedNodeId,
    actionableNodeIds: actionableNodeIds(graph, history, activeFrontiers),
    currentNodeId: tip,
  };
}
