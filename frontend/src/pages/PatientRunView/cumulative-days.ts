import type { Graph } from '@rainpath/shared'
import { CHANNEL_FAILURE_STATUSES } from '@rainpath/shared'
import { findOutgoingEdge, resolveOutcomeHandle } from './outcome-routing'

type HistoryEntry = { nodeId: string; outcome?: string }

type NodeData = Graph['nodes'][number]['data']
type PostalAddress = { street: string; postalCode: string; city: string; country?: string | null }

export interface PatientContactData {
  email: string | null
  phone: string | null
  whatsapp: string | null
  address: PostalAddress | null
}

/**
 * Whether the patient profile carries the contact field a send node would
 * physically need to attempt delivery. Non-send nodes return true (they don't
 * consume any contact data).
 *
 * Postal counts as "available" only when the structured address has the three
 * mandatory parts (street + postal code + city) — a half-filled address can't
 * be posted.
 */
export function hasChannelData(data: NodeData, profile: PatientContactData): boolean {
  switch (data.kind) {
    case 'send_email':    return !!profile.email && profile.email.trim() !== ''
    case 'send_sms':      return !!profile.phone && profile.phone.trim() !== ''
    case 'send_whatsapp': return !!profile.whatsapp && profile.whatsapp.trim() !== ''
    case 'send_postal':   return !!profile.address?.street && !!profile.address?.postalCode && !!profile.address?.city
    default: return true
  }
}

/**
 * Statuses that can realistically be observed when the patient lacks the
 * channel's contact data. The provider would either bounce / fail server-side
 * or never even attempt the send — both fold into the channel's failure set.
 * Used to filter the outcome dropdown so "delivered / opened / read" never
 * shows up for a patient with no contact info.
 */
export function failureStatusesForNode(data: NodeData): readonly string[] {
  switch (data.kind) {
    case 'send_email':    return CHANNEL_FAILURE_STATUSES.email
    case 'send_sms':      return CHANNEL_FAILURE_STATUSES.sms
    case 'send_whatsapp': return CHANNEL_FAILURE_STATUSES.whatsapp
    case 'send_postal':
      return data.params.tracked
        ? CHANNEL_FAILURE_STATUSES.postal_tracked
        : CHANNEL_FAILURE_STATUSES.postal_untracked
    default: return []
  }
}

/** Human label for the missing piece of contact data (used in the warning banner). */
export function missingChannelLabel(data: NodeData): string | null {
  switch (data.kind) {
    case 'send_email':    return 'email'
    case 'send_sms':      return 'numéro de téléphone'
    case 'send_whatsapp': return 'numéro WhatsApp'
    case 'send_postal':   return 'adresse postale complète'
    default: return null
  }
}

/**
 * Walk the patient's history and sum daysAfter on each consumed edge to
 * derive the cumulative day at which the current node was entered.
 *
 * The history is the authoritative path — we don't recompute via topo sort
 * because branches with the same target day would otherwise be ambiguous.
 */
export function dayOfHistory(graph: Graph, history: HistoryEntry[]): number {
  if (history.length === 0) return 0
  let day = 0
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1]!
    const curr = history[i]!
    const edge = pickEdge(graph, prev.nodeId, curr.nodeId, prev.outcome)
    day += edge?.daysAfter ?? 0
  }
  return day
}

/** Layout J+N for a node (matches the badge on the canvas card). */
export function scheduledDayOfNode(graph: Graph, nodeId: string): number {
  const n = graph.nodes.find(x => x.id === nodeId)
  if (!n || n.data.kind === 'start') return 0
  return Math.max(0, Math.round(n.position.x))
}

function lastHistoryEntry(history: HistoryEntry[], nodeId: string): HistoryEntry | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.nodeId === nodeId) return history[i]
  }
  return undefined
}

/**
 * Cumulative day when the patient reaches `nodeId` along the simulated path (history +
 * edge delays). Does not use the editor layout X — that would push the J+N cursor past
 * the real next step. Card badges still use `scheduledDayOfNode` separately.
 */
