import { describe, it, expect } from 'vitest'
import type { Graph } from '@rainpath/shared'
import { canvasDayForNode } from './cumulative-days'

const node = (id: string, x: number, data: Graph['nodes'][number]['data']): Graph['nodes'][number] => ({
  id,
  position: { x, y: 100 },
  data
})
const send = (id: string, x: number): Graph['nodes'][number] =>
  node(id, x, {
    kind: 'send_email',
    params: { subject: '', body: '', output: { mode: 'simple', successCondition: { statuses: ['delivered'] } } }
  } as Graph['nodes'][number]['data'])

/**
 * `m` routes to the SAME end via success (daysAfter 5) and failure (daysAfter 30).
 * The editor layout X of `e` is the worst case (35), but the real success route
 * lands the patient on the end at J+10. The canvas must place the end card on
 * its real run day so the J+N cursor (which also uses the real day) sits on it.
 */
const branchingGraph: Graph = {
  nodes: [node('s', 0, { kind: 'start' }), send('m', 5), node('e', 35, { kind: 'end' })],
  edges: [
    { id: 'e1', source: 's', target: 'm', daysAfter: 5 },
    { id: 'e2', source: 'm', target: 'e', daysAfter: 5, sourceHandle: 'success' },
    { id: 'e3', source: 'm', target: 'e', daysAfter: 30, sourceHandle: 'failure' }
  ]
}

describe('canvasDayForNode', () => {
  it('places a reached end on its real run day, not the worst-case layout X', () => {
    const history = [{ nodeId: 's' }, { nodeId: 'm', outcome: 'delivered' }, { nodeId: 'e' }]
    const e = branchingGraph.nodes.find(n => n.id === 'e')!
    // Layout X is 35 (the long failure branch); the real success route is J+10.
    expect(canvasDayForNode(branchingGraph, history, 'e', [], e)).toBe(10)
  })

  it('places a visited send on its real run day', () => {
    const history = [{ nodeId: 's' }, { nodeId: 'm', outcome: 'delivered' }]
    const m = branchingGraph.nodes.find(n => n.id === 'm')!
    expect(canvasDayForNode(branchingGraph, history, 'm', ['m'], m)).toBe(5)
  })

  it('projects an open frontier from its visited predecessor', () => {
    // s visited; a/b are frontiers projectable one hop out.
    const g: Graph = {
      nodes: [node('s', 0, { kind: 'start' }), send('a', 3), send('b', 5)],
      edges: [
        { id: 'e1', source: 's', target: 'a', daysAfter: 3 },
        { id: 'e2', source: 's', target: 'b', daysAfter: 5 }
      ]
    }
    const history = [{ nodeId: 's' }]
    const a = g.nodes.find(n => n.id === 'a')!
    expect(canvasDayForNode(g, history, 's', ['a', 'b'], a)).toBe(3)
  })

  it('keeps the static layout X for a not-yet-reached future node', () => {
    // Only `s` is visited; the end is two hops out and not a frontier yet —
    // runDayAtNode would collapse it to 0, so we must fall back to layout X (35).
    const history = [{ nodeId: 's' }]
    const e = branchingGraph.nodes.find(n => n.id === 'e')!
    expect(canvasDayForNode(branchingGraph, history, 's', ['m'], e)).toBe(35)
  })
})
