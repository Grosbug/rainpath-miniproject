import { create } from 'zustand'
import { computeXPositions } from '@rainpath/shared'
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
      history: [baseSnap],
      historyIndex: 0
    })
  },

  setName: name =>
    set(state => {
      const pushed = pushHistory(state)
      return { ...pushed, name }
    }),

  setDescription: description =>
    set(state => {
      const pushed = pushHistory(state)
      return { ...pushed, description }
    }),

  setSelectedNode: id => set({ selectedNodeId: id, selectedEdgeId: id ? null : get().selectedEdgeId }),
  setSelectedEdge: id => set({ selectedEdgeId: id, selectedNodeId: id ? null : get().selectedNodeId }),

  updateNodePositionY: (id, y) =>
    set(state => {
      const pushed = pushHistory(state)
      const nodes = pushed.nodes.map(n =>
        n.id === id ? { ...n, position: { x: n.position.x, y } } : n
      )
      return { ...pushed, nodes }
    }),

  updateEdgeDays: (id, daysAfter) =>
    set(state => {
      const pushed = pushHistory(state)
      const edges = pushed.edges.map(e => (e.id === id ? { ...e, daysAfter } : e))
      const nodes = recomputeAndApply(pushed.nodes, edges)
      return { ...pushed, edges, nodes }
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
      return {
        ...pushed,
        nodes: recomputed,
        edges,
        selectedNodeId: pushed.selectedNodeId === id ? null : pushed.selectedNodeId
      }
    }),

  removeEdge: id =>
    set(state => {
      const pushed = pushHistory(state)
      const edges = pushed.edges.filter(e => e.id !== id)
      const nodes = recomputeAndApply(pushed.nodes, edges)
      return {
        ...pushed,
        edges,
        nodes,
        selectedEdgeId: pushed.selectedEdgeId === id ? null : pushed.selectedEdgeId
      }
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
      return { ...state, ...snap, nodes, historyIndex: idx }
    }),

  redo: () =>
    set(state => {
      if (state.historyIndex >= state.history.length - 1) return state
      const idx = state.historyIndex + 1
      const snap = state.history[idx]!
      const nodes = recomputeAndApply(snap.nodes, snap.edges)
      return { ...state, ...snap, nodes, historyIndex: idx }
    }),

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  snapshot: () => {
    const s = get()
    return { name: s.name, description: s.description, nodes: s.nodes, edges: s.edges }
  }
}))
