import type { Graph } from '@rainpath/shared'

export type GraphNode = Graph['nodes'][number]
export type GraphEdge = Graph['edges'][number]

export type EditorSnapshot = {
  name: string
  description: string
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/**
 * Deterministic hash of a snapshot used by the auto-save dedup gate.
 * Uses JSON.stringify with a stable key order (sort keys recursively).
 */
export function hashSnapshot(s: EditorSnapshot): string {
  return stableStringify(s)
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  const keys = Object.keys(value as Record<string, unknown>).sort()
  return (
    '{' +
    keys
      .map(k => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  )
}
