import { CHANNEL_FAILURE_STATUSES, type ChannelKey } from '../../schemas/channels'
import type { Graph, GraphEdge, GraphNode } from '../../schemas/primitives'

export type RunHistoryEntry = { nodeId: string; enteredAt: string; outcome?: string }

/**
 * Layout-day used by the editor canvas — derived from `position.x`. Kept for
 * UI badge alignment ("J+N" pill on the patient cards) but no longer used to
 * gate which frontier is "open now". The runtime gating uses `runDayAtNode`,
 * which follows the patient's actual history.
 */
export function nodeScheduledDay(graph: Graph, nodeId: string): number {
  const n = graph.nodes.find(x => x.id === nodeId)
  if (!n || n.data.kind === 'start') return 0
  return Math.max(0, Math.round(n.position.x))
}

export function visitedNodeIds(history: RunHistoryEntry[]): Set<string> {
  return new Set(history.map(h => h.nodeId))
}

export function isSendKind(kind: string): boolean {
  return kind === 'send_email' || kind === 'send_sms' || kind === 'send_whatsapp' || kind === 'send_postal'
}

export function channelKeyOf(node: GraphNode): ChannelKey | null {
  const d = node.data
  if (d.kind === 'send_email') return 'email'
  if (d.kind === 'send_sms') return 'sms'
  if (d.kind === 'send_whatsapp') return 'whatsapp'
  if (d.kind === 'send_postal') return d.params.tracked ? 'postal_tracked' : 'postal_untracked'
  return null
}

export function findLatestEntry(history: RunHistoryEntry[], nodeId: string): RunHistoryEntry | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.nodeId === nodeId) return history[i]
  }
  return undefined
}

/**
 * Effective outcome a source observed, supporting both history conventions:
 *   - **New** (preferred): outcome attached to the source's own entry.
 *   - **Old** (kept for back-compat with pre-refactor runs): outcome attached
 *     to the entry of the target that came immediately after the source.
 */
export function effectiveSourceOutcome(
  graph: Graph,
  history: RunHistoryEntry[],
  source: GraphNode,
  srcEntry: RunHistoryEntry
): string | undefined {
  if (srcEntry.outcome !== undefined) return srcEntry.outcome
  if (!isSendKind(source.data.kind)) return undefined
  const idx = history.indexOf(srcEntry)
  if (idx < 0) return undefined
  const outgoingTargets = new Set(
    graph.edges.filter(e => e.source === source.id).map(e => e.target)
  )
  for (let i = idx + 1; i < history.length; i++) {
    const e = history[i]!
    if (outgoingTargets.has(e.nodeId) && e.outcome !== undefined) return e.outcome
  }
  return undefined
}

/**
 * Identify the specific outgoing edge from `source` that routes to `targetId`
 * given the source's observed outcome. Returns null when no edge matches —
 * e.g. when a send_* hasn't recorded its outcome yet so the routing is not
 * yet decided. Used by `runDayAtNode` to attribute each edge to the source
 * that actually fired through it.
 */
export function pickRoutedEdgeFromSource(
  graph: Graph,
  history: RunHistoryEntry[],
  srcEntry: RunHistoryEntry,
  targetId: string
): GraphEdge | null {
  const source = graph.nodes.find(n => n.id === srcEntry.nodeId)
  if (!source) return null
  const candidates = graph.edges.filter(e => e.source === source.id && e.target === targetId)
  if (candidates.length === 0) return null

  const d = source.data
  if (d.kind === 'start' || d.kind === 'end') {
    return candidates[0] ?? null
  }

  if (isSendKind(d.kind)) {
    const out = d.params.output
    const outcome = effectiveSourceOutcome(graph, history, source, srcEntry)
    if (outcome === undefined) return null

    if (out.mode === 'simple') {
      const ck = channelKeyOf(source)
      const isFailure = !!ck && (CHANNEL_FAILURE_STATUSES[ck] as readonly string[]).includes(outcome)
      const want = isFailure ? 'failure' : 'success'
      return candidates.find(e => e.sourceHandle === want) ?? null
    }
    if (out.mode === 'multi') {
      const match = out.outputs.find(o => o.condition.statuses.includes(outcome))
      if (!match) return null
      return candidates.find(e => e.sourceHandle === match.id) ?? null
    }
  }
  return null
}
