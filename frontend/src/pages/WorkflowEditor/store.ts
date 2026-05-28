import { create } from 'zustand'
import { computeXPositions, validateGraph } from '@rainpath/shared'
import { createId } from '@paralleldrive/cuid2'
import type { GraphNode, GraphEdge, EditorSnapshot } from './snapshot'
import { hashSnapshot } from './snapshot'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'invalid' | 'error' | 'offline'

export type ValidationError = {
  code: string
  message: string
  nodeId?: string
  edgeId?: string
}

type EditorState = {
  workflowId: string | null
  name: string
  description: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  selectedNodeId: string | null
  selectedEdgeId: string | null
  saveStatus: SaveStatus
  lastSavedAt: Date | null
  lastSavedSnapshotHash: string | null
  validationErrors: ValidationError[]
  validationWarnings: ValidationError[]
  pendingSave: boolean

  history: EditorSnapshot[]
  historyIndex: number
}

type EditorActions = {
  load(p: { id: string; name: string; description: string; nodes: GraphNode[]; edges: GraphEdge[] }): void
  setName(name: string): void
  setDescription(desc: string): void
  setSelectedNode(id: string | null): void
  setSelectedEdge(id: string | null): void
  updateNodePositionY(id: string, y: number): void
  updateEdgeDays(id: string, daysAfter: number): void
  removeNode(id: string): void
  removeEdge(id: string): void
  recomputeXPositions(): void
  setSaveStatus(status: SaveStatus, savedAt?: Date | null): void
  setValidationErrors(errors: ValidationError[]): void
  markSaved(hash: string, savedAt: Date): void
  setPendingSave(pending: boolean): void
  addNode(p: { kind: GraphNode['data']['kind']; data: GraphNode['data']; atY?: number }): string
  addEdge(p: { source: string; target: string; sourceHandle?: string; daysAfter: number }): { ok: true; edgeId: string } | { ok: false; reason: 'self_loop' | 'cycle' | 'handle_conflict' | 'dangling' | 'edge_into_start' | 'edge_from_end' }
  updateNodeData(id: string, data: GraphNode['data']): void
  undo(): void
  redo(): void
  canUndo(): boolean
  canRedo(): boolean
  snapshot(): EditorSnapshot
}

const initialState: EditorState = {
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
}

const HISTORY_MAX = 50

function pushHistory(state: EditorState): EditorState {
  const snap: EditorSnapshot = {
    name: state.name,
    description: state.description,
    nodes: state.nodes,
    edges: state.edges
  }
  // Truncate redo branch when a new mutation lands.
  const trimmed = state.history.slice(0, state.historyIndex + 1)
  const next = [...trimmed, snap]
  const overflow = Math.max(0, next.length - HISTORY_MAX)
  return {
    ...state,
    history: overflow > 0 ? next.slice(overflow) : next,
    historyIndex: overflow > 0 ? HISTORY_MAX - 1 : next.length - 1
  }
}

/**
 * After a mutation has been applied, persist the post-mutation values into
 * history[historyIndex] so that redo can restore them correctly.
 */
function recordCurrentSnapshot(state: EditorState): EditorState {
  const snap: EditorSnapshot = {
    name: state.name,
    description: state.description,
    nodes: state.nodes,
    edges: state.edges
  }
  const history = [...state.history]
  history[state.historyIndex] = snap
  return { ...state, history }
}

function runValidation(nodes: GraphNode[], edges: GraphEdge[]): { errors: ValidationError[]; warnings: ValidationError[] } {
  const r = validateGraph({ nodes, edges })
  return {
    errors: r.errors.map(e => ({ code: e.code, message: e.message, nodeId: e.nodeId, edgeId: e.edgeId })),
    warnings: r.warnings.map(w => ({ code: w.code, message: w.message, nodeId: w.nodeId, edgeId: w.edgeId }))
  }
}

