import type { Graph } from '../../schemas/primitives'
import { findLatestEntry, pickRoutedEdgeFromSource, type RunHistoryEntry } from './helpers'

/**
 * Cumulative day at which the patient enters / entered `nodeId` along the
 * simulated path. Computed as the max over every routed incoming edge of
 * (`dayAtNode(source)` + `edge.daysAfter`) — only edges the source actually
 * routed through count. For convergent join targets, this correctly takes
 * the max of all branches that fired into it.
 *
 * Use this rather than `nodeScheduledDay` whenever the question is "what day
 * is it in this run?" — `position.x` is layout-only and drifts from the real
 * path as soon as edge.daysAfter or non-default outcomes diverge from the
 * editor's preview.
 */
export function runDayAtNode(graph: Graph, history: RunHistoryEntry[], nodeId: string): number {
  const memo = new Map<string, number>()

  function compute(id: string): number {
    const cached = memo.get(id)
    if (cached !== undefined) return cached
    memo.set(id, 0)

    const incoming = graph.edges.filter(e => e.target === id)
    if (incoming.length === 0) {
      memo.set(id, 0)
      return 0
    }

    let day = 0
    for (const e of incoming) {
      const srcEntry = findLatestEntry(history, e.source)
      if (!srcEntry) continue
      const routed = pickRoutedEdgeFromSource(graph, history, srcEntry, id)
      if (!routed || routed.id !== e.id) continue
      const sourceDay = compute(e.source)
      const step = sourceDay + e.daysAfter
      if (step > day) day = step
    }
    memo.set(id, day)
    return day
  }

  return compute(nodeId)
}
