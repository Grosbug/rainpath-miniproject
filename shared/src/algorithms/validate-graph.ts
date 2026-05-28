import type { Graph, GraphEdge, GraphNode } from '../schemas/primitives'
import type { NodeData } from '../schemas/node-data'
import { CHANNEL_STATUSES, type ChannelKey } from '../schemas/channels'
import { DataAvailableExpressions } from '../schemas/expressions'
import { START_Y } from '../constants'

export interface ValidationError {
  code: string
  message: string
  nodeId?: string
  edgeId?: string
}

export interface ValidationWarning {
  code: string
  message: string
  nodeId?: string
  edgeId?: string
  missingStatuses?: string[]
}

export interface ValidationResult {
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

function channelKey(node: GraphNode): ChannelKey | null {
  switch (node.data.kind) {
    case 'send_email':    return 'email'
    case 'send_sms':      return 'sms'
    case 'send_whatsapp': return 'whatsapp'
    case 'send_postal':   return node.data.params.tracked ? 'postal_tracked' : 'postal_untracked'
    default: return null
  }
}

export function validateGraph(graph: Graph): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  const nodesById = new Map(graph.nodes.map(n => [n.id, n]))
  const starts = graph.nodes.filter(n => n.data.kind === 'start')
  const ends = graph.nodes.filter(n => n.data.kind === 'end')

  // Structural — start / end counts
  if (starts.length === 0) errors.push({ code: 'no_start', message: 'Le workflow doit avoir un nœud de départ' })
  if (starts.length > 1) errors.push({ code: 'multiple_starts', message: 'Un seul nœud de départ autorisé' })
  if (ends.length === 0) errors.push({ code: 'no_end', message: 'Le workflow doit avoir au moins un nœud de fin' })

  // Start position
  for (const s of starts) {
    if (s.position.x !== 0) {
      errors.push({ code: 'start_position_x_must_be_zero', message: 'Le nœud start doit être à X=0', nodeId: s.id })
    }
    if (s.position.y !== START_Y) {
      errors.push({ code: 'start_position_y_must_be_default', message: `Le nœud start doit être à Y=${START_Y}`, nodeId: s.id })
    }
  }

  // Edges — dangling / self-loop / into-start / from-end / duplicate handles
  const handleUsage = new Map<string, Set<string | undefined>>() // nodeId -> set of handles seen
  for (const e of graph.edges) {
    if (!nodesById.has(e.source) || !nodesById.has(e.target)) {
      errors.push({ code: 'edge_dangling', message: 'Une arête référence un nœud inexistant', edgeId: e.id })
      continue
    }
    if (e.source === e.target) {
      errors.push({ code: 'self_loop', message: 'Une arête ne peut pas relier un nœud à lui-même', edgeId: e.id })
    }
    if (nodesById.get(e.target)!.data.kind === 'start') {
      errors.push({ code: 'edge_into_start', message: 'Aucune arête ne peut entrer dans le nœud de départ', edgeId: e.id })
    }
    if (nodesById.get(e.source)!.data.kind === 'end') {
      errors.push({ code: 'edge_from_end', message: 'Aucune arête ne peut sortir d\'un nœud de fin', edgeId: e.id })
    }
    const handles = handleUsage.get(e.source) ?? new Set()
    if (handles.has(e.sourceHandle)) {
      errors.push({
        code: 'duplicate_source_handle',
        message: 'Deux arêtes utilisent le même handle de sortie',
        edgeId: e.id, nodeId: e.source
      })
    }
    handles.add(e.sourceHandle)
    handleUsage.set(e.source, handles)
  }

