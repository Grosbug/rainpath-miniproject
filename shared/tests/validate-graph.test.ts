import { describe, it, expect } from 'vitest'
import { validateGraph } from '../src/algorithms/validate-graph'
import { START_Y } from '../src/constants'

const startNode = { id: 's', position: { x: 0, y: START_Y }, data: { kind: 'start' as const } }
const endNode = (id = 'e') => ({ id, position: { x: 1, y: START_Y }, data: { kind: 'end' as const } })
const emailNode = (id: string, output: any = { mode: 'simple', successCondition: { statuses: ['delivered'] } }) => ({
  id, position: { x: 5, y: START_Y },
  data: { kind: 'send_email' as const, params: { subject: '', body: '', output } }
})
const edge = (id: string, source: string, target: string, daysAfter = 1, sourceHandle?: string) =>
  ({ id, source, target, daysAfter, sourceHandle })

describe('validateGraph — structural', () => {
  it('accepts a minimal valid graph (start → end)', () => {
    const r = validateGraph({
      nodes: [startNode, endNode()],
      edges: [edge('e1', 's', 'e', 5)]
    })
    expect(r.errors).toHaveLength(0)
  })

  it('rejects missing start', () => {
    const r = validateGraph({ nodes: [endNode()], edges: [] })
    expect(r.errors.some(e => e.code === 'no_start')).toBe(true)
  })

  it('rejects multiple starts', () => {
    const second = { ...startNode, id: 's2' }
    const r = validateGraph({ nodes: [startNode, second, endNode()], edges: [edge('e1', 's', 'e', 1)] })
    expect(r.errors.some(e => e.code === 'multiple_starts')).toBe(true)
  })

  it('rejects no end', () => {
    const r = validateGraph({ nodes: [startNode], edges: [] })
    expect(r.errors.some(e => e.code === 'no_end')).toBe(true)
  })

  it('rejects multiple ends', () => {
    const second = endNode('e2')
    const r = validateGraph({
      nodes: [startNode, endNode(), second],
      edges: [edge('e1', 's', 'e', 1), edge('e2', 's', 'e2', 1)]
    })
    expect(r.errors.some(e => e.code === 'multiple_ends')).toBe(true)
  })

  it('rejects edge to non-existent node', () => {
    const r = validateGraph({ nodes: [startNode, endNode()], edges: [edge('e1', 's', 'ghost', 1)] })
    expect(r.errors.some(e => e.code === 'edge_dangling')).toBe(true)
  })

  it('rejects self-loop', () => {
    const r = validateGraph({
      nodes: [startNode, emailNode('a'), endNode()],
      edges: [
        edge('e1', 's', 'a', 1),
        edge('e_self', 'a', 'a', 0),
        edge('e2', 'a', 'e', 1)
      ]
    })
    expect(r.errors.some(e => e.code === 'self_loop')).toBe(true)
  })

  it('rejects cycle', () => {
    const r = validateGraph({
      nodes: [startNode, emailNode('a'), emailNode('b'), endNode()],
      edges: [
        edge('e1', 's', 'a', 1),
        edge('e2', 'a', 'b', 1),
        edge('e3', 'b', 'a', 1),
        edge('e4', 'b', 'e', 1)
      ]
    })
    expect(r.errors.some(e => e.code === 'cycle')).toBe(true)
  })

  it('rejects edge entering start', () => {
    const r = validateGraph({
      nodes: [startNode, emailNode('a'), endNode()],
      edges: [edge('e1', 'a', 's', 1), edge('e2', 's', 'e', 1)]
    })
    expect(r.errors.some(e => e.code === 'edge_into_start')).toBe(true)
  })

  it('rejects edge leaving end', () => {
    const r = validateGraph({
      nodes: [startNode, endNode(), emailNode('a')],
      edges: [edge('e1', 's', 'e', 1), edge('e2', 'e', 'a', 1)]
    })
    expect(r.errors.some(e => e.code === 'edge_from_end')).toBe(true)
  })

  it('rejects duplicate sourceHandle on same node', () => {
    const node = emailNode('a', { mode: 'simple', successCondition: { statuses: ['delivered'] } })
    const r = validateGraph({
      nodes: [startNode, node, endNode('e1'), endNode('e2')],
      edges: [
        edge('e_sa', 's', 'a', 1),
        edge('e_a_e1', 'a', 'e1', 1, 'success'),
        edge('e_a_e2', 'a', 'e2', 1, 'success') // duplicate handle
      ]
    })
    expect(r.errors.some(e => e.code === 'duplicate_source_handle')).toBe(true)
  })

  it('allows fan-out from a node without explicit handles (undefined sourceHandle)', () => {
    // `start` has no output split — two outgoing edges with undefined sourceHandle is a valid parallel fan-out.
    const r = validateGraph({
      nodes: [startNode, endNode('e1'), endNode('e2')],
      edges: [
        edge('e_s_e1', 's', 'e1', 1),
        edge('e_s_e2', 's', 'e2', 1)
      ]
    })
    expect(r.errors.some(e => e.code === 'duplicate_source_handle')).toBe(false)
  })
})

