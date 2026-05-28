import { describe, it, expect } from 'vitest'
import { computeReachability } from '../src/algorithms/compute-reachability'
import type { Graph } from '../src/schemas/primitives'

const startNode = { id: 's', position: { x: 0, y: 200 }, data: { kind: 'start' as const } }
const endNode = (id = 'e') => ({ id, position: { x: 1, y: 200 }, data: { kind: 'end' as const } })
const emailNode = (id: string, output: any = { mode: 'single' }) => ({
  id, position: { x: 1, y: 200 },
  data: { kind: 'send_email' as const, params: { subject: '', body: '', output } }
})
const condDataAvailNode = (id: string, expression: string) => ({
  id, position: { x: 1, y: 200 },
  data: { kind: 'condition' as const, params: { conditionType: 'data_available' as const, expression } }
})
const edge = (id: string, source: string, target: string, daysAfter = 1, sourceHandle?: string) =>
  ({ id, source, target, daysAfter, sourceHandle })

const profileEmpty = { name: 'Anon', email: null, phone: null, whatsapp: null, address: null }
const profileFull = { name: 'X', email: 'a@b.c', phone: '+33', whatsapp: '+33', address: '1 rue' }

describe('computeReachability', () => {
  it('marks history nodes as visited and current as current', () => {
    const g: Graph = {
      nodes: [startNode, emailNode('a'), endNode()],
      edges: [edge('e1', 's', 'a', 1), edge('e2', 'a', 'e', 1)]
    }
    const r = computeReachability(g, profileFull, 'a', ['s'])
    expect(r.get('s')).toBe('visited')
    expect(r.get('a')).toBe('current')
    expect(r.get('e')).toBe('reachable')
  })

  it('marks the false branch as blocked when data_available is true', () => {
    const g: Graph = {
      nodes: [startNode, condDataAvailNode('c', 'patient.email'), endNode('et'), endNode('ef')],
      edges: [
        edge('e_sc', 's', 'c', 0),
        edge('e_ct', 'c', 'et', 1, 'true'),
        edge('e_cf', 'c', 'ef', 1, 'false')
      ]
    }
    const r = computeReachability(g, profileFull, 'c', ['s'])
    expect(r.get('et')).toBe('reachable')
    expect(r.get('ef')).toBe('blocked')
  })

  it('marks the true branch as blocked when data_available is false', () => {
    const g: Graph = {
      nodes: [startNode, condDataAvailNode('c', 'patient.email'), endNode('et'), endNode('ef')],
      edges: [
        edge('e_sc', 's', 'c', 0),
        edge('e_ct', 'c', 'et', 1, 'true'),
        edge('e_cf', 'c', 'ef', 1, 'false')
      ]
    }
    const r = computeReachability(g, profileEmpty, 'c', ['s'])
    expect(r.get('et')).toBe('blocked')
    expect(r.get('ef')).toBe('reachable')
  })

  it('promotes a blocked node back to reachable when another path makes it accessible', () => {
    // s -> c (data: email) -> (true) -> target ; s -> a -> target
    // With profile empty, c.true → blocked, but a → target is still reachable.
    const g: Graph = {
      nodes: [
        startNode,
        condDataAvailNode('c', 'patient.email'),
        emailNode('a'),
        endNode('target')
      ],
      edges: [
        edge('e_sc', 's', 'c', 0),
        edge('e_sa', 's', 'a', 0),
        edge('e_c_target', 'c', 'target', 1, 'true'),
        edge('e_a_target', 'a', 'target', 1)
      ]
    }
    const r = computeReachability(g, profileEmpty, 's', [])
    expect(r.get('target')).toBe('reachable')
  })

  it('propagates both branches when previous_result (unknown future)', () => {
    const condRes = {
      id: 'c', position: { x: 1, y: 200 },
      data: { kind: 'condition' as const, params: { conditionType: 'previous_result' as const, expression: 'last.status == opened' } }
    }
    const g: Graph = {
      nodes: [startNode, condRes, endNode('et'), endNode('ef')],
      edges: [
        edge('e_sc', 's', 'c', 0),
        edge('e_ct', 'c', 'et', 1, 'true'),
        edge('e_cf', 'c', 'ef', 1, 'false')
      ]
    }
    const r = computeReachability(g, profileEmpty, 'c', ['s'])
    expect(r.get('et')).toBe('reachable')
    expect(r.get('ef')).toBe('reachable')
  })

  it('propagates all outputs of send_* multi', () => {
    const node = emailNode('a', {
      mode: 'multi',
      outputs: [
        { id: 'eng', label: 'Engagé', condition: { statuses: ['opened'] } },
        { id: 'rej', label: 'Rejeté', condition: { statuses: ['bounced'] } }
      ]
    })
    const g: Graph = {
      nodes: [startNode, node, endNode('e1'), endNode('e2')],
      edges: [
        edge('e_sa', 's', 'a', 1),
        edge('e_ae1', 'a', 'e1', 1, 'eng'),
        edge('e_ae2', 'a', 'e2', 1, 'rej')
      ]
    }
    const r = computeReachability(g, profileFull, 'a', ['s'])
    expect(r.get('e1')).toBe('reachable')
    expect(r.get('e2')).toBe('reachable')
  })

  it('leaves nodes unreachable when not connected from current', () => {
    const g: Graph = {
      nodes: [startNode, emailNode('orphan'), endNode()],
      edges: [edge('e1', 's', 'e', 1)]
    }
    const r = computeReachability(g, profileFull, 's', [])
    expect(r.get('orphan')).toBe('unreachable')
  })
})
