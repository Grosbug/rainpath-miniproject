import { describe, it, expect } from 'vitest'
import { simulateAddEdge, simulateChangeDaysAfter, simulateRemoveEdge } from '../src/algorithms/simulate'
import type { Graph } from '../src/schemas/primitives'

const startNode = { id: 's', position: { x: 0, y: 200 }, data: { kind: 'start' as const } }
const endNode = (id = 'e') => ({ id, position: { x: 1, y: 200 }, data: { kind: 'end' as const } })
const sendNode = (id: string) => ({
  id, position: { x: 1, y: 200 },
  data: { kind: 'send_email' as const, params: { subject: '', body: '', output: { mode: 'simple' as const, successCondition: { statuses: ['delivered'] } } } }
})
const edge = (id: string, source: string, target: string, daysAfter = 1, sourceHandle?: string) =>
  ({ id, source, target, daysAfter, sourceHandle })

describe('simulateAddEdge', () => {
  it('flags selfLoop when source === target', () => {
    const g: Graph = { nodes: [startNode, sendNode('a'), endNode()], edges: [edge('e1', 's', 'a', 1), edge('e2', 'a', 'e', 1)] }
    const r = simulateAddEdge(g, 'a', 'a', 0)
    expect(r.selfLoop).toBe(true)
  })

  it('flags cycle when edge would create one', () => {
    const g: Graph = { nodes: [startNode, sendNode('a'), sendNode('b'), endNode()], edges: [
      edge('e1', 's', 'a', 1), edge('e2', 'a', 'b', 1), edge('e3', 'b', 'e', 1)
    ] }
    const r = simulateAddEdge(g, 'b', 'a', 0)
    expect(r.cycle).toBe(true)
  })

  it('reports shift when target moves forward', () => {
    const g: Graph = { nodes: [startNode, sendNode('a'), sendNode('b'), endNode()], edges: [
      edge('e1', 's', 'a', 1),
      edge('e2', 's', 'b', 3),
      edge('e3', 'b', 'e', 1)
    ] }
    // before: a.X=1, b.X=3, e.X=4 ; add a->e with daysAfter=10 → e.X = max(4, 1+10) = 11
    const r = simulateAddEdge(g, 'a', 'e', 10)
    expect(r.cycle).toBe(false)
    expect(r.shifts.get('e')).toEqual({ from: 4, to: 11 })
  })

  it('no shift when daysAfter does not exceed existing max', () => {
    const g: Graph = { nodes: [startNode, sendNode('a'), endNode()], edges: [edge('e1', 's', 'e', 10)] }
    const r = simulateAddEdge(g, 's', 'a', 0)
    expect(r.shifts.size).toBe(0) // a is new (well, it was orphan), so newX of a=0, existingX of a=0
  })

  it('flags handleConflict when sourceHandle already used', () => {
    const g: Graph = { nodes: [startNode, sendNode('a'), endNode()], edges: [
      edge('e1', 's', 'a', 1),
      edge('e2', 'a', 'e', 1, 'h1')
    ] }
    const r = simulateAddEdge(g, 'a', 'e', 0, 'h1')
    expect(r.handleConflict).toBe(true)
  })
})

describe('simulateChangeDaysAfter', () => {
  it('reports shift when increasing daysAfter on an edge', () => {
    const g: Graph = { nodes: [startNode, sendNode('a'), endNode()], edges: [
      edge('e1', 's', 'a', 1), edge('e2', 'a', 'e', 1)
    ] }
    const r = simulateChangeDaysAfter(g, 'e2', 30)
    expect(r.shifts.get('e')).toEqual({ from: 2, to: 31 })
  })

  it('reports backward shift when decreasing daysAfter', () => {
    const g: Graph = { nodes: [startNode, sendNode('a'), endNode()], edges: [
      edge('e1', 's', 'a', 1), edge('e2', 'a', 'e', 10)
    ] }
    const r = simulateChangeDaysAfter(g, 'e2', 2)
    expect(r.shifts.get('e')).toEqual({ from: 11, to: 3 })
  })
})

describe('simulateRemoveEdge', () => {
  it('moves a node back when removing its only incoming edge', () => {
    const g: Graph = { nodes: [startNode, sendNode('a'), endNode()], edges: [
      edge('e1', 's', 'a', 5), edge('e2', 'a', 'e', 1)
    ] }
    const r = simulateRemoveEdge(g, 'e1')
    // a becomes orphan → defaults to X=0 ; e's source is now disconnected too
    expect(r.shifts.get('a')).toEqual({ from: 5, to: 0 })
  })
})
