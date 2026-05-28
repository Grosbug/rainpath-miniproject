import { Graph, START_Y } from '@rainpath/shared'
import { resolveAdvance, AdvanceError } from './advance'

function startNode() {
  return { id: 's', position: { x: 0, y: START_Y }, data: { kind: 'start' as const } }
}
function endNode(id = 'e') {
  return { id, position: { x: 30, y: START_Y }, data: { kind: 'end' as const } }
}
function emailNode(id: string, output: any = { mode: 'single' }) {
  return {
    id, position: { x: 5, y: START_Y },
    data: { kind: 'send_email' as const, params: { subject: '', body: '', output } }
  } as Graph['nodes'][number]
}
function condNode(id: string) {
  return {
    id, position: { x: 5, y: START_Y },
    data: { kind: 'condition' as const, params: { conditionType: 'data_available', expression: 'patient.email' } }
  } as Graph['nodes'][number]
}
function edge(id: string, source: string, target: string, daysAfter = 1, sourceHandle?: string) {
  return { id, source, target, daysAfter, sourceHandle }
}

describe('resolveAdvance', () => {
  it('start → single outgoing edge', () => {
    const g: Graph = {
      nodes: [startNode(), emailNode('a'), endNode()],
      edges: [edge('e1', 's', 'a', 1), edge('e2', 'a', 'e', 1)]
    }
    expect(resolveAdvance({ graph: g, currentNodeId: 's' })).toEqual({ nextNodeId: 'a' })
  })

  it('send_* mode=single ignores outcome and follows the single outgoing edge', () => {
    const g: Graph = {
      nodes: [startNode(), emailNode('a', { mode: 'single' }), endNode()],
      edges: [edge('e1', 's', 'a', 1), edge('e2', 'a', 'e', 1)]
    }
    expect(resolveAdvance({ graph: g, currentNodeId: 'a', outcome: 'opened' })).toEqual({ nextNodeId: 'e' })
  })

  it('send_* mode=simple with matching successCondition → success handle', () => {
    const a = emailNode('a', { mode: 'simple', successCondition: { statuses: ['delivered', 'opened'] } })
    const g: Graph = {
      nodes: [startNode(), a, endNode('e_ok'), endNode('e_fail')],
      edges: [
        edge('e1', 's', 'a', 1),
        edge('e2', 'a', 'e_ok', 1, 'success'),
        edge('e3', 'a', 'e_fail', 1, 'failure')
      ]
    }
    expect(resolveAdvance({ graph: g, currentNodeId: 'a', outcome: 'opened' })).toEqual({
      nextNodeId: 'e_ok', outcome: 'opened'
    })
    expect(resolveAdvance({ graph: g, currentNodeId: 'a', outcome: 'bounced' })).toEqual({
      nextNodeId: 'e_fail', outcome: 'bounced'
    })
  })

  it('send_* mode=multi with matching status → corresponding handle', () => {
    const a = emailNode('a', {
      mode: 'multi',
      outputs: [
        { id: 'engaged', label: 'Engagé', condition: { statuses: ['opened', 'clicked'] } },
        { id: 'rejected', label: 'Rejeté', condition: { statuses: ['bounced', 'rejected'] } }
      ]
    })
    const g: Graph = {
      nodes: [startNode(), a, endNode('e_eng'), endNode('e_rej')],
      edges: [
        edge('e1', 's', 'a', 1),
        edge('e2', 'a', 'e_eng', 1, 'engaged'),
        edge('e3', 'a', 'e_rej', 1, 'rejected')
      ]
    }
    expect(resolveAdvance({ graph: g, currentNodeId: 'a', outcome: 'clicked' })).toEqual({
      nextNodeId: 'e_eng', outcome: 'clicked'
    })
  })

  it('send_* mode=multi with no outcome → unhandled_outcome', () => {
    const a = emailNode('a', {
      mode: 'multi',
      outputs: [{ id: 'engaged', label: 'Engagé', condition: { statuses: ['opened'] } }]
    })
    const g: Graph = {
      nodes: [startNode(), a, endNode()],
      edges: [edge('e1', 's', 'a', 1), edge('e2', 'a', 'e', 1, 'engaged')]
    }
    try {
      resolveAdvance({ graph: g, currentNodeId: 'a' })
      fail('expected throw')
    } catch (e) {
      expect((e as AdvanceError).code).toBe('unhandled_outcome')
    }
  })

  it('send_* mode=multi with unmatched status → unhandled_outcome', () => {
    const a = emailNode('a', {
      mode: 'multi',
      outputs: [{ id: 'engaged', label: 'Engagé', condition: { statuses: ['opened'] } }]
    })
    const g: Graph = {
      nodes: [startNode(), a, endNode()],
      edges: [edge('e1', 's', 'a', 1), edge('e2', 'a', 'e', 1, 'engaged')]
    }
    expect(() => resolveAdvance({ graph: g, currentNodeId: 'a', outcome: 'bounced' })).toThrow(AdvanceError)
    try { resolveAdvance({ graph: g, currentNodeId: 'a', outcome: 'bounced' }) }
    catch (e) { expect((e as AdvanceError).code).toBe('unhandled_outcome') }
  })

  it('condition node with outcome=true → true handle', () => {
    const c = condNode('c')
    const g: Graph = {
      nodes: [startNode(), c, endNode('e_t'), endNode('e_f')],
      edges: [
        edge('e1', 's', 'c', 1),
        edge('e2', 'c', 'e_t', 1, 'true'),
        edge('e3', 'c', 'e_f', 1, 'false')
      ]
    }
    expect(resolveAdvance({ graph: g, currentNodeId: 'c', outcome: 'true' })).toEqual({
      nextNodeId: 'e_t', outcome: 'true'
    })
    expect(resolveAdvance({ graph: g, currentNodeId: 'c', outcome: 'false' })).toEqual({
      nextNodeId: 'e_f', outcome: 'false'
    })
  })

  it('condition node without outcome → condition_outcome_required', () => {
    const g: Graph = {
      nodes: [startNode(), condNode('c'), endNode()],
      edges: [edge('e1', 's', 'c', 1), edge('e2', 'c', 'e', 1, 'true')]
    }
    try {
      resolveAdvance({ graph: g, currentNodeId: 'c' })
      fail('expected throw')
    } catch (e) {
      expect((e as AdvanceError).code).toBe('condition_outcome_required')
    }
  })

  it('end node → workflow_already_finished', () => {
    const g: Graph = {
      nodes: [startNode(), endNode()],
      edges: [edge('e1', 's', 'e', 1)]
    }
    try {
      resolveAdvance({ graph: g, currentNodeId: 'e' })
      fail('expected throw')
    } catch (e) {
      expect((e as AdvanceError).code).toBe('workflow_already_finished')
    }
  })

  it('no outgoing edge for resolved handle → no_outgoing_edge', () => {
    const a = emailNode('a', { mode: 'simple', successCondition: { statuses: ['delivered'] } })
    const g: Graph = {
      nodes: [startNode(), a, endNode()],
      edges: [
        edge('e1', 's', 'a', 1),
        edge('e2', 'a', 'e', 1, 'success')
        // no 'failure' edge
      ]
    }
    try {
      resolveAdvance({ graph: g, currentNodeId: 'a', outcome: 'bounced' })
      fail('expected throw')
    } catch (e) {
      expect((e as AdvanceError).code).toBe('no_outgoing_edge')
    }
  })
})
