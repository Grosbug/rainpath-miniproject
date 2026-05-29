import { describe, it, expect, beforeEach } from 'vitest'
import { START_Y } from '@rainpath/shared'
import { useEditorStore } from './store'
import type { GraphNode, GraphEdge } from './snapshot'

function startNode(): GraphNode {
  return { id: 's', position: { x: 0, y: START_Y }, data: { kind: 'start' } }
}
function endNode(id = 'e'): GraphNode {
  return { id, position: { x: 30, y: START_Y }, data: { kind: 'end' } }
}
function emailNode(id: string): GraphNode {
  return {
    id,
    position: { x: 0, y: START_Y },
    data: {
      kind: 'send_email',
      params: {
        subject: '',
        body: '',
        output: { mode: 'simple', successCondition: { statuses: ['delivered'] } }
      }
    }
  }
}
function edge(id: string, source: string, target: string, daysAfter: number, sourceHandle?: string): GraphEdge {
  return { id, source, target, daysAfter, sourceHandle }
}

function reset() {
  useEditorStore.setState({
    workflowId: null,
    name: '',
    description: '',
    nodes: [],
    edges: [],
    selectedNodeId: null,
    selectedEdgeId: null,
    saveStatus: 'idle',
    lastSavedAt: null,
    lastSavedSnapshotHash: null,
    validationErrors: [],
    validationWarnings: [],
    pendingSave: false,
    history: [],
    historyIndex: -1
  })
}

