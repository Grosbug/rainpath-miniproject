/**
 * Re-export hub for the run-frontiers algorithms — split across `./run-frontiers/`
 * so each sub-concern (helpers, day-of-node math, frontier activation, actionable
 * selection) sits in a file small enough to follow. The barrel exists so existing
 * `from '@rainpath/shared'` imports keep working without a name change.
 */
export {
  nodeScheduledDay,
  visitedNodeIds,
  pickRoutedEdgeFromSource,
  type RunHistoryEntry
} from './run-frontiers/helpers'

export { runDayAtNode } from './run-frontiers/run-day'

export { computeActiveFrontiers } from './run-frontiers/active-frontiers'

export {
  hasExitedNode,
  nodeRunAction,
  chronoEarliestActionableNodeId,
  resolveFocusedNodeId,
  type NodeRunAction
} from './run-frontiers/actionable'
