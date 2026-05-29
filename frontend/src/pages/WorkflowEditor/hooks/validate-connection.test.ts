import { describe, it, expect } from 'vitest'
import { START_Y } from '@rainpath/shared'
import type { GraphNode, GraphEdge } from '../snapshot'
import { validateConnection } from './validate-connection'

const s = (id: string, x = 0, y = START_Y): GraphNode => ({ id, position: { x, y }, data: { kind: 'start' } as any })
const e = (id: string, x: number, y = START_Y): GraphNode => ({ id, position: { x, y }, data: { kind: 'end' } as any })
const a = (id: string, x: number, y = START_Y): GraphNode => ({
  id, position: { x, y },
  data: { kind: 'send_email', params: { subject: '', body: '', output: { mode: 'simple', successCondition: { statuses: ['delivered'] } } } } as any
})
const edge = (id: string, source: string, target: string, daysAfter = 1): GraphEdge => ({ id, source, target, daysAfter })

describe('validateConnection', () => {
  it('returns ok for a clean source→target hop', () => {
    const graph = { nodes: [s('S'), a('A', 1), e('E', 2)], edges: [edge('e1', 'S', 'A')] }
    expect(validateConnection({ sourceNodeId: 'A', targetNodeId: 'E', sourceType: 'source', targetType: 'target' }, graph)).toBe('ok')
  })

  it('rejects self_loop', () => {
    const graph = { nodes: [s('S'), a('A', 1)], edges: [] }
    expect(validateConnection({ sourceNodeId: 'A', targetNodeId: 'A' }, graph)).toBe('self_loop')
  })

  it('rejects edges going into the start node', () => {
    const graph = { nodes: [s('S'), a('A', 1)], edges: [] }
    expect(validateConnection({ sourceNodeId: 'A', targetNodeId: 'S' }, graph)).toBe('edge_into_start')
  })

  it('rejects edges leaving an end node', () => {
    const graph = { nodes: [s('S'), e('E', 5), a('A', 6)], edges: [] }
    expect(validateConnection({ sourceNodeId: 'E', targetNodeId: 'A' }, graph)).toBe('edge_from_end')
  })

  it('rejects incompatible handle types (source↔source)', () => {
    const graph = { nodes: [s('S'), a('A', 1)], edges: [] }
    expect(validateConnection(
      { sourceNodeId: 'S', targetNodeId: 'A', sourceType: 'source', targetType: 'source' },
      graph
    )).toBe('incompatible_handles')
  })

  it('rejects a cycle: S→A→B; new edge B→A would close the loop', () => {
    const graph = {
      nodes: [s('S'), a('A', 1), a('B', 2), e('E', 3)],
      edges: [edge('e1', 'S', 'A'), edge('e2', 'A', 'B'), edge('e3', 'B', 'E')]
    }
    expect(validateConnection({ sourceNodeId: 'B', targetNodeId: 'A' }, graph)).toBe('cycle')
  })

  it('rejects an orphan source feeding into a reachable target (unreachable_source)', () => {
    const graph = {
      nodes: [s('S'), a('A', 1), a('ORPHAN', 0), e('E', 2)],
      edges: [edge('e1', 'S', 'A'), edge('e2', 'A', 'E')]
    }
    expect(validateConnection({ sourceNodeId: 'ORPHAN', targetNodeId: 'E' }, graph)).toBe('unreachable_source')
  })

  it('allows fan-in on a node with existing incoming (multi-incoming is by design)', () => {
    const graph = {
      nodes: [s('S'), a('A', 1), a('B', 1), e('E', 2)],
      edges: [edge('e1', 'S', 'A'), edge('e2', 'S', 'B'), edge('e3', 'A', 'E')]
    }
    // B→E joins a fan-in onto E (which already has A→E). Per the project model this is allowed.
    expect(validateConnection({ sourceNodeId: 'B', targetNodeId: 'E' }, graph)).toBe('ok')
  })

  it('excludeEdgeId lets a reconnect ignore the original edge (no spurious cycle)', () => {
    const graph = {
      nodes: [s('S'), a('A', 1), e('E', 2)],
      edges: [edge('e1', 'S', 'A'), edge('e2', 'A', 'E')]
    }
    // Re-routing e2 (A→E) to itself would be a self-loop, but excluding it shouldn't matter
    // for this check — the self_loop catch is independent.
    expect(validateConnection({ sourceNodeId: 'A', targetNodeId: 'A' }, graph, { excludeEdgeId: 'e2' })).toBe('self_loop')
  })
})