  // Send node output rules
  for (const n of graph.nodes) {
    if (!n.data.kind.startsWith('send_')) continue
    const ck = channelKey(n)
    if (!ck) continue
    const channelStatuses = new Set<string>(CHANNEL_STATUSES[ck])

    const data = n.data as Extract<NodeData, { kind: 'send_email' | 'send_sms' | 'send_whatsapp' | 'send_postal' }>
    const output = data.params.output

    if (n.data.kind === 'send_postal' && !n.data.params.tracked && output.mode !== 'single') {
      errors.push({
        code: 'postal_untracked_must_be_single',
        message: 'Postal non suivi : seul le mode single est autorisé',
        nodeId: n.id
      })
    }

    if (output.mode === 'simple') {
      for (const s of output.successCondition.statuses) {
        if (!channelStatuses.has(s)) {
          errors.push({ code: 'status_not_in_channel', message: `Statut "${s}" inconnu pour ${ck}`, nodeId: n.id })
        }
      }
    }

    if (output.mode === 'multi') {
      const ids = new Set<string>()
      const seenStatuses = new Set<string>()
      for (const o of output.outputs) {
        if (ids.has(o.id)) {
          errors.push({ code: 'duplicate_output_id', message: `Identifiant de sortie en double : ${o.id}`, nodeId: n.id })
        }
        ids.add(o.id)
        for (const s of o.condition.statuses) {
          if (!channelStatuses.has(s)) {
            errors.push({ code: 'status_not_in_channel', message: `Statut "${s}" inconnu pour ${ck}`, nodeId: n.id })
          }
          if (seenStatuses.has(s)) {
            errors.push({ code: 'status_overlap_in_multi', message: `Statut "${s}" présent dans plusieurs sorties`, nodeId: n.id })
          }
          seenStatuses.add(s)
        }
      }
      // Coverage warning
      const missing = [...channelStatuses].filter(s => !seenStatuses.has(s))
      if (missing.length > 0) {
        warnings.push({
          code: 'incomplete_status_coverage',
          message: `Statuts non routés : ${missing.join(', ')}`,
          nodeId: n.id, missingStatuses: missing
        })
      }
    }

    // Validate sourceHandle of outgoing edges matches the output config.
    const outgoing = graph.edges.filter(e => e.source === n.id)
    for (const e of outgoing) {
      if (output.mode === 'single' && e.sourceHandle !== undefined) {
        errors.push({
          code: 'invalid_source_handle_for_single',
          message: 'Mode single : aucune arête ne doit porter un sourceHandle',
          edgeId: e.id
        })
      }
      if (output.mode === 'simple' && e.sourceHandle !== 'success' && e.sourceHandle !== 'failure') {
        errors.push({
          code: 'invalid_source_handle_for_simple',
          message: 'Mode simple : sourceHandle doit valoir "success" ou "failure"',
          edgeId: e.id
        })
      }
      if (output.mode === 'multi') {
        const matches = output.outputs.some(o => o.id === e.sourceHandle)
        if (!matches) {
          errors.push({
            code: 'invalid_source_handle_for_multi',
            message: `Mode multi : sourceHandle "${e.sourceHandle ?? '(vide)'}" ne correspond à aucun output.id`,
            edgeId: e.id
          })
        }
      }
    }
  }

  // Condition rules
  for (const n of graph.nodes) {
    if (n.data.kind !== 'condition') continue
    if (n.data.params.conditionType === 'data_available') {
      if (!(DataAvailableExpressions as readonly string[]).includes(n.data.params.expression)) {
        errors.push({
          code: 'unknown_data_available_expression',
          message: `Expression inconnue pour data_available : ${n.data.params.expression}`,
          nodeId: n.id
        })
      }
    }
    const outgoing = graph.edges.filter(e => e.source === n.id)
    for (const e of outgoing) {
      if (e.sourceHandle !== 'true' && e.sourceHandle !== 'false') {
        errors.push({
          code: 'invalid_source_handle_for_condition',
          message: 'Condition : sourceHandle doit valoir "true" ou "false"',
          edgeId: e.id
        })
      }
    }
  }

  // Cycle detection via topological sort restricted to nodes
  const outgoing = new Map<string, GraphEdge[]>()
  const inDeg = new Map<string, number>()
  for (const n of graph.nodes) { outgoing.set(n.id, []); inDeg.set(n.id, 0) }
  for (const e of graph.edges) {
    if (!nodesById.has(e.source) || !nodesById.has(e.target) || e.source === e.target) continue
    outgoing.get(e.source)!.push(e)
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1)
  }
  const queue = [...graph.nodes.filter(n => (inDeg.get(n.id) ?? 0) === 0).map(n => n.id)]
  let visited = 0
  while (queue.length > 0) {
    const id = queue.shift()!
    visited++
    for (const e of outgoing.get(id) ?? []) {
      const r = (inDeg.get(e.target) ?? 0) - 1
      inDeg.set(e.target, r)
      if (r === 0) queue.push(e.target)
    }
  }
  if (visited < graph.nodes.length) {
    errors.push({ code: 'cycle', message: 'Un cycle a été détecté dans le graphe' })
  }

  return { errors, warnings }
}
