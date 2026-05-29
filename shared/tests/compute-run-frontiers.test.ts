import { describe, it, expect } from 'vitest'
import {
  computeActiveFrontiers,
  nodeRunAction,
  nodeScheduledDay,
  resolveFocusedNodeId
} from '../src/algorithms/compute-run-frontiers'
import type { Graph } from '../src/schemas/primitives'

const start = { id: 's', position: { x: 0, y: 200 }, data: { kind: 'start' as const } }
const email = (id: string, x: number) => ({
  id, position: { x, y: 200 },
  data: {
    kind: 'send_email' as const,
    params: { subject: '', body: '', output: { mode: 'simple', successCondition: { statuses: ['delivered'] } } }
  }
})
const end = (id: string, x: number) => ({ id, position: { x, y: 200 }, data: { kind: 'end' as const } })
const edge = (id: string, source: string, target: string, daysAfter = 1, sourceHandle?: string) =>
  ({ id, source, target, daysAfter, sourceHandle })

describe('computeActiveFrontiers', () => {
  it('opens parallel children at the same J day after start is visited', () => {
    const g: Graph = {
      nodes: [start, email('a', 7), email('b', 7), end('e', 14)],
      edges: [
        edge('e1', 's', 'a', 7),
        edge('e2', 's', 'b', 7),
        edge('e3', 'a', 'e', 7, 'success'),
        edge('e4', 'b', 'e', 7, 'success')
      ]
    }
    const f = computeActiveFrontiers(g, [{ nodeId: 's' }])
    expect(f).toEqual(['a', 'b'])
    expect(nodeScheduledDay(g, 'a')).toBe(7)
  })

  it('does not open J+14 until all J+7 frontiers are visited', () => {
    const g: Graph = {
      nodes: [start, email('a', 7), email('b', 7), end('e', 14)],
      edges: [
        edge('e1', 's', 'a', 7),
        edge('e2', 's', 'b', 7),
        edge('e3', 'a', 'e', 7, 'success'),
        edge('e4', 'b', 'e', 7, 'success')
      ]
    }
    const f = computeActiveFrontiers(g, [{ nodeId: 's' }, { nodeId: 'a' }])
    expect(f).toEqual(['b'])
    const f2 = computeActiveFrontiers(g, [{ nodeId: 's' }, { nodeId: 'a' }, { nodeId: 'b' }])
    expect(f2).toEqual(['e'])
  })
})

describe('nodeRunAction', () => {
  it('distinguishes enter vs leave', () => {
    const g: Graph = {
      nodes: [start, email('a', 7)],
      edges: [edge('e1', 's', 'a', 7)]
    }
    const hist = [{ nodeId: 's' }]
    const f = computeActiveFrontiers(g, hist)
    expect(nodeRunAction(g, hist, f, 'a')).toBe('enter')
    expect(nodeRunAction(g, hist, f, 's')).toBe('leave')
  })
})

describe('resolveFocusedNodeId', () => {
  it('keeps stored focus when still valid', () => {
    const g: Graph = {
      nodes: [start, email('a', 7), email('b', 7)],
      edges: [edge('e1', 's', 'a', 7), edge('e2', 's', 'b', 7)]
    }
    const hist = [{ nodeId: 's' }]
    const f = computeActiveFrontiers(g, hist)
    expect(resolveFocusedNodeId(g, hist, f, 'b')).toBe('b')
  })
})
