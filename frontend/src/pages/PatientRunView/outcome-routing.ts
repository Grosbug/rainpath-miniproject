import {
  CHANNEL_FAILURE_STATUSES,
  CHANNEL_STATUSES,
  type ChannelKey,
  type Graph,
  type GraphEdge,
  type GraphNode
} from '@rainpath/shared'

export type ResolvedOutcomeHandle =
  | { type: 'single' }
  | { type: 'handle'; handle: string }

export function channelKeyForSendNode(node: GraphNode): ChannelKey | null {
  const data = node.data
  if (data.kind === 'send_email') return 'email'
  if (data.kind === 'send_sms') return 'sms'
  if (data.kind === 'send_whatsapp') return 'whatsapp'
  if (data.kind === 'send_postal') return data.params.tracked ? 'postal_tracked' : 'postal_untracked'
  return null
}

function failureStatusesFor(ck: ChannelKey): readonly string[] {
  return CHANNEL_FAILURE_STATUSES[ck]
}

/** Map an observed status to the workflow handle (simple success/failure or multi output id). */
export function resolveOutcomeHandle(node: GraphNode, outcome: string | undefined): ResolvedOutcomeHandle {
  const data = node.data
  if (data.kind === 'start') return { type: 'single' }

  if (
    data.kind === 'send_email' ||
    data.kind === 'send_sms' ||
    data.kind === 'send_whatsapp' ||
    data.kind === 'send_postal'
  ) {
    const out = data.params.output
    const ck = channelKeyForSendNode(node)

    if (out.mode === 'simple') {
      if (outcome && ck && (failureStatusesFor(ck) as readonly string[]).includes(outcome)) {
        return { type: 'handle', handle: 'failure' }
      }
      if (outcome && out.successCondition.statuses.includes(outcome)) {
        return { type: 'handle', handle: 'success' }
      }
      return { type: 'handle', handle: 'failure' }
    }

    if (!outcome) {
      return { type: 'handle', handle: out.outputs[0]!.id }
    }
    const match = out.outputs.find(o => o.condition.statuses.includes(outcome))
    return { type: 'handle', handle: match?.id ?? out.outputs[0]!.id }
  }

  return { type: 'single' }
}

function outgoingFrom(graph: Graph, nodeId: string): GraphEdge[] {
  return graph.edges.filter(e => e.source === nodeId)
}

/** Pick the outgoing edge for a resolved handle (exact sourceHandle only). */
export function findOutgoingEdge(
  graph: Graph,
  nodeId: string,
  resolved: ResolvedOutcomeHandle
): GraphEdge | undefined {
  const outs = outgoingFrom(graph, nodeId)
  if (outs.length === 0) return undefined

  if (resolved.type === 'single') {
    return outs.find(e => !e.sourceHandle) ?? (outs.length === 1 ? outs[0] : undefined)
  }

  return outs.find(e => e.sourceHandle === resolved.handle)
}

function simpleModeHandleAvailability(
  graph: Graph,
  nodeId: string
): { success: boolean; failure: boolean } {
  const outs = outgoingFrom(graph, nodeId)
  return {
    success: outs.some(e => e.sourceHandle === 'success'),
    failure: outs.some(e => e.sourceHandle === 'failure')
  }
}

/** Whether this status can be advanced (an outgoing edge exists for its handle). */
export function hasRoutableEdgeForStatus(graph: Graph, nodeId: string, outcome: string): boolean {
  const node = graph.nodes.find(n => n.id === nodeId)
  if (!node) return false

  const data = node.data
  if (
    data.kind === 'send_email' ||
    data.kind === 'send_sms' ||
    data.kind === 'send_whatsapp' ||
    data.kind === 'send_postal'
  ) {
    if (data.params.output.mode === 'simple') {
      const ck = channelKeyForSendNode(node)
      if (!ck) return false
      const avail = simpleModeHandleAvailability(graph, nodeId)
      const failures = failureStatusesFor(ck) as readonly string[]
      if (failures.includes(outcome)) return avail.failure
      if (!data.params.output.successCondition.statuses.includes(outcome)) return false
      return avail.success
    }
  }

  const resolved = resolveOutcomeHandle(node, outcome)
  return !!findOutgoingEdge(graph, nodeId, resolved)
}

export type PatientContactProfile = {
  email: string | null
  phone: string | null
  whatsapp: string | null
  address: unknown
}

