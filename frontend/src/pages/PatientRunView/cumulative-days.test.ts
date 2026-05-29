import { describe, it, expect } from 'vitest'
import type { Graph } from '@rainpath/shared'
import { dayAtNode, dayOfHistory, scheduledDayOfNode, traversedEdgeIds } from './cumulative-days'

const start = { id: 's', position: { x: 0, y: 200 }, data: { kind: 'start' as const } }
const email = (id: string, x: number) => ({
  id, position: { x, y: 200 },
  data: {
    kind: 'send_email' as const,
    params: { subject: '', body: '', output: { mode: 'simple' as const, successCondition: { statuses: ['delivered'] } } }
  }
})
const end = (id: string, x: number) => ({ id, position: { x, y: 200 }, data: { kind: 'end' as const } })
const edge = (id: string, source: string, target: string, daysAfter = 7, sourceHandle?: string) =>
  ({ id, source, target, daysAfter, sourceHandle })

describe('dayAtNode', () => {
  it('matches history path when the node was already visited', () => {
    const g: Graph = {
      nodes: [start, email('a', 7), end('e', 14)],
      edges: [edge('e1', 's', 'a'), edge('e2', 'a', 'e')]
    }
    const hist = [{ nodeId: 's' }, { nodeId: 'a' }]
    expect(dayOfHistory(g, hist)).toBe(7)
    expect(dayAtNode(g, hist, 'a')).toBe(7)
  })

  it('uses predecessor edges for a frontier node not yet in history', () => {
    const g: Graph = {
      nodes: [start, email('a', 7), email('b', 7)],
      edges: [edge('e1', 's', 'a'), edge('e2', 's', 'b')]
    }
    const hist = [{ nodeId: 's' }]
    expect(dayAtNode(g, hist, 'a')).toBe(7)
    expect(dayAtNode(g, hist, 'b')).toBe(7)
  })

  it('follows the success edge in history when failure branch also exists', () => {
    const g: Graph = {
      nodes: [start, email('a', 7), email('fail', 14), end('e', 21)],
      edges: [
        edge('e1', 's', 'a', 7),
        edge('e2', 'a', 'e', 7, 'success'),
        edge('e3', 'a', 'fail', 7, 'failure')
      ]
    }
    const hist = [
      { nodeId: 's' },
      { nodeId: 'a', outcome: 'delivered' },
      { nodeId: 'e' }
    ]
    expect(dayOfHistory(g, hist)).toBe(14)
    expect(dayAtNode(g, hist, 'e')).toBe(14)
  })

  it('collects traversed edge ids along history', () => {
    const g: Graph = {
      nodes: [start, email('a', 7), email('fail', 14), end('e', 21)],
      edges: [
        edge('e1', 's', 'a', 7),
        edge('e2', 'a', 'e', 7, 'success'),
        edge('e3', 'a', 'fail', 7, 'failure')
      ]
    }
    const hist = [
      { nodeId: 's' },
      { nodeId: 'a' },
      { nodeId: 'e', outcome: 'delivered' }
    ]
    expect(traversedEdgeIds(g, hist)).toEqual(new Set(['e1', 'e2']))
  })

  it('does not jump to layout X when it is ahead of the simulated path', () => {
    const g: Graph = {
      nodes: [start, email('a', 7), end('e', 28)],
      edges: [edge('e1', 's', 'a', 7), edge('e2', 'a', 'e', 7, 'success')]
    }
    const hist = [{ nodeId: 's' }, { nodeId: 'a' }, { nodeId: 'e' }]
    expect(dayAtNode(g, hist, 'e')).toBe(14)
    expect(scheduledDayOfNode(g, 'e')).toBe(28)
  })
})
