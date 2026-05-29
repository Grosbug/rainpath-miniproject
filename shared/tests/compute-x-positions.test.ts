import { describe, it, expect } from 'vitest'
import { computeXPositions } from '../src/algorithms/compute-x-positions'
import type { Graph } from '../src/schemas/primitives'

const startNode = { id: 's', position: { x: 0, y: 200 }, data: { kind: 'start' as const } }
const endNode = (id = 'e') => ({ id, position: { x: 0, y: 200 }, data: { kind: 'end' as const } })
const sendNode = (id: string) => ({
  id, position: { x: 0, y: 200 },
  data: { kind: 'send_email' as const, params: { subject: '', body: '', output: { mode: 'simple' as const, successCondition: { statuses: ['delivered'] } } } }
})
const edge = (id: string, source: string, target: string, daysAfter: number, sourceHandle?: string) =>
  ({ id, source, target, daysAfter, sourceHandle })

describe('computeXPositions', () => {
  it('places start at X=0', () => {
    const g: Graph = { nodes: [startNode], edges: [] }
    const x = computeXPositions(g)
    expect(x.get('s')).toBe(0)
  })

  it('propagates daysAfter on a linear path', () => {
    const g: Graph = {
      nodes: [startNode, sendNode('a'), endNode()],
      edges: [edge('e1', 's', 'a', 7), edge('e2', 'a', 'e', 8)]
    }
    const x = computeXPositions(g)
    expect(x.get('s')).toBe(0)
    expect(x.get('a')).toBe(7)
    expect(x.get('e')).toBe(15)
  })

  it('uses max() on convergence', () => {
    // s -3-> a -2-> c
    //   \-5-> b -1-/
    const g: Graph = {
      nodes: [startNode, sendNode('a'), sendNode('b'), sendNode('c')],
      edges: [
        edge('e1', 's', 'a', 3),
        edge('e2', 's', 'b', 5),
        edge('e3', 'a', 'c', 2),
        edge('e4', 'b', 'c', 1)
      ]
    }
    const x = computeXPositions(g)
    expect(x.get('c')).toBe(6) // max(3+2=5, 5+1=6)
  })

  it('throws on cycle', () => {
    const g: Graph = {
      nodes: [startNode, sendNode('a'), sendNode('b')],
      edges: [
        edge('e1', 's', 'a', 1),
        edge('e2', 'a', 'b', 1),
        edge('e3', 'b', 'a', 0)
      ]
    }
    expect(() => computeXPositions(g)).toThrow(/cycle/i)
  })

  it('throws when start is missing', () => {
    const g: Graph = { nodes: [endNode()], edges: [] }
    expect(() => computeXPositions(g)).toThrow(/start/i)
  })

  it('preserves orphan X from existingX', () => {
    const orphan = sendNode('o')
    orphan.position.x = 42
    const g: Graph = {
      nodes: [startNode, orphan, endNode()],
      edges: [edge('e1', 's', 'e', 5)]
    }
    const x = computeXPositions(g, new Map([['o', 42]]))
    expect(x.get('s')).toBe(0)
    expect(x.get('e')).toBe(5)
    expect(x.get('o')).toBe(42) // orphan preserved
  })

  it('defaults orphan X to 0 when no existingX provided', () => {
    const g: Graph = {
      nodes: [startNode, sendNode('orphan'), endNode()],
      edges: [edge('e1', 's', 'e', 5)]
    }
    const x = computeXPositions(g)
    expect(x.get('orphan')).toBe(0)
  })

  it('handles multiple ends', () => {
    const g: Graph = {
      nodes: [startNode, sendNode('a'), endNode('e1'), endNode('e2')],
      edges: [
        edge('e_sa', 's', 'a', 1),
        edge('e_ae1', 'a', 'e1', 2),
        edge('e_ae2', 'a', 'e2', 10)
      ]
    }
    const x = computeXPositions(g)
    expect(x.get('e1')).toBe(3)
    expect(x.get('e2')).toBe(11)
  })
})