describe('validateGraph — send_* output rules', () => {
  it('rejects status outside CHANNEL_STATUSES', () => {
    const node = emailNode('a', {
      mode: 'simple',
      successCondition: { statuses: ['nonsense_status'] }
    })
    const r = validateGraph({
      nodes: [startNode, node, endNode()],
      edges: [edge('e1', 's', 'a', 1), edge('e2', 'a', 'e', 1, 'success')]
    })
    expect(r.errors.some(e => e.code === 'status_not_in_channel')).toBe(true)
  })

  it('rejects multi outputs sharing a status', () => {
    const node = emailNode('a', {
      mode: 'multi',
      outputs: [
        { id: 'a', label: 'A', condition: { statuses: ['opened'] } },
        { id: 'b', label: 'B', condition: { statuses: ['opened'] } } // same status
      ]
    })
    const r = validateGraph({
      nodes: [startNode, node, endNode('e1'), endNode('e2')],
      edges: [
        edge('e_sa', 's', 'a', 1),
        edge('e_ae1', 'a', 'e1', 1, 'a'),
        edge('e_ae2', 'a', 'e2', 1, 'b')
      ]
    })
    expect(r.errors.some(e => e.code === 'status_overlap_in_multi')).toBe(true)
  })

  it('rejects sourceHandle in simple mode other than success/failure', () => {
    const node = emailNode('a', {
      mode: 'simple',
      successCondition: { statuses: ['opened'] }
    })
    const r = validateGraph({
      nodes: [startNode, node, endNode()],
      edges: [edge('e1', 's', 'a', 1), edge('e2', 'a', 'e', 1, 'weird_handle')]
    })
    expect(r.errors.some(e => e.code === 'invalid_source_handle_for_simple')).toBe(true)
  })

  it('rejects multi outputs with duplicate output.id', () => {
    const node = emailNode('a', {
      mode: 'multi',
      outputs: [
        { id: 'same', label: 'First', condition: { statuses: ['opened'] } },
        { id: 'same', label: 'Second', condition: { statuses: ['clicked'] } }
      ]
    })
    const r = validateGraph({
      nodes: [startNode, node, endNode('e1'), endNode('e2')],
      edges: [
        edge('e_sa', 's', 'a', 1),
        edge('e_ae1', 'a', 'e1', 1, 'same'),
        edge('e_ae2', 'a', 'e2', 1, 'same')
      ]
    })
    expect(r.errors.some(e => e.code === 'duplicate_output_id')).toBe(true)
  })

  it('rejects sourceHandle not matching any multi output.id', () => {
    const node = emailNode('a', {
      mode: 'multi',
      outputs: [{ id: 'engaged', label: 'Engagé', condition: { statuses: ['opened'] } }]
    })
    const r = validateGraph({
      nodes: [startNode, node, endNode()],
      edges: [
        edge('e1', 's', 'a', 1),
        edge('e2', 'a', 'e', 1, 'unknown_handle')
      ]
    })
    expect(r.errors.some(e => e.code === 'invalid_source_handle_for_multi')).toBe(true)
  })

  it('rejects status outside channel in multi mode outputs', () => {
    const node = emailNode('a', {
      mode: 'multi',
      outputs: [{ id: 'eng', label: 'Engagé', condition: { statuses: ['nonsense_status'] } }]
    })
    const r = validateGraph({
      nodes: [startNode, node, endNode()],
      edges: [
        edge('e1', 's', 'a', 1),
        edge('e2', 'a', 'e', 1, 'eng')
      ]
    })
    expect(r.errors.some(e => e.code === 'status_not_in_channel')).toBe(true)
  })

  it('warns on incomplete multi coverage', () => {
    // email has 6 statuses; cover only 'opened'
    const node = emailNode('a', {
      mode: 'multi',
      outputs: [{ id: 'eng', label: 'Engagé', condition: { statuses: ['opened'] } }]
    })
    const r = validateGraph({
      nodes: [startNode, node, endNode()],
      edges: [edge('e1', 's', 'a', 1), edge('e2', 'a', 'e', 1, 'eng')]
    })
    expect(r.warnings.some(w => w.code === 'incomplete_status_coverage')).toBe(true)
  })
})


describe('validateGraph — start position', () => {
  it('rejects start.position.x !== 0', () => {
    const movedStart = { ...startNode, position: { x: 10, y: 200 } }
    const r = validateGraph({
      nodes: [movedStart, endNode()],
      edges: [edge('e1', 's', 'e', 5)]
    })
    expect(r.errors.some(e => e.code === 'start_position_x_must_be_zero')).toBe(true)
  })
  it('rejects start.position.y !== START_Y', () => {
    const movedStart = { ...startNode, position: { x: 0, y: 999 } }
    const r = validateGraph({
      nodes: [movedStart, endNode()],
      edges: [edge('e1', 's', 'e', 5)]
    })
    expect(r.errors.some(e => e.code === 'start_position_y_must_be_default')).toBe(true)
  })
})