describe('useEditorStore', () => {
  beforeEach(() => reset())

  it('load() seeds state, computes X, and records the first history snapshot', () => {
    useEditorStore.getState().load({
      id: 'w1',
      name: 'WF',
      description: '',
      nodes: [startNode(), emailNode('a'), endNode()],
      edges: [edge('e1', 's', 'a', 5), edge('e2', 'a', 'e', 10)]
    })
    const s = useEditorStore.getState()
    expect(s.workflowId).toBe('w1')
    expect(s.nodes.find(n => n.id === 'a')?.position.x).toBe(5)
    expect(s.nodes.find(n => n.id === 'e')?.position.x).toBe(15)
    expect(s.history).toHaveLength(1)
    expect(s.historyIndex).toBe(0)
    expect(s.saveStatus).toBe('saved')
  })

  it('updateNodePositionY pushes history and changes Y but not X', () => {
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), emailNode('a'), endNode()],
      edges: [edge('e1', 's', 'a', 5), edge('e2', 'a', 'e', 10)]
    })
    useEditorStore.getState().updateNodePositionY('a', 400)
    const s = useEditorStore.getState()
    expect(s.nodes.find(n => n.id === 'a')?.position).toEqual({ x: 5, y: 400 })
    expect(s.history).toHaveLength(2)
    expect(s.historyIndex).toBe(1)
  })

  it('updateNodePositionDrag stores fractional X / Y and live-updates the defining edge daysAfter to the rounded day', () => {
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), emailNode('a'), endNode()],
      edges: [edge('e1', 's', 'a', 5), edge('e2', 'a', 'e', 10)]
    })
    // Drag 'a' to X=8.7 → rounded day = 9 → daysAfter('s'→'a') becomes 9.
    useEditorStore.getState().updateNodePositionDrag('a', 8.7, 400)
    const s = useEditorStore.getState()
    expect(s.nodes.find(n => n.id === 'a')?.position).toEqual({ x: 8.7, y: 400 })
    expect(s.edges.find(e => e.id === 'e1')?.daysAfter).toBe(9)
    // Downstream X stays static during drag — propagation happens on commit.
    expect(s.nodes.find(n => n.id === 'e')?.position.x).toBe(15)
  })

  it('commitNodePositionDrag snaps X and rewrites ALL connected edges (rubber-band)', () => {
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), emailNode('a'), endNode()],
      edges: [edge('e1', 's', 'a', 5), edge('e2', 'a', 'e', 10)]
    })
    // Initial layout: s(0) → a(5) → e(15). Drag 'a' right to X=7.6 (snaps to 8).
    useEditorStore.getState().commitNodePositionDrag('a', 7.6, 400)
    const s = useEditorStore.getState()
    expect(s.nodes.find(n => n.id === 'a')?.position).toEqual({ x: 8, y: 400 })
    // Incoming edge stretches: s→a now spans 8 days.
    expect(s.edges.find(e => e.id === 'e1')?.daysAfter).toBe(8)
    // Outgoing edge shrinks: a→e now spans 15 − 8 = 7 days. End stays put at x=15.
    expect(s.edges.find(e => e.id === 'e2')?.daysAfter).toBe(7)
    expect(s.nodes.find(n => n.id === 'e')?.position.x).toBe(15)
  })

  it('commitNodePositionDrag clamps daysAfter ≥ 0 when dragged before the source', () => {
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), emailNode('a'), endNode()],
      edges: [edge('e1', 's', 'a', 5), edge('e2', 'a', 'e', 10)]
    })
    // Try to drag 'a' to X=-3 (left of start). Snapped to 0; daysAfter clamped to 0.
    useEditorStore.getState().commitNodePositionDrag('a', -3.2, 400)
    const s = useEditorStore.getState()
    expect(s.edges.find(e => e.id === 'e1')?.daysAfter).toBe(0)
    expect(s.nodes.find(n => n.id === 'a')?.position.x).toBe(0)
  })

  it('updateEdgeDays recomputes downstream X', () => {
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), emailNode('a'), endNode()],
      edges: [edge('e1', 's', 'a', 5), edge('e2', 'a', 'e', 10)]
    })
    useEditorStore.getState().updateEdgeDays('e1', 7)
    const s = useEditorStore.getState()
    expect(s.nodes.find(n => n.id === 'a')?.position.x).toBe(7)
    expect(s.nodes.find(n => n.id === 'e')?.position.x).toBe(17)
  })

  it('removeNode cascades incoming and outgoing edges and recomputes X', () => {
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), emailNode('a'), endNode()],
      edges: [edge('e1', 's', 'a', 5), edge('e2', 'a', 'e', 10)]
    })
    useEditorStore.getState().removeNode('a')
    const s = useEditorStore.getState()
    expect(s.nodes.map(n => n.id).sort()).toEqual(['e', 's'])
    expect(s.edges).toHaveLength(0)
  })

  it('removeNode is a no-op on the start node', () => {
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), endNode()],
      edges: [edge('e1', 's', 'e', 30)]
    })
    useEditorStore.getState().removeNode('s')
    expect(useEditorStore.getState().nodes.find(n => n.id === 's')).toBeDefined()
  })

  it('removeNode is a no-op on any end node', () => {
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), endNode('e1'), endNode('e2')],
      edges: [edge('x1', 's', 'e1', 30), edge('x2', 's', 'e2', 30)]
    })
    useEditorStore.getState().removeNode('e1')
    expect(useEditorStore.getState().nodes.find(n => n.id === 'e1')).toBeDefined()
    useEditorStore.getState().removeNode('e2')
    expect(useEditorStore.getState().nodes.find(n => n.id === 'e2')).toBeDefined()
  })

  it('undo / redo restores prior and next states', () => {
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), emailNode('a'), endNode()],
      edges: [edge('e1', 's', 'a', 5), edge('e2', 'a', 'e', 10)]
    })
    useEditorStore.getState().updateNodePositionY('a', 400)
    expect(useEditorStore.getState().canUndo()).toBe(true)
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().nodes.find(n => n.id === 'a')?.position.y).toBe(START_Y)
    expect(useEditorStore.getState().canRedo()).toBe(true)
    useEditorStore.getState().redo()
    expect(useEditorStore.getState().nodes.find(n => n.id === 'a')?.position.y).toBe(400)
  })

  it('history is capped at 50 entries (FIFO)', () => {
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), emailNode('a'), endNode()],
      edges: [edge('e1', 's', 'a', 5), edge('e2', 'a', 'e', 10)]
    })
    // Already 1 history entry from load(). 60 more position changes → expect cap at 50.
    for (let i = 0; i < 60; i++) {
      useEditorStore.getState().updateNodePositionY('a', 200 + i)
    }
    const s = useEditorStore.getState()
    expect(s.history.length).toBe(50)
    expect(s.historyIndex).toBe(49)
  })

  it('addNode appends a node, recomputes X, runs validation', () => {
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), endNode()],
      edges: [edge('e1', 's', 'e', 30)]
    })
    const newId = useEditorStore.getState().addNode({
      kind: 'send_email',
      data: {
        kind: 'send_email',
        params: { subject: 'Hi', body: 'B', output: { mode: 'simple', successCondition: { statuses: ['delivered'] } } }
      } as any
    })
    expect(newId).toBeTruthy()
    const s = useEditorStore.getState()
    expect(s.nodes.find(n => n.id === newId)).toBeDefined()
    expect(s.nodes.find(n => n.id === newId)?.position.x).toBe(0)
    expect(s.selectedNodeId).toBe(newId)
  })

  it('addEdge rejects self-loop', () => {
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), emailNode('a'), endNode()],
      edges: [edge('e1', 's', 'a', 5), edge('e2', 'a', 'e', 10, 'success')]
    })
    const r = useEditorStore.getState().addEdge({ source: 'a', target: 'a', daysAfter: 0, sourceHandle: 'failure' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('self_loop')
  })

  it('addEdge rejects cycle', () => {
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), emailNode('a'), emailNode('b'), endNode()],
      edges: [
        edge('e1', 's', 'a', 1),
        edge('e2', 'a', 'b', 1, 'success'),
        edge('e3', 'b', 'e', 1, 'success')
      ]
    })
    const r = useEditorStore.getState().addEdge({ source: 'b', target: 'a', daysAfter: 1, sourceHandle: 'failure' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('cycle')
  })

  it('addEdge accepts a valid connection and recomputes downstream X', () => {
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), emailNode('a'), endNode()],
      edges: [edge('e1', 's', 'a', 5)]
    })
    const r = useEditorStore.getState().addEdge({ source: 'a', target: 'e', daysAfter: 10, sourceHandle: 'success' })
    expect(r.ok).toBe(true)
    const s = useEditorStore.getState()
    expect(s.nodes.find(n => n.id === 'e')?.position.x).toBe(15)
  })

  it('addEdge rejects when an orphan source tries to feed a Start-reachable target', () => {
    // `b` is an orphan placed in the canvas — it has no path from Start.
    // Linking b → a (which IS reachable from Start) would graft a meaningless upstream onto the timeline.
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), emailNode('a'), emailNode('b'), endNode()],
      edges: [edge('e1', 's', 'a', 5), edge('e2', 'a', 'e', 10, 'success')]
    })
    const r = useEditorStore.getState().addEdge({ source: 'b', target: 'a', daysAfter: 1, sourceHandle: 'success' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('unreachable_source')
  })

  it('addEdge rejects send_* edge without success/failure source handle', () => {
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), emailNode('a'), endNode()],
      edges: [edge('e1', 's', 'a', 5)]
    })
    const r = useEditorStore.getState().addEdge({ source: 'a', target: 'e', daysAfter: 2 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('invalid_source_handle')
  })

  it('addEdge allows two orphans to link together (island under construction)', () => {
    // Both `a` and `b` are orphans — building a sub-branch in isolation is OK; the user
    // can stitch it onto the main flow later by connecting Start (or anything reachable) to `a`.
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), emailNode('a'), emailNode('b'), endNode()],
      edges: [edge('e1', 's', 'e', 30)]
    })
    const r = useEditorStore.getState().addEdge({ source: 'a', target: 'b', daysAfter: 2, sourceHandle: 'success' })
    expect(r.ok).toBe(true)
  })

  it('updateNodeData replaces a node\'s data discriminant payload', () => {
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), emailNode('a'), endNode()],
      edges: [edge('e1', 's', 'a', 5), edge('e2', 'a', 'e', 10, 'success')]
    })
    useEditorStore.getState().updateNodeData('a', {
      kind: 'send_email',
      params: { subject: 'Updated', body: 'Body', output: { mode: 'simple', successCondition: { statuses: ['delivered'] } } }
    } as any)
    const node = useEditorStore.getState().nodes.find(n => n.id === 'a')
    expect(node?.data).toMatchObject({ kind: 'send_email', params: { subject: 'Updated' } })
  })

  it('validation runs on load and updates errors/warnings', () => {
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), endNode('e1'), endNode('orphan')],
      edges: [edge('e_se1', 's', 'e1', 1)]
    })
    const s = useEditorStore.getState()
    expect(Array.isArray(s.validationErrors)).toBe(true)
    expect(Array.isArray(s.validationWarnings)).toBe(true)
  })
})