export function dayAtNode(graph: Graph, history: HistoryEntry[], nodeId: string): number {
  let lastIdx = -1
  for (let i = 0; i < history.length; i++) {
    if (history[i]!.nodeId === nodeId) lastIdx = i
  }
  if (lastIdx >= 0) {
    return dayOfHistory(graph, history.slice(0, lastIdx + 1))
  }

  const visited = new Set(history.map(h => h.nodeId))
  const incoming = graph.edges.filter(e => e.target === nodeId && visited.has(e.source))
  if (incoming.length === 0) return 0

  let day = 0
  for (const e of incoming) {
    const source = graph.nodes.find(n => n.id === e.source)
    const srcHist = lastHistoryEntry(history, e.source)
    const sourceDay = dayAtNode(graph, history, e.source)
    let step = sourceDay + e.daysAfter
    if (source && srcHist?.outcome !== undefined) {
      const via = findOutgoingEdge(graph, e.source, resolveOutcomeHandle(source, srcHist.outcome))
      if (via?.target === nodeId) {
        step = sourceDay + via.daysAfter
      }
    }
    day = Math.max(day, step)
  }
  return day
}

/**
 * Default outcome that auto-advance feeds to POST /advance for a "happy path"
 * tick. Returns undefined when no auto-advance is possible (multi-output, end).
 *
 * When the patient lacks the channel's contact data, the simulator can't
 * realistically pick a success status (e.g. "delivered" makes no sense without
 * an email) — it falls back on the first available failure status so the run
 * naturally routes through the failure handle. Returns undefined when even
 * the failure set is empty (postal_untracked has no failure status, for
 * instance) so the caller can pause.
 */
export function defaultOutcomeFor(
  graph: Graph,
  currentNodeId: string,
  profile: PatientContactData
): string | undefined {
  const node = graph.nodes.find(n => n.id === currentNodeId)
  if (!node) return undefined
  if (node.data.kind === 'start') return undefined
  if (node.data.kind === 'end') return undefined
  const out = node.data.params.output
  if (out.mode !== 'simple') return undefined

  if (hasChannelData(node.data, profile)) return out.successCondition.statuses[0]
  const failures = failureStatusesForNode(node.data)
  return failures[0]
}

function isSendKind(kind: string): boolean {
  return kind.startsWith('send_')
}

/**
 * Edge ids the patient has already followed. We walk each visited source and
 * mark every outgoing edge the source actually routed through:
 *   - **send_*** with a recorded outcome → mark the edge whose `sourceHandle`
 *     matches the outcome's resolved handle (success / failure / multi-output
 *     id). The edge colours the moment the source records its outcome —
 *     including the case where the target is a multi-input join still
 *     waiting on its other branches, so the canvas reflects the routing as
 *     soon as the user makes the decision instead of waiting for the join
 *     to finally open.
 *   - **Start / non-send_*** sources have no observable outcome, so we fall
 *     back to "edge is traversed once the target is in history" — Start's
 *     parallel children each colour their incoming edge when the user
 *     actually enters them, not when Start is visited.
 */
export function traversedEdgeIds(graph: Graph, history: HistoryEntry[]): Set<string> {
  const ids = new Set<string>()
  const visited = new Set(history.map(h => h.nodeId))
  for (let i = 0; i < history.length; i++) {
    const srcEntry = history[i]!
    const source = graph.nodes.find(n => n.id === srcEntry.nodeId)
    if (!source) continue
    const sendKind = isSendKind(source.data.kind)
    const outgoing = graph.edges.filter(e => e.source === source.id)
    for (const e of outgoing) {
      if (sendKind) {
        // Back-compat: pre-refactor runs put the outcome on the target entry.
        const targetEntry = history.slice(i + 1).find(h => h.nodeId === e.target)
        const outcome = srcEntry.outcome ?? targetEntry?.outcome
        if (outcome === undefined) continue
        const resolved = resolveOutcomeHandle(source, outcome)
        const expectedHandle = resolved.type === 'handle' ? resolved.handle : null
        const edgeHandle = e.sourceHandle ?? null
        if (edgeHandle === expectedHandle) ids.add(e.id)
      } else {
        // Start (or any single-handle source): colour the edge once the
        // target is actually entered. Multiple outgoings from Start are all
        // valid "single" handles, but they only count as traversed when the
        // patient picks each one up.
        if (visited.has(e.target)) ids.add(e.id)
      }
    }
  }
  return ids
}

function pickEdge(
  graph: Graph,
  sourceId: string,
  targetId: string,
  outcome?: string
): Graph['edges'][number] | undefined {
  const candidates = graph.edges.filter(e => e.source === sourceId && e.target === targetId)
  if (candidates.length === 0) return undefined
  if (candidates.length === 1) return candidates[0]

  const source = graph.nodes.find(n => n.id === sourceId)
  if (source && outcome !== undefined) {
    const resolved = resolveOutcomeHandle(source, outcome)
    const viaHandle = findOutgoingEdge(graph, sourceId, resolved)
    if (viaHandle?.target === targetId) return viaHandle
  }

  return candidates.find(e => e.sourceHandle === 'success') ?? candidates[0]
}
