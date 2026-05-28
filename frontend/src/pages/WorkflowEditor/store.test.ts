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
      params: { subject: '', body: '', output: { mode: 'single' } }
    }
  }
}
function edge(id: string, source: string, target: string, daysAfter: number): GraphEdge {
  return { id, source, target, daysAfter }
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

  it('removeNode is a no-op on the last end node', () => {
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), endNode()],
      edges: [edge('e1', 's', 'e', 30)]
    })
    useEditorStore.getState().removeNode('e')
    expect(useEditorStore.getState().nodes.find(n => n.id === 'e')).toBeDefined()
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
})
