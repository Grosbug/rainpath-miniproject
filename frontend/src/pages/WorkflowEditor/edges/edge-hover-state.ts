import { create } from 'zustand'

/**
 * Ephemeral hover link between an edge's path and its floating label. When several edges
 * cross, hovering either end (path or chip) lifts that edge + label and dims the rest so
 * the user can tell which label belongs to which edge.
 *
 * Kept in its own micro-store — outside `useEditorStore` — so pointer noise never invalidates
 * graph-data selectors or competes with undo history.
 */
type EdgeHoverState = {
  hoveredEdgeId: string | null
  setHoveredEdge: (id: string | null) => void
}

export const useEdgeHover = create<EdgeHoverState>((set) => ({
  hoveredEdgeId: null,
  setHoveredEdge: (id) => set({ hoveredEdgeId: id })
}))