/** Statuses the patient-run UI may offer, wired to an outgoing edge in the graph. */
export function observableStatusesForSendNode(
  graph: Graph,
  nodeId: string,
  node: GraphNode,
  profile?: PatientContactProfile
): string[] {
  const data = node.data
  if (
    data.kind !== 'send_email' &&
    data.kind !== 'send_sms' &&
    data.kind !== 'send_whatsapp' &&
    data.kind !== 'send_postal'
  ) {
    return []
  }

  const ck = channelKeyForSendNode(node)
  if (!ck) return []

  let candidates: string[] = [...CHANNEL_STATUSES[ck]]
  const out = data.params.output
  if (out.mode === 'multi') {
    const routed = new Set(out.outputs.flatMap(o => o.condition.statuses))
    candidates = candidates.filter(s => routed.has(s))
  }

  if (profile) {
    const hasContact = hasContactForSendNode(node, profile)
    if (!hasContact) {
      const failures = new Set<string>(failureStatusesFor(ck) as readonly string[])
      candidates = candidates.filter(s => failures.has(s))
    }
  }

  return candidates.filter(s => hasRoutableEdgeForStatus(graph, nodeId, s))
}

export function isChannelFailureStatus(node: GraphNode, outcome: string): boolean {
  const ck = channelKeyForSendNode(node)
  if (!ck) return false
  return (failureStatusesFor(ck) as readonly string[]).includes(outcome)
}

export function hasContactForSendNode(node: GraphNode, profile: PatientContactProfile): boolean {
  const data = node.data
  switch (data.kind) {
    case 'send_email':
      return !!profile.email && String(profile.email).trim() !== ''
    case 'send_sms':
      return !!profile.phone && String(profile.phone).trim() !== ''
    case 'send_whatsapp':
      return !!profile.whatsapp && String(profile.whatsapp).trim() !== ''
    case 'send_postal': {
      const a = profile.address as { street?: string; postalCode?: string; city?: string } | null
      return !!a?.street && !!a?.postalCode && !!a?.city
    }
    default:
      return true
  }
}

export function coerceOutcomeForAdvance(
  graph: Graph,
  nodeId: string,
  outcome: string | undefined,
  profile: PatientContactProfile
): string | undefined {
  const node = graph.nodes.find(n => n.id === nodeId)
  if (!node) return outcome
  if (
    node.data.kind !== 'send_email' &&
    node.data.kind !== 'send_sms' &&
    node.data.kind !== 'send_whatsapp' &&
    node.data.kind !== 'send_postal'
  ) {
    return outcome
  }

  const allowed = observableStatusesForSendNode(graph, nodeId, node, profile)
  if (allowed.length === 0) return outcome
  if (outcome && allowed.includes(outcome)) return outcome

  const hasContact = hasContactForSendNode(node, profile)
  const successes = allowed.filter(s => !isChannelFailureStatus(node, s))
  const failures = allowed.filter(s => isChannelFailureStatus(node, s))
  if (hasContact && successes.length > 0) return successes[0]
  if (failures.length > 0) return failures[0]
  return allowed[0]
}

export function preferredSuccessOutcome(
  graph: Graph,
  nodeId: string,
  profile: PatientContactProfile
): string | undefined {
  const node = graph.nodes.find(n => n.id === nodeId)
  if (!node || !hasContactForSendNode(node, profile)) return undefined
  const allowed = observableStatusesForSendNode(graph, nodeId, node, profile)
  return allowed.find(s => !isChannelFailureStatus(node, s))
}

export type AdvanceRouteHandle = 'success' | 'failure' | 'single' | 'multi'

/** Resolved handle + target for UI preview (patient run status picker). */
export function describeAdvanceRoute(
  graph: Graph,
  nodeId: string,
  outcome: string
): { handle: AdvanceRouteHandle; targetNodeId: string | null } {
  const node = graph.nodes.find(n => n.id === nodeId)
  if (!node) return { handle: 'single', targetNodeId: null }
  const resolved = resolveOutcomeHandle(node, outcome)
  const edge = findOutgoingEdge(graph, nodeId, resolved)
  if (resolved.type === 'single') return { handle: 'single', targetNodeId: edge?.target ?? null }
  if (resolved.handle === 'success' || resolved.handle === 'failure') {
    return { handle: resolved.handle, targetNodeId: edge?.target ?? null }
  }
  return { handle: 'multi', targetNodeId: edge?.target ?? null }
}