function recomputeAndApply(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  const existing = new Map<string, number>(nodes.map(n => [n.id, n.position.x]))
  try {
    const x = computeXPositions({ nodes, edges }, existing)
    return nodes.map(n => ({
      ...n,
      position: { x: x.get(n.id) ?? n.position.x, y: n.position.y }
    }))
  } catch {
    // Cycle or other validation error → leave positions intact, surface via validate() later.
    return nodes
  }
}

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
  ...initialState,

  load: ({ id, name, description, nodes, edges }) => {
    const recomputed = recomputeAndApply(nodes, edges)
    const baseSnap: EditorSnapshot = { name, description, nodes: recomputed, edges }
    const v = runValidation(recomputed, edges)
    set({
      ...initialState,
      workflowId: id,
      name,
      description,
      nodes: recomputed,
      edges,
      saveStatus: 'saved',
      lastSavedAt: new Date(),
      lastSavedSnapshotHash: hashSnapshot(baseSnap),
      validationErrors: v.errors,
      validationWarnings: v.warnings,
      history: [baseSnap],
      historyIndex: 0
    })
  },

  setName: name =>
    set(state => {
      const pushed = pushHistory(state)
      return recordCurrentSnapshot({ ...pushed, name })
    }),

  setDescription: description =>
    set(state => {
      const pushed = pushHistory(state)
      return recordCurrentSnapshot({ ...pushed, description })
    }),

  addNode: ({ data, atY }) => {
    const newId = createId()
    set(state => {
      const startY = state.nodes.find(n => n.data.kind === 'start')?.position.y ?? 200
      const node: GraphNode = {
        id: newId,
        position: { x: 0, y: atY ?? startY + 120 },
        data
      } as GraphNode
      const pushed = pushHistory(state)
      const nodes = recomputeAndApply([...pushed.nodes, node], pushed.edges)
      const v = runValidation(nodes, pushed.edges)
      const next = {
        ...pushed,
        nodes,
        validationErrors: v.errors,
        validationWarnings: v.warnings,
        selectedNodeId: newId
      }
      // Snapshot the post-mutation state so undo/redo restores it correctly.
      const history = [...next.history]
      history[next.historyIndex] = { name: next.name, description: next.description, nodes: next.nodes, edges: next.edges }
      return { ...next, history }
    })
    return newId
  },

  addEdge: ({ source, target, sourceHandle, daysAfter }) => {
    const state = get()

    if (source === target) return { ok: false, reason: 'self_loop' }

    const sourceNode = state.nodes.find(n => n.id === source)
    const targetNode = state.nodes.find(n => n.id === target)
    if (!sourceNode || !targetNode) return { ok: false, reason: 'dangling' }
    if (targetNode.data.kind === 'start') return { ok: false, reason: 'edge_into_start' }
    if (sourceNode.data.kind === 'end') return { ok: false, reason: 'edge_from_end' }

    if (sourceHandle) {
      const conflict = state.edges.some(e => e.source === source && e.sourceHandle === sourceHandle)
      if (conflict) return { ok: false, reason: 'handle_conflict' }
    }

    const prospective = [...state.edges, { id: '__candidate__', source, target, sourceHandle, daysAfter }]
    try {
      computeXPositions({ nodes: state.nodes, edges: prospective })
    } catch {
      return { ok: false, reason: 'cycle' }
    }

    const id = createId()
    set(stateInner => {
      const pushed = pushHistory(stateInner)
      const edges = [...pushed.edges, { id, source, target, sourceHandle, daysAfter }]
      const nodes = recomputeAndApply(pushed.nodes, edges)
      const v = runValidation(nodes, edges)
      const next = {
        ...pushed, edges, nodes,
        validationErrors: v.errors,
        validationWarnings: v.warnings,
        selectedEdgeId: id
      }
      const history = [...next.history]
      history[next.historyIndex] = { name: next.name, description: next.description, nodes: next.nodes, edges: next.edges }
      return { ...next, history }
    })
    return { ok: true, edgeId: id }
  },

  updateNodeData: (id, data) => {
    set(state => {
      const pushed = pushHistory(state)
      const nodes = pushed.nodes.map(n => (n.id === id ? { ...n, data } as GraphNode : n))
      const recomputed = recomputeAndApply(nodes, pushed.edges)
      const v = runValidation(recomputed, pushed.edges)
      const next = {
        ...pushed, nodes: recomputed,
        validationErrors: v.errors,
        validationWarnings: v.warnings
      }
      const history = [...next.history]
      history[next.historyIndex] = { name: next.name, description: next.description, nodes: next.nodes, edges: next.edges }
      return { ...next, history }
    })
  },

  setSelectedNode: id => set({ selectedNodeId: id, selectedEdgeId: id ? null : get().selectedEdgeId }),
  setSelectedEdge: id => set({ selectedEdgeId: id, selectedNodeId: id ? null : get().selectedNodeId }),

  updateNodePositionY: (id, y) =>
    set(state => {
      const pushed = pushHistory(state)
      const nodes = pushed.nodes.map(n =>
        n.id === id ? { ...n, position: { x: n.position.x, y } } : n
      )
      const v = runValidation(nodes, pushed.edges)
      return recordCurrentSnapshot({ ...pushed, nodes, validationErrors: v.errors, validationWarnings: v.warnings })
    }),

  updateEdgeDays: (id, daysAfter) =>
    set(state => {
      const pushed = pushHistory(state)
      const edges = pushed.edges.map(e => (e.id === id ? { ...e, daysAfter } : e))
      const nodes = recomputeAndApply(pushed.nodes, edges)
      const v = runValidation(nodes, edges)
      return recordCurrentSnapshot({ ...pushed, edges, nodes, validationErrors: v.errors, validationWarnings: v.warnings })
    }),

  removeNode: id =>
    set(state => {
      const node = state.nodes.find(n => n.id === id)
      if (!node || node.data.kind === 'start') return state
      const endsCount = state.nodes.filter(n => n.data.kind === 'end').length
      if (node.data.kind === 'end' && endsCount <= 1) return state
      const pushed = pushHistory(state)
      const nodes = pushed.nodes.filter(n => n.id !== id)
      const edges = pushed.edges.filter(e => e.source !== id && e.target !== id)
      const recomputed = recomputeAndApply(nodes, edges)
      const v = runValidation(recomputed, edges)
      return recordCurrentSnapshot({
        ...pushed,
        nodes: recomputed,
        edges,
        selectedNodeId: pushed.selectedNodeId === id ? null : pushed.selectedNodeId,
        validationErrors: v.errors,
        validationWarnings: v.warnings
      })
    }),

  removeEdge: id =>
    set(state => {
      const pushed = pushHistory(state)
      const edges = pushed.edges.filter(e => e.id !== id)
      const nodes = recomputeAndApply(pushed.nodes, edges)
      const v = runValidation(nodes, edges)
      return recordCurrentSnapshot({
        ...pushed,
        edges,
        nodes,
        selectedEdgeId: pushed.selectedEdgeId === id ? null : pushed.selectedEdgeId,
        validationErrors: v.errors,
        validationWarnings: v.warnings
      })
    }),

  recomputeXPositions: () => set(state => ({ ...state, nodes: recomputeAndApply(state.nodes, state.edges) })),

  setSaveStatus: (saveStatus, savedAt) =>
    set(state => ({ ...state, saveStatus, lastSavedAt: savedAt ?? state.lastSavedAt })),

  setValidationErrors: errors => set({ validationErrors: errors }),

  markSaved: (hash, savedAt) =>
    set({ saveStatus: 'saved', lastSavedAt: savedAt, lastSavedSnapshotHash: hash, pendingSave: false }),

  setPendingSave: pendingSave => set({ pendingSave }),

  undo: () =>
    set(state => {
      if (state.historyIndex <= 0) return state
      const idx = state.historyIndex - 1
      const snap = state.history[idx]!
      const nodes = recomputeAndApply(snap.nodes, snap.edges)
      const v = runValidation(nodes, snap.edges)
      return {
        ...state, ...snap, nodes, historyIndex: idx,
        validationErrors: v.errors, validationWarnings: v.warnings
      }
    }),

  redo: () =>
    set(state => {
      if (state.historyIndex >= state.history.length - 1) return state
      const idx = state.historyIndex + 1
      const snap = state.history[idx]!
      const nodes = recomputeAndApply(snap.nodes, snap.edges)
      const v = runValidation(nodes, snap.edges)
      return {
        ...state, ...snap, nodes, historyIndex: idx,
        validationErrors: v.errors, validationWarnings: v.warnings
      }
    }),

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  snapshot: () => {
    const s = get()
    return { name: s.name, description: s.description, nodes: s.nodes, edges: s.edges }
  }
}))
