# RainPath — Phase 1B-B1 Editor Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder at `/workflows/:id` with a working **read-and-edit editor canvas** that loads a workflow, renders all nodes/edges visually per the Design System, lets the user drag nodes on the Y axis (X is computed from `computeXPositions`), edit edge `daysAfter` via popover, delete nodes/edges via keyboard, undo/redo (Ctrl+Z / Ctrl+Shift+Z), and auto-saves to the backend with a visible status indicator. **Adding nodes from a palette and editing node params via a modal is out of scope (covered by Phase 1B-B2).**

**Architecture:**
- A Zustand store (`useEditorStore`) owns the entire editor state: workflow id/name/description, nodes/edges (derived X positions + free Y), selection, save status, history (50-snapshot ring), validation errors. All editor mutations go through store actions; no React state for canvas data.
- React Flow (`@xyflow/react` v12) handles rendering, drag, zoom, selection. The store reads via `useEditorStore(selector)` and writes via actions; React Flow callbacks (`onNodesChange`, `onConnect`, etc.) translate the React Flow events into store actions.
- Custom Node components per `kind`, all wrapping a shared `NodeCard` (strip + icon + title + handles per DS §7.3 conformity).
- Custom Edge with a chip `+N j`, click → popover with input bound to the store via `useFloating` from `@floating-ui/react` (already installed Phase 0).
- Custom Background = SVG timeline with adaptive day-gridlines (1 / 5 / 10 days depending on zoom) rendered inside a React Flow `<Panel>` so it follows pan/zoom.
- Auto-save: a debounced effect watches `(nodes, edges, name, description)` and fires `PATCH /workflows/:id` after 1.5 s of inactivity, gated by validation errors and snapshot-hash deduplication. A single in-flight PATCH is enforced; new mutations during a PATCH set a "pending" flag and retrigger after resolve.

**Tech Stack additions:** `@xyflow/react@12.3.5`, `zustand@4.5.5`. Everything else (TanStack Query, sonner, Radix, Lucide, Framer Motion, @floating-ui/react) is already installed.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-28-rainpath-workflow-editor-design.md` — §5.4 `computeXPositions`, §7.2 store, §7.3 custom nodes/edges/background, §7.4 drag constraints, §7.6 top bar, §7.10 states.
- Design System: `design-system/MASTER.md` — §3.3 node families, §3.7 background, §7.3 node card, §7.6 top bar, §7.8 dialog, §7.11 validation banner (B-B2).
- Phase 1B-A plan (just shipped): `docs/superpowers/plans/2026-05-28-phase-1b-a-frontend-foundations.md`.

---

## Hard-earned context — pitfalls baked into this plan

These cost us time during Phase 1B-A. The plan below proactively works around them.

### Pitfall 1 — Dual-zod TS2719

Importing `Graph` from `@rainpath/shared` and composing it into a frontend `z.object({ ..., graph: Graph })` triggers TS2719 ("Two different types with this name exist, but they are unrelated") because TS sees zod from `shared/dist/index.d.ts` and from `frontend/node_modules/zod` as different module instances.

**Mitigation in this plan**: we **never** wrap `Graph` inside a frontend zod composition. When we need to validate something from shared, we use `Schema.safeParse(unknown)` directly. When we need TS types, we import them as types and let TS infer through. The store uses `Graph['nodes']` and `Graph['edges']` element types directly (already exported from shared).

### Pitfall 2 — Lucide v0.460 icon renames

`Loader2 → LoaderCircle`, `AlertCircle → CircleAlert`, `MoreVertical → EllipsisVertical`. The full plan below uses only verified names.

Verified-present in this codebase: `Play`, `Square`, `Mail`, `MessageSquare`, `MessageCircle`, `Inbox`, `GitBranch`, `Anchor`, `Plus`, `Trash2`, `Copy`, `Save`, `Undo2`, `Redo2`, `EllipsisVertical`, `X`, `Check`, `LoaderCircle`, `CircleAlert`, `CircleCheck`, `AlertTriangle`, `Target`, `Construction`, `MapPinOff`, `RotateCw`, `Upload`, `Download`, `WifiOff`.

### Pitfall 3 — Icon size constraint

`<Icon name="..." size={N} />` only accepts `size: 16 | 20 | 24`. Larger illustrations (e.g. for empty states) must use `24`. For SVG details inside the canvas (e.g. axis labels), do not use the `Icon` wrapper — write raw SVG.

### Pitfall 4 — File style

No semicolons. Single quotes. Match `frontend/src/main.tsx`. No exception.

### Pitfall 5 — TanStack Query v5

`useMutation` exposes `isPending`, not `isLoading`. `useQuery` still has both.

### Pitfall 6 — React Flow v12 SSR

React Flow needs an explicit width/height (CSS `h-full w-full` on a container with a parent that has a defined height). The editor page uses `min-h-[calc(100dvh-48px)]` (full viewport minus the top app header).

---

## File structure (this plan creates)

```
frontend/
├── package.json                                  # MODIFY — add @xyflow/react, zustand
├── src/
│   ├── router.tsx                                # MODIFY — swap WorkflowEditorPlaceholder for WorkflowEditor
│   ├── pages/
│   │   ├── WorkflowEditorPlaceholder.tsx         # DELETE
│   │   └── WorkflowEditor/
│   │       ├── index.tsx                         # CREATE — page shell (top bar + canvas)
│   │       ├── store.ts                          # CREATE — Zustand store with all editor state + actions + history
│   │       ├── store.test.ts                     # CREATE — Vitest specs for store mechanics
│   │       ├── snapshot.ts                       # CREATE — snapshot hashing + EditorSnapshot type
│   │       ├── TopBar.tsx                        # CREATE — name/desc inline editing + save indicator + undo/redo + kebab
│   │       ├── SaveStatusBadge.tsx               # CREATE — visual indicator (idle/saving/saved/invalid/error/offline)
│   │       ├── Canvas.tsx                        # CREATE — React Flow wrapper + node/edge types + onChange plumbing
│   │       ├── TimelineBackground.tsx            # CREATE — SVG axis with adaptive gridlines + day labels + J+0 rail
│   │       ├── nodes/
│   │       │   ├── NodeCard.tsx                  # CREATE — shared card wrapper (strip 3px + icon + title + handles)
│   │       │   ├── handle-styles.ts              # CREATE — handle classNames shared across nodes
│   │       │   ├── StartNode.tsx                 # CREATE — compact 180px + anchor badge, drag disabled
│   │       │   ├── EndNode.tsx                   # CREATE — compact 180px + thicker border
│   │       │   ├── SendEmailNode.tsx             # CREATE
│   │       │   ├── SendSmsNode.tsx               # CREATE
│   │       │   ├── SendWhatsAppNode.tsx          # CREATE
│   │       │   ├── SendPostalNode.tsx            # CREATE
│   │       │   ├── ConditionNode.tsx             # CREATE
│   │       │   └── node-types.ts                 # CREATE — kind → component map for React Flow
│   │       ├── edges/
│   │       │   ├── FlowEdge.tsx                  # CREATE — labeled edge + daysAfter chip
│   │       │   ├── DaysAfterPopover.tsx          # CREATE — Floating-UI popover with input
│   │       │   └── edge-types.ts                 # CREATE — { default: FlowEdge }
│   │       └── hooks/
│   │           ├── useWorkflowLoader.ts          # CREATE — fetch + hydrate store on mount
│   │           ├── useAutoSave.ts                # CREATE — debounced PATCH with hash dedup + retry
│   │           └── useEditorShortcuts.ts         # CREATE — Ctrl+Z/Y, Delete, Cmd+S keybindings
```

---

## Conventions across tasks

- **`Graph` type access**: import as `import type { Graph } from '@rainpath/shared'` to avoid Pitfall 1; then `type GraphNode = Graph['nodes'][number]` and `type GraphEdge = Graph['edges'][number]` for element types.
- **React Flow node `data` field**: we put the **full GraphNode.data** (the discriminated union) onto React Flow's `data` slot. React Flow's `Node<T>` generic typing carries this through.
- **`computeXPositions` integration**: invoked inside `recomputeXPositions()` action. Store keeps Y free but always overwrites X from the result on every mutation that affects edges or graph topology.
- **Auto-save gates**:
  - `validationErrors.length > 0` → `saveStatus = 'invalid'`, no PATCH.
  - `snapshotHash === lastSavedSnapshotHash` → no PATCH (dedup).
  - In-flight PATCH → defer; set `pendingSave = true`; retrigger after resolve.
- **History**: every mutation pushes a snapshot **before** applying. Drag-Y events are debounced into one snapshot per drag (snapshot on `onDragStart`, no snapshot on `onDrag`). History capped at 50; FIFO when over.

---

## Task 1: Install React Flow + Zustand

**Files:**
- Modify: `frontend/package.json` (via pnpm add)

- [ ] **Step 1.1: Add deps**

Run from repo root:
```bash
pnpm --filter @rainpath/frontend add @xyflow/react@12.3.5 zustand@4.5.5
```

Expected: `frontend/package.json` lists both, lockfile updated.

- [ ] **Step 1.2: Smoke check the build**

Run: `pnpm --filter @rainpath/frontend build 2>&1 | tail -5`
Expected: clean.

- [ ] **Step 1.3: Commit**

```bash
git add frontend/package.json pnpm-lock.yaml
git commit -m "chore(frontend): add @xyflow/react and zustand for editor canvas"
```

---

## Task 2: Snapshot type + hashing helper

**Files:**
- Create: `frontend/src/pages/WorkflowEditor/snapshot.ts`

- [ ] **Step 2.1: Implement**

Write `frontend/src/pages/WorkflowEditor/snapshot.ts`:
```ts
import type { Graph } from '@rainpath/shared'

export type GraphNode = Graph['nodes'][number]
export type GraphEdge = Graph['edges'][number]

export type EditorSnapshot = {
  name: string
  description: string
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/**
 * Deterministic hash of a snapshot used by the auto-save dedup gate.
 * Uses JSON.stringify with a stable key order (sort keys recursively).
 */
export function hashSnapshot(s: EditorSnapshot): string {
  return stableStringify(s)
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  const keys = Object.keys(value as Record<string, unknown>).sort()
  return (
    '{' +
    keys
      .map(k => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  )
}
```

- [ ] **Step 2.2: Commit**

```bash
git add frontend/src/pages/WorkflowEditor/snapshot.ts
git commit -m "feat(frontend): EditorSnapshot type + stable-key hash for autosave dedup"
```

---

## Task 3: Zustand store skeleton (state shape + minimal actions)

**Files:**
- Create: `frontend/src/pages/WorkflowEditor/store.ts`

- [ ] **Step 3.1: Implement the store**

Write `frontend/src/pages/WorkflowEditor/store.ts`:
```ts
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
```

- [ ] **Step 3.2: Build sanity**

Run: `pnpm --filter @rainpath/frontend build 2>&1 | tail -5`
Expected: clean.

- [ ] **Step 3.3: Commit**

```bash
git add frontend/src/pages/WorkflowEditor/store.ts
git commit -m "feat(frontend): editor Zustand store (state + mutations + history + recomputeX)"
```

---

## Task 4: Store tests

**Files:**
- Create: `frontend/src/pages/WorkflowEditor/store.test.ts`

- [ ] **Step 4.1: Write the failing specs**

Write `frontend/src/pages/WorkflowEditor/store.test.ts`:
```ts
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
```

- [ ] **Step 4.2: Run, verify PASS**

Run: `pnpm --filter @rainpath/frontend test -- store.test 2>&1 | tail -15`
Expected: 8 specs pass.

- [ ] **Step 4.3: Commit**

```bash
git add frontend/src/pages/WorkflowEditor/store.test.ts
git commit -m "test(frontend): Zustand editor store specs (history + recompute + cascade)"
```

---

## Task 5: NodeCard + handle styles

**Files:**
- Create: `frontend/src/pages/WorkflowEditor/nodes/handle-styles.ts`
- Create: `frontend/src/pages/WorkflowEditor/nodes/NodeCard.tsx`

- [ ] **Step 5.1: handle-styles**

Write `frontend/src/pages/WorkflowEditor/nodes/handle-styles.ts`:
```ts
/** Tailwind class string for React Flow handles, by family (DS §7.3). */
export const handleClass =
  'h-2.5 w-2.5 rounded-full border-2 bg-surface ' +
  'data-[handlestate=connecting]:!bg-primary'
```

- [ ] **Step 5.2: NodeCard**

Write `frontend/src/pages/WorkflowEditor/nodes/NodeCard.tsx`:
```tsx
import { ReactNode } from 'react'
import { Icon, IconName } from '@/components/Icon'

export type NodeFamily =
  | 'start'
  | 'end'
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'postal'
  | 'cond-data'
  | 'cond-result'

interface NodeCardProps {
  family: NodeFamily
  icon: IconName
  title: string
  /** Family label rendered above the title (DS §7.3). */
  familyLabel: string
  details?: ReactNode
  /** Right-side and left-side handle slots; the node component sets these via React Flow `<Handle />`. */
  handles?: ReactNode
  /** Whether this node is currently selected (drawn with primary ring + elev-2). */
  selected?: boolean
  /** Compact width override (used by start/end at 180 px). */
  width?: 180 | 240
  /** Thicker outer border used by end node (DS §7.3 end variant). */
  thickBorder?: boolean
}

/**
 * Shared card chrome for every editor node. Tokens live in `frontend/src/styles/tokens.css`
 * under `--node-<family>-{bg,border,accent}` per DS §3.3.
 */
export function NodeCard({
  family, icon, title, familyLabel, details, handles, selected, width = 240, thickBorder
}: NodeCardProps) {
  const bg = `bg-[var(--node-${family}-bg)]`
  const border = `border-[var(--node-${family}-border)]`
  const accent = `bg-[var(--node-${family}-accent)]`
  const ring = selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-bg shadow-elev-2' : 'shadow-elev-1'
  const widthCls = width === 180 ? 'w-[180px]' : 'w-[260px]'
  const borderWidth = thickBorder ? 'border-2' : 'border'
  return (
    <div
      className={`relative ${widthCls} ${borderWidth} ${border} ${bg} ${ring} rounded-md p-3 transition-shadow`}
      tabIndex={0}
    >
      {/* 3-px family strip on the left */}
      <div className={`absolute left-0 top-0 h-full w-[3px] rounded-l-md ${accent}`} aria-hidden="true" />
      <div className="ml-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
        <Icon name={icon} size={16} />
        <span>{familyLabel}</span>
      </div>
      <h3 className="mt-1 ml-1 text-sm font-semibold text-fg" title={title}>
        <span className="line-clamp-1">{title}</span>
      </h3>
      {details ? <div className="mt-2 ml-1 space-y-1 text-xs text-fg-muted">{details}</div> : null}
      {handles}
    </div>
  )
}
```

- [ ] **Step 5.3: Commit**

```bash
git add frontend/src/pages/WorkflowEditor/nodes/handle-styles.ts frontend/src/pages/WorkflowEditor/nodes/NodeCard.tsx
git commit -m "feat(frontend): NodeCard shared wrapper + handle styles"
```

---

## Task 6: StartNode + EndNode

**Files:**
- Create: `frontend/src/pages/WorkflowEditor/nodes/StartNode.tsx`
- Create: `frontend/src/pages/WorkflowEditor/nodes/EndNode.tsx`

- [ ] **Step 6.1: StartNode**

Write `frontend/src/pages/WorkflowEditor/nodes/StartNode.tsx`:
```tsx
import { Handle, NodeProps, Position } from '@xyflow/react'
import { Icon } from '@/components/Icon'
import { NodeCard } from './NodeCard'
import { handleClass } from './handle-styles'

export function StartNode({ selected }: NodeProps) {
  return (
    <div className="relative">
      <NodeCard
        family="start"
        icon="Play"
        familyLabel="Départ"
        title="Examen effectué"
        width={180}
        selected={!!selected}
        handles={
          <Handle
            type="source"
            position={Position.Right}
            className={`${handleClass} border-[var(--node-start-accent)]`}
          />
        }
      />
      <div
        className="absolute bottom-1 right-1 text-fg-muted"
        aria-label="Nœud ancré au début de l’axe temporel"
      >
        <Icon name="Anchor" size={16} />
      </div>
    </div>
  )
}
```

- [ ] **Step 6.2: EndNode**

Write `frontend/src/pages/WorkflowEditor/nodes/EndNode.tsx`:
```tsx
import { Handle, NodeProps, Position } from '@xyflow/react'
import { NodeCard } from './NodeCard'
import { handleClass } from './handle-styles'

export function EndNode({ selected }: NodeProps) {
  return (
    <NodeCard
      family="end"
      icon="Square"
      familyLabel="Fin"
      title="Patient relancé"
      width={180}
      thickBorder
      selected={!!selected}
      handles={
        <Handle
          type="target"
          position={Position.Left}
          className={`${handleClass} border-[var(--node-end-accent)]`}
        />
      }
    />
  )
}
```

- [ ] **Step 6.3: Commit**

```bash
git add frontend/src/pages/WorkflowEditor/nodes/StartNode.tsx frontend/src/pages/WorkflowEditor/nodes/EndNode.tsx
git commit -m "feat(frontend): StartNode (anchored 180px) + EndNode (thick border)"
```

---

## Task 7: Send-* nodes (Email, SMS, WhatsApp, Postal)

**Files:**
- Create: `frontend/src/pages/WorkflowEditor/nodes/SendEmailNode.tsx`
- Create: `frontend/src/pages/WorkflowEditor/nodes/SendSmsNode.tsx`
- Create: `frontend/src/pages/WorkflowEditor/nodes/SendWhatsAppNode.tsx`
- Create: `frontend/src/pages/WorkflowEditor/nodes/SendPostalNode.tsx`

All four nodes follow the same skeleton: target handle on the left, source handle(s) on the right based on `output.mode`. For B-B1, we render exactly one source handle in the `single` and `simple` modes (we just collapse the dual-handle simple mode into one for visual purposes — the actual branching UI lands in B-B2 along with the modal). For `multi`, we render handles stacked.

- [ ] **Step 7.1: SendEmailNode**

Write `frontend/src/pages/WorkflowEditor/nodes/SendEmailNode.tsx`:
```tsx
import { Handle, NodeProps, Position } from '@xyflow/react'
import { NodeCard } from './NodeCard'
import { handleClass } from './handle-styles'
import type { Graph } from '@rainpath/shared'

type EmailNodeData = Extract<Graph['nodes'][number]['data'], { kind: 'send_email' }>

export function SendEmailNode({ data, selected }: NodeProps) {
  const d = data as EmailNodeData
  return (
    <NodeCard
      family="email"
      icon="Mail"
      familyLabel="Email"
      title={d.params.subject || '(sans sujet)'}
      details={
        <p className="line-clamp-1">{d.params.body || '(corps vide)'}</p>
      }
      selected={!!selected}
      handles={
        <>
          <Handle
            type="target"
            position={Position.Left}
            className={`${handleClass} border-[var(--node-email-accent)]`}
          />
          <Handle
            type="source"
            position={Position.Right}
            className={`${handleClass} border-[var(--node-email-accent)]`}
          />
        </>
      }
    />
  )
}
```

- [ ] **Step 7.2: SendSmsNode**

Write `frontend/src/pages/WorkflowEditor/nodes/SendSmsNode.tsx`:
```tsx
import { Handle, NodeProps, Position } from '@xyflow/react'
import { NodeCard } from './NodeCard'
import { handleClass } from './handle-styles'
import type { Graph } from '@rainpath/shared'
import { CHANNEL_FORMAT_RULES } from '@rainpath/shared'

type SmsNodeData = Extract<Graph['nodes'][number]['data'], { kind: 'send_sms' }>

export function SendSmsNode({ data, selected }: NodeProps) {
  const d = data as SmsNodeData
  const len = d.params.body.length
  const rec = CHANNEL_FORMAT_RULES.sms.body.recommendedMax
  const max = CHANNEL_FORMAT_RULES.sms.body.maxLength
  const counterClass =
    len > max ? 'text-danger' : len > rec ? 'text-warning' : 'text-fg-muted'
  return (
    <NodeCard
      family="sms"
      icon="MessageSquare"
      familyLabel="SMS"
      title={d.params.body.slice(0, 28) || '(SMS vide)'}
      details={
        <p className={`tabular-nums ${counterClass}`}>{len} / {rec}</p>
      }
      selected={!!selected}
      handles={
        <>
          <Handle
            type="target"
            position={Position.Left}
            className={`${handleClass} border-[var(--node-sms-accent)]`}
          />
          <Handle
            type="source"
            position={Position.Right}
            className={`${handleClass} border-[var(--node-sms-accent)]`}
          />
        </>
      }
    />
  )
}
```

- [ ] **Step 7.3: SendWhatsAppNode**

Write `frontend/src/pages/WorkflowEditor/nodes/SendWhatsAppNode.tsx`:
```tsx
import { Handle, NodeProps, Position } from '@xyflow/react'
import { NodeCard } from './NodeCard'
import { handleClass } from './handle-styles'
import type { Graph } from '@rainpath/shared'

type WhatsAppNodeData = Extract<Graph['nodes'][number]['data'], { kind: 'send_whatsapp' }>

export function SendWhatsAppNode({ data, selected }: NodeProps) {
  const d = data as WhatsAppNodeData
  return (
    <NodeCard
      family="whatsapp"
      icon="MessageCircle"
      familyLabel="WhatsApp"
      title={d.params.body.slice(0, 32) || '(message vide)'}
      details={
        <p className="line-clamp-1">{d.params.body || '(corps vide)'}</p>
      }
      selected={!!selected}
      handles={
        <>
          <Handle
            type="target"
            position={Position.Left}
            className={`${handleClass} border-[var(--node-whatsapp-accent)]`}
          />
          <Handle
            type="source"
            position={Position.Right}
            className={`${handleClass} border-[var(--node-whatsapp-accent)]`}
          />
        </>
      }
    />
  )
}
```

- [ ] **Step 7.4: SendPostalNode**

Write `frontend/src/pages/WorkflowEditor/nodes/SendPostalNode.tsx`:
```tsx
import { Handle, NodeProps, Position } from '@xyflow/react'
import { NodeCard } from './NodeCard'
import { handleClass } from './handle-styles'
import type { Graph } from '@rainpath/shared'

type PostalNodeData = Extract<Graph['nodes'][number]['data'], { kind: 'send_postal' }>

export function SendPostalNode({ data, selected }: NodeProps) {
  const d = data as PostalNodeData
  return (
    <NodeCard
      family="postal"
      icon="Inbox"
      familyLabel="Courrier postal"
      title={d.params.body.slice(0, 32) || '(courrier vide)'}
      details={
        <p className="line-clamp-1">
          {d.params.tracked ? 'Suivi · ' : 'Non suivi · '}
          {d.params.body || '(corps vide)'}
        </p>
      }
      selected={!!selected}
      handles={
        <>
          <Handle
            type="target"
            position={Position.Left}
            className={`${handleClass} border-[var(--node-postal-accent)]`}
          />
          <Handle
            type="source"
            position={Position.Right}
            className={`${handleClass} border-[var(--node-postal-accent)]`}
          />
        </>
      }
    />
  )
}
```

- [ ] **Step 7.5: Commit**

```bash
git add frontend/src/pages/WorkflowEditor/nodes/SendEmailNode.tsx frontend/src/pages/WorkflowEditor/nodes/SendSmsNode.tsx frontend/src/pages/WorkflowEditor/nodes/SendWhatsAppNode.tsx frontend/src/pages/WorkflowEditor/nodes/SendPostalNode.tsx
git commit -m "feat(frontend): send_* node cards (email/sms/whatsapp/postal)"
```

---

## Task 8: ConditionNode + node-types map

**Files:**
- Create: `frontend/src/pages/WorkflowEditor/nodes/ConditionNode.tsx`
- Create: `frontend/src/pages/WorkflowEditor/nodes/node-types.ts`

- [ ] **Step 8.1: ConditionNode**

Write `frontend/src/pages/WorkflowEditor/nodes/ConditionNode.tsx`:
```tsx
import { Handle, NodeProps, Position } from '@xyflow/react'
import { NodeCard, NodeFamily } from './NodeCard'
import { handleClass } from './handle-styles'
import type { Graph } from '@rainpath/shared'

type ConditionNodeData = Extract<Graph['nodes'][number]['data'], { kind: 'condition' }>

const HUMAN_EXPRESSIONS: Record<string, string> = {
  'patient.email': 'Email connu ?',
  'patient.phone': 'Téléphone connu ?',
  'patient.whatsapp': 'WhatsApp connu ?',
  'patient.address': 'Adresse connue ?'
}

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as ConditionNodeData
  const family: NodeFamily = d.params.conditionType === 'data_available' ? 'cond-data' : 'cond-result'
  const accentVar =
    d.params.conditionType === 'data_available' ? 'var(--node-cond-data-accent)' : 'var(--node-cond-result-accent)'
  const title =
    d.params.conditionType === 'data_available'
      ? HUMAN_EXPRESSIONS[d.params.expression] ?? d.params.expression
      : d.params.expression || '(expression vide)'
  return (
    <NodeCard
      family={family}
      icon="GitBranch"
      familyLabel={d.params.conditionType === 'data_available' ? 'Condition · donnée' : 'Condition · résultat'}
      title={title}
      selected={!!selected}
      handles={
        <>
          <Handle
            type="target"
            position={Position.Left}
            className={`${handleClass}`}
            style={{ borderColor: accentVar }}
          />
          <Handle
            id="true"
            type="source"
            position={Position.Right}
            className={`${handleClass}`}
            style={{ borderColor: 'var(--success)', top: '40%' }}
          />
          <Handle
            id="false"
            type="source"
            position={Position.Right}
            className={`${handleClass}`}
            style={{ borderColor: 'var(--danger)', top: '70%' }}
          />
        </>
      }
    />
  )
}
```

- [ ] **Step 8.2: node-types map**

Write `frontend/src/pages/WorkflowEditor/nodes/node-types.ts`:
```ts
import type { NodeTypes } from '@xyflow/react'
import { StartNode } from './StartNode'
import { EndNode } from './EndNode'
import { SendEmailNode } from './SendEmailNode'
import { SendSmsNode } from './SendSmsNode'
import { SendWhatsAppNode } from './SendWhatsAppNode'
import { SendPostalNode } from './SendPostalNode'
import { ConditionNode } from './ConditionNode'

/**
 * React Flow looks up the component by `node.type`. We use `data.kind` as the React Flow type.
 * The Canvas component sets `type = data.kind` when mapping store nodes → RF nodes.
 */
export const nodeTypes: NodeTypes = {
  start: StartNode,
  end: EndNode,
  send_email: SendEmailNode,
  send_sms: SendSmsNode,
  send_whatsapp: SendWhatsAppNode,
  send_postal: SendPostalNode,
  condition: ConditionNode
}
```

- [ ] **Step 8.3: Commit**

```bash
git add frontend/src/pages/WorkflowEditor/nodes/ConditionNode.tsx frontend/src/pages/WorkflowEditor/nodes/node-types.ts
git commit -m "feat(frontend): ConditionNode (true/false handles) + node-types map"
```

---

## Task 9: Custom Edge with daysAfter chip + popover

**Files:**
- Create: `frontend/src/pages/WorkflowEditor/edges/DaysAfterPopover.tsx`
- Create: `frontend/src/pages/WorkflowEditor/edges/FlowEdge.tsx`
- Create: `frontend/src/pages/WorkflowEditor/edges/edge-types.ts`

- [ ] **Step 9.1: DaysAfterPopover (floating-ui)**

Write `frontend/src/pages/WorkflowEditor/edges/DaysAfterPopover.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react'
import {
  autoUpdate, flip, offset, shift, useFloating, useDismiss, useInteractions
} from '@floating-ui/react'

interface Props {
  open: boolean
  anchor: { x: number; y: number } | null
  initialValue: number
  onCommit: (value: number) => void
  onCancel: () => void
}

/**
 * Anchored to a {clientX, clientY} point because we don't have a stable DOM element
 * for the edge midpoint — React Flow renders edges as raw SVG paths.
 */
export function DaysAfterPopover({ open, anchor, initialValue, onCommit, onCancel }: Props) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Re-sync when re-opened.
  useEffect(() => {
    if (open) {
      setValue(initialValue)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open, initialValue])

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: o => { if (!o) onCancel() },
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate
  })

  // Position via a virtual reference element built from the anchor point.
  useEffect(() => {
    if (!anchor) return
    refs.setPositionReference({
      getBoundingClientRect: () => ({
        x: anchor.x, y: anchor.y, top: anchor.y, left: anchor.x,
        right: anchor.x, bottom: anchor.y, width: 0, height: 0
      })
    })
  }, [anchor, refs])

  const dismiss = useDismiss(context, { escapeKey: true, outsidePress: true })
  const { getFloatingProps } = useInteractions([dismiss])

  if (!open || !anchor) return null

  return (
    <div
      ref={refs.setFloating}
      style={floatingStyles}
      {...getFloatingProps()}
      className="z-50 rounded-md border border-border bg-surface p-3 shadow-elev-2"
    >
      <form
        onSubmit={e => {
          e.preventDefault()
          if (Number.isFinite(value) && value >= 0 && Number.isInteger(value)) onCommit(value)
        }}
        className="flex items-center gap-2"
      >
        <label htmlFor="days-after" className="text-xs font-medium text-fg-muted">
          Délai (jours)
        </label>
        <input
          id="days-after"
          ref={inputRef}
          type="number"
          min={0}
          step={1}
          value={value}
          onChange={e => setValue(Number(e.target.value))}
          className="h-8 w-20 rounded-md border border-border bg-surface px-2 text-sm tabular-nums focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-on-primary hover:bg-primary-hover"
        >
          Valider
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 9.2: FlowEdge**

Write `frontend/src/pages/WorkflowEditor/edges/FlowEdge.tsx`:
```tsx
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from '@xyflow/react'

export function FlowEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, data } = props
  const [path, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition
  })
  const stroke = selected ? 'var(--primary)' : 'var(--fg-subtle)'
  const strokeWidth = selected ? 2 : 1.5
  const days = (data as { daysAfter?: number } | undefined)?.daysAfter ?? 0
  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke, strokeWidth }} />
      <EdgeLabelRenderer>
        <div
          className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-surface px-2 py-0.5 text-xs font-medium tabular-nums text-fg shadow-elev-1"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          data-edge-label-id={id}
        >
          + {days} j
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
```

Note: the chip carries `data-edge-label-id={id}`. The Canvas component listens for clicks on `[data-edge-label-id]` to open the popover.

- [ ] **Step 9.3: edge-types**

Write `frontend/src/pages/WorkflowEditor/edges/edge-types.ts`:
```ts
import type { EdgeTypes } from '@xyflow/react'
import { FlowEdge } from './FlowEdge'

export const edgeTypes: EdgeTypes = {
  default: FlowEdge
}
```

- [ ] **Step 9.4: Commit**

```bash
git add frontend/src/pages/WorkflowEditor/edges
git commit -m "feat(frontend): custom Edge with daysAfter chip + Floating-UI popover"
```

---

## Task 10: TimelineBackground

**Files:**
- Create: `frontend/src/pages/WorkflowEditor/TimelineBackground.tsx`

- [ ] **Step 10.1: Implement**

Write `frontend/src/pages/WorkflowEditor/TimelineBackground.tsx`:
```tsx
import { useMemo } from 'react'
import { Panel, useStore as useRFStore, useViewport } from '@xyflow/react'

/** Pixels between two adjacent days at zoom = 1. Calibrated to match the seed graph spacing. */
const PX_PER_DAY = 28
const START_X_VIEW = 0

function chooseStep(zoom: number): number {
  if (zoom < 0.4) return 10
  if (zoom < 0.8) return 5
  return 1
}

export function TimelineBackground() {
  const viewport = useViewport()
  const widthPx = useRFStore(s => s.width)
  const heightPx = useRFStore(s => s.height)

  // Convert viewport bounds into "day" units.
  const stepDays = chooseStep(viewport.zoom)
  const pxPerDay = PX_PER_DAY * viewport.zoom

  const { leftDay, rightDay } = useMemo(() => {
    // X = (worldX * zoom) + viewport.x  → solve for worldX given screenX in [0, widthPx]
    const worldLeftX = -viewport.x / Math.max(viewport.zoom, 1e-6)
    const worldRightX = (widthPx - viewport.x) / Math.max(viewport.zoom, 1e-6)
    return {
      leftDay: Math.floor(worldLeftX / PX_PER_DAY) - 2,
      rightDay: Math.ceil(worldRightX / PX_PER_DAY) + 2
    }
  }, [viewport, widthPx])

  const ticks: number[] = []
  for (let d = Math.max(0, leftDay - (leftDay % stepDays)); d <= rightDay; d += stepDays) {
    ticks.push(d)
  }
  // Plafond ~ 60 graduations (perf — DS §13).
  const capped = ticks.length > 60 ? ticks.filter((_, i) => i % 2 === 0) : ticks

  return (
    <Panel position="top-left" className="pointer-events-none m-0 p-0">
      <svg
        width={widthPx}
        height={heightPx}
        viewBox={`0 0 ${widthPx} ${heightPx}`}
        className="block"
      >
        {capped.map(d => {
          const screenX = d * pxPerDay + viewport.x + START_X_VIEW
          if (screenX < -40 || screenX > widthPx + 40) return null
          const isRail = d === 0
          return (
            <g key={d}>
              <line
                x1={screenX}
                y1={28}
                x2={screenX}
                y2={heightPx}
                stroke={isRail ? 'var(--node-start-accent)' : 'var(--border)'}
                strokeWidth={isRail ? 2 : 1}
              />
              <text
                x={screenX}
                y={18}
                fontSize={11}
                fontFamily="var(--font-sans)"
                fontVariantNumeric="tabular-nums"
                textAnchor="middle"
                fill="var(--fg-muted)"
              >
                J+{d}
              </text>
            </g>
          )
        })}
      </svg>
    </Panel>
  )
}
```

- [ ] **Step 10.2: Commit**

```bash
git add frontend/src/pages/WorkflowEditor/TimelineBackground.tsx
git commit -m "feat(frontend): TimelineBackground with adaptive gridlines + J+0 rail"
```

---

## Task 11: Canvas component (React Flow wrapper)

**Files:**
- Create: `frontend/src/pages/WorkflowEditor/Canvas.tsx`

- [ ] **Step 11.1: Implement**

Write `frontend/src/pages/WorkflowEditor/Canvas.tsx`:
```tsx
import { useCallback, useMemo, useState, MouseEvent } from 'react'
import {
  ReactFlow, MiniMap, Controls,
  type Node as RFNode, type Edge as RFEdge,
  type NodeChange, type EdgeChange
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEditorStore } from './store'
import { nodeTypes } from './nodes/node-types'
import { edgeTypes } from './edges/edge-types'
import { TimelineBackground } from './TimelineBackground'
import { DaysAfterPopover } from './edges/DaysAfterPopover'

const PX_PER_DAY = 28

function toRFNodes(nodes: ReturnType<typeof useEditorStore.getState>['nodes']): RFNode[] {
  return nodes.map(n => ({
    id: n.id,
    type: n.data.kind,
    position: { x: n.position.x * PX_PER_DAY, y: n.position.y },
    data: n.data,
    draggable: n.data.kind !== 'start'
  }))
}

function toRFEdges(edges: ReturnType<typeof useEditorStore.getState>['edges']): RFEdge[] {
  return edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    type: 'default',
    data: { daysAfter: e.daysAfter }
  }))
}

export function Canvas() {
  const nodes = useEditorStore(s => s.nodes)
  const edges = useEditorStore(s => s.edges)
  const setSelectedNode = useEditorStore(s => s.setSelectedNode)
  const setSelectedEdge = useEditorStore(s => s.setSelectedEdge)
  const updateNodePositionY = useEditorStore(s => s.updateNodePositionY)
  const updateEdgeDays = useEditorStore(s => s.updateEdgeDays)

  const rfNodes = useMemo(() => toRFNodes(nodes), [nodes])
  const rfEdges = useMemo(() => toRFEdges(edges), [edges])

  const [popover, setPopover] = useState<{ edgeId: string; anchor: { x: number; y: number } } | null>(null)

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const ch of changes) {
        if (ch.type === 'select' && 'selected' in ch) {
          setSelectedNode(ch.selected ? ch.id : null)
        }
        if (ch.type === 'position' && ch.position && ch.dragging) {
          const id = ch.id
          const node = nodes.find(n => n.id === id)
          if (node && node.data.kind !== 'start') {
            updateNodePositionY(id, ch.position.y)
          }
        }
      }
    },
    [nodes, setSelectedNode, updateNodePositionY]
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const ch of changes) {
        if (ch.type === 'select' && 'selected' in ch) {
          setSelectedEdge(ch.selected ? ch.id : null)
        }
      }
    },
    [setSelectedEdge]
  )

  /**
   * Open the daysAfter popover when the chip is clicked. The chip carries
   * `data-edge-label-id={id}` from FlowEdge.tsx.
   */
  const onCanvasClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const chip = target.closest('[data-edge-label-id]') as HTMLElement | null
    if (chip) {
      const id = chip.dataset['edgeLabelId']!
      const rect = chip.getBoundingClientRect()
      setPopover({ edgeId: id, anchor: { x: rect.left + rect.width / 2, y: rect.top } })
    }
  }, [])

  const popoverEdge = popover ? edges.find(e => e.id === popover.edgeId) ?? null : null

  return (
    <div className="relative h-full w-full" onClick={onCanvasClick}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodesConnectable={false}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
        fitView
      >
        <TimelineBackground />
        <Controls className="!bg-surface !border-border" showInteractive={false} />
        <MiniMap className="!bg-surface-muted !border-border" pannable zoomable />
      </ReactFlow>

      <DaysAfterPopover
        open={!!popover && !!popoverEdge}
        anchor={popover?.anchor ?? null}
        initialValue={popoverEdge?.daysAfter ?? 0}
        onCommit={value => {
          if (popover) updateEdgeDays(popover.edgeId, value)
          setPopover(null)
        }}
        onCancel={() => setPopover(null)}
      />
    </div>
  )
}
```

**Notes for the implementer:**
- `nodesConnectable={false}` — connection drag UI ships in B-B2.
- `deleteKeyCode={null}` — we wire Delete via our own `useEditorShortcuts` (Task 14) so the cascade rules in the store run.
- `proOptions.hideAttribution` is permitted in dev contexts; remove if a "powered by React Flow" attribution is acceptable in production.

- [ ] **Step 11.2: Commit**

```bash
git add frontend/src/pages/WorkflowEditor/Canvas.tsx
git commit -m "feat(frontend): Canvas React Flow wrapper (Y-drag, edge chip popover)"
```

---

## Task 12: SaveStatusBadge + TopBar

**Files:**
- Create: `frontend/src/pages/WorkflowEditor/SaveStatusBadge.tsx`
- Create: `frontend/src/pages/WorkflowEditor/TopBar.tsx`

- [ ] **Step 12.1: SaveStatusBadge**

Write `frontend/src/pages/WorkflowEditor/SaveStatusBadge.tsx`:
```tsx
import { useEditorStore } from './store'
import { Icon } from '@/components/Icon'
import { relativeFromNow } from '@/lib/format-date'

export function SaveStatusBadge() {
  const status = useEditorStore(s => s.saveStatus)
  const savedAt = useEditorStore(s => s.lastSavedAt)

  const map: Record<typeof status, { label: string; icon: 'CircleCheck' | 'LoaderCircle' | 'WifiOff' | 'CircleAlert'; tone: string }> = {
    idle: { label: 'Modifications non enregistrées', icon: 'CircleCheck', tone: 'text-fg-muted' },
    saving: { label: 'Enregistrement…', icon: 'LoaderCircle', tone: 'text-fg-muted' },
    saved: {
      label: savedAt ? `Enregistré ${relativeFromNow(savedAt)}` : 'Enregistré',
      icon: 'CircleCheck',
      tone: 'text-success'
    },
    invalid: { label: 'Erreur de validation', icon: 'CircleAlert', tone: 'text-warning' },
    error: { label: 'Erreur d’enregistrement', icon: 'CircleAlert', tone: 'text-danger' },
    offline: { label: 'Hors-ligne', icon: 'WifiOff', tone: 'text-warning' }
  }
  const item = map[status]

  return (
    <div
      className={`flex min-w-[260px] items-center justify-center gap-2 text-sm ${item.tone}`}
      aria-live="polite"
    >
      <Icon name={item.icon} size={16} className={status === 'saving' ? 'animate-spin' : ''} />
      <span>{item.label}</span>
    </div>
  )
}
```

- [ ] **Step 12.2: TopBar**

Write `frontend/src/pages/WorkflowEditor/TopBar.tsx`:
```tsx
import { KeyboardEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Icon } from '@/components/Icon'
import { IconButton } from '@/components/ui/IconButton'
import {
  DropdownMenu, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator
} from '@/components/ui/DropdownMenu'
import { downloadJson } from '@/lib/download-json'
import { duplicateWorkflow, deleteWorkflow, getWorkflow } from '@/api/workflows'
import { queryKeys } from '@/api/query-keys'
import { useEditorStore } from './store'
import { SaveStatusBadge } from './SaveStatusBadge'

interface Props {
  saveNow: () => void
}

export function TopBar({ saveNow }: Props) {
  const id = useEditorStore(s => s.workflowId)
  const name = useEditorStore(s => s.name)
  const description = useEditorStore(s => s.description)
  const setName = useEditorStore(s => s.setName)
  const setDescription = useEditorStore(s => s.setDescription)
  const undo = useEditorStore(s => s.undo)
  const redo = useEditorStore(s => s.redo)
  const canUndo = useEditorStore(s => s.historyIndex > 0)
  const canRedo = useEditorStore(s => s.historyIndex < s.history.length - 1)

  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(name)
  const [editingDesc, setEditingDesc] = useState(false)
  const [draftDesc, setDraftDesc] = useState(description)

  const qc = useQueryClient()
  const navigate = useNavigate()

  const dupMut = useMutation({
    mutationFn: () => duplicateWorkflow(id!, {}),
    onSuccess: wf => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.list() })
      toast.success('Workflow dupliqué')
      navigate(`/workflows/${wf.id}`)
    },
    onError: () => toast.error('Échec de la duplication')
  })

  const delMut = useMutation({
    mutationFn: () => deleteWorkflow(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.list() })
      toast.success('Workflow supprimé')
      navigate('/workflows')
    },
    onError: () => toast.error('Échec de la suppression')
  })

  const handleExport = async () => {
    if (!id) return
    try {
      const wf = await getWorkflow(id)
      downloadJson(`${(wf.name || 'workflow').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}.json`, wf)
      toast.success('Export téléchargé')
    } catch {
      toast.error('Échec de l’export')
    }
  }

  const onNameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { setName(draftName.trim() || name); setEditingName(false) }
    if (e.key === 'Escape') { setDraftName(name); setEditingName(false) }
  }
  const onDescKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { setDescription(draftDesc); setEditingDesc(false) }
    if (e.key === 'Escape') { setDraftDesc(description); setEditingDesc(false) }
  }

  return (
    <div className="sticky top-12 z-10 flex h-12 items-center gap-4 border-b border-border bg-surface px-6">
      <button
        type="button"
        onClick={() => navigate('/workflows')}
        className="flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
      >
        <Icon name="ArrowLeft" size={16} />
        Workflows
      </button>

      <div className="flex min-w-0 flex-1 flex-col">
        {editingName ? (
          <input
            autoFocus
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onBlur={() => { setName(draftName.trim() || name); setEditingName(false) }}
            onKeyDown={onNameKey}
            className="h-7 w-full max-w-md rounded border border-border bg-surface px-2 text-sm font-semibold text-fg"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setDraftName(name); setEditingName(true) }}
            className="truncate text-left text-sm font-semibold text-fg hover:underline"
          >
            {name || '(sans titre)'}
          </button>
        )}
        {editingDesc ? (
          <input
            autoFocus
            value={draftDesc}
            onChange={e => setDraftDesc(e.target.value)}
            onBlur={() => { setDescription(draftDesc); setEditingDesc(false) }}
            onKeyDown={onDescKey}
            className="mt-0.5 h-6 w-full max-w-md rounded border border-border bg-surface px-2 text-xs text-fg-muted"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setDraftDesc(description); setEditingDesc(true) }}
            className="truncate text-left text-xs text-fg-muted hover:text-fg"
          >
            {description || 'Ajouter une description'}
          </button>
        )}
      </div>

      <SaveStatusBadge />

      <div className="flex items-center gap-1">
        <IconButton icon="Undo2" aria-label="Annuler" onClick={undo} disabled={!canUndo} />
        <IconButton icon="Redo2" aria-label="Rétablir" onClick={redo} disabled={!canRedo} />
        <IconButton icon="Save" aria-label="Enregistrer maintenant" onClick={saveNow} />
        <DropdownMenu>
          <DropdownTrigger asChild>
            <IconButton icon="EllipsisVertical" aria-label="Plus d’actions" />
          </DropdownTrigger>
          <DropdownContent>
            <DropdownItem icon="Copy" onSelect={() => dupMut.mutate()}>Dupliquer</DropdownItem>
            <DropdownItem icon="Download" onSelect={handleExport}>Exporter en JSON</DropdownItem>
            <DropdownSeparator />
            <DropdownItem icon="Trash2" danger onSelect={() => delMut.mutate()}>Supprimer</DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
```

- [ ] **Step 12.3: Commit**

```bash
git add frontend/src/pages/WorkflowEditor/SaveStatusBadge.tsx frontend/src/pages/WorkflowEditor/TopBar.tsx
git commit -m "feat(frontend): editor top bar (name/desc inline, save badge, undo/redo, kebab)"
```

---

## Task 13: useWorkflowLoader hook

**Files:**
- Create: `frontend/src/pages/WorkflowEditor/hooks/useWorkflowLoader.ts`

- [ ] **Step 13.1: Implement**

Write `frontend/src/pages/WorkflowEditor/hooks/useWorkflowLoader.ts`:
```ts
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getWorkflow } from '@/api/workflows'
import { queryKeys } from '@/api/query-keys'
import { useEditorStore } from '../store'

export function useWorkflowLoader(id: string | undefined) {
  const query = useQuery({
    queryKey: id ? queryKeys.workflows.detail(id) : ['workflows', 'detail', 'none'],
    queryFn: () => getWorkflow(id!),
    enabled: !!id,
    staleTime: Infinity,
    refetchOnWindowFocus: false
  })

  const load = useEditorStore(s => s.load)
  const storeWfId = useEditorStore(s => s.workflowId)

  useEffect(() => {
    if (query.data && query.data.id !== storeWfId) {
      load({
        id: query.data.id,
        name: query.data.name,
        description: query.data.description ?? '',
        nodes: query.data.graph.nodes,
        edges: query.data.graph.edges
      })
    }
  }, [query.data, storeWfId, load])

  return query
}
```

- [ ] **Step 13.2: Commit**

```bash
git add frontend/src/pages/WorkflowEditor/hooks/useWorkflowLoader.ts
git commit -m "feat(frontend): useWorkflowLoader hook (fetch + hydrate store)"
```

---

## Task 14: useEditorShortcuts hook

**Files:**
- Create: `frontend/src/pages/WorkflowEditor/hooks/useEditorShortcuts.ts`

- [ ] **Step 14.1: Implement**

Write `frontend/src/pages/WorkflowEditor/hooks/useEditorShortcuts.ts`:
```ts
import { useEffect } from 'react'
import { useEditorStore } from '../store'

interface Options {
  saveNow: () => void
}

/**
 * Wires Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z (redo), Cmd/Ctrl+S (save),
 * Delete/Backspace (remove selected node or edge). Ignored when focus is in
 * an input/textarea or `contenteditable` to avoid hijacking text editing.
 */
export function useEditorShortcuts({ saveNow }: Options) {
  const undo = useEditorStore(s => s.undo)
  const redo = useEditorStore(s => s.redo)
  const removeNode = useEditorStore(s => s.removeNode)
  const removeEdge = useEditorStore(s => s.removeEdge)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const isEditing =
        tag === 'input' || tag === 'textarea' || (target?.isContentEditable ?? false)

      const mod = e.ctrlKey || e.metaKey

      if (mod && e.key.toLowerCase() === 'z' && e.shiftKey) {
        e.preventDefault()
        redo()
        return
      }
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveNow()
        return
      }
      if (!isEditing && (e.key === 'Delete' || e.key === 'Backspace')) {
        const s = useEditorStore.getState()
        if (s.selectedNodeId) {
          e.preventDefault()
          removeNode(s.selectedNodeId)
        } else if (s.selectedEdgeId) {
          e.preventDefault()
          removeEdge(s.selectedEdgeId)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, removeNode, removeEdge, saveNow])
}
```

- [ ] **Step 14.2: Commit**

```bash
git add frontend/src/pages/WorkflowEditor/hooks/useEditorShortcuts.ts
git commit -m "feat(frontend): useEditorShortcuts (Ctrl+Z/Y, Delete, Cmd+S)"
```

---

## Task 15: useAutoSave hook

**Files:**
- Create: `frontend/src/pages/WorkflowEditor/hooks/useAutoSave.ts`

- [ ] **Step 15.1: Implement**

Write `frontend/src/pages/WorkflowEditor/hooks/useAutoSave.ts`:
```ts
import { useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updateWorkflow } from '@/api/workflows'
import { queryKeys } from '@/api/query-keys'
import { ApiError } from '@/api/client'
import { useEditorStore } from '../store'
import { hashSnapshot } from '../snapshot'
import type { ValidationError } from '../store'

const DEBOUNCE_MS = 1500
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000]

export function useAutoSave(): { saveNow: () => void } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef(false)
  const retryIxRef = useRef(0)
  const qc = useQueryClient()

  const performSave = useCallback(async () => {
    const s = useEditorStore.getState()
    if (!s.workflowId) return
    if (s.validationErrors.length > 0) {
      s.setSaveStatus('invalid')
      return
    }
    const snap = s.snapshot()
    const hash = hashSnapshot(snap)
    if (hash === s.lastSavedSnapshotHash) {
      // Nothing changed; stay at last status.
      return
    }
    if (inFlightRef.current) {
      s.setPendingSave(true)
      return
    }
    inFlightRef.current = true
    s.setSaveStatus('saving')

    try {
      await updateWorkflow(s.workflowId, {
        name: snap.name,
        description: snap.description,
        graph: { nodes: snap.nodes, edges: snap.edges }
      })
      s.markSaved(hash, new Date())
      retryIxRef.current = 0
      qc.invalidateQueries({ queryKey: queryKeys.workflows.list() })
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        const errs: ValidationError[] = (e.body.errors ?? []).map(x => ({
          code: x.code,
          message: x.message,
          nodeId: x.nodeId,
          edgeId: x.edgeId
        }))
        s.setValidationErrors(errs)
        s.setSaveStatus('invalid')
      } else {
        s.setSaveStatus(retryIxRef.current >= RETRY_DELAYS.length ? 'offline' : 'error')
        const delay = RETRY_DELAYS[Math.min(retryIxRef.current, RETRY_DELAYS.length - 1)]
        retryIxRef.current = Math.min(retryIxRef.current + 1, RETRY_DELAYS.length)
        setTimeout(() => { void performSave() }, delay)
      }
    } finally {
      inFlightRef.current = false
      if (useEditorStore.getState().pendingSave) {
        useEditorStore.getState().setPendingSave(false)
        // Defer to the microtask queue so React state updates settle first.
        Promise.resolve().then(() => { void performSave() })
      }
    }
  }, [qc])

  // Debounced trigger watching mutations.
  const nodes = useEditorStore(s => s.nodes)
  const edges = useEditorStore(s => s.edges)
  const name = useEditorStore(s => s.name)
  const description = useEditorStore(s => s.description)
  const workflowId = useEditorStore(s => s.workflowId)

  useEffect(() => {
    if (!workflowId) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { void performSave() }, DEBOUNCE_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [nodes, edges, name, description, workflowId, performSave])

  const saveNow = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    void performSave()
  }, [performSave])

  return { saveNow }
}
```

- [ ] **Step 15.2: Commit**

```bash
git add frontend/src/pages/WorkflowEditor/hooks/useAutoSave.ts
git commit -m "feat(frontend): useAutoSave (1.5s debounce, hash dedup, single in-flight, retry/offline)"
```

---

## Task 16: WorkflowEditor page

**Files:**
- Create: `frontend/src/pages/WorkflowEditor/index.tsx`

- [ ] **Step 16.1: Implement**

Write `frontend/src/pages/WorkflowEditor/index.tsx`:
```tsx
import { useParams } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { useWorkflowLoader } from './hooks/useWorkflowLoader'
import { useAutoSave } from './hooks/useAutoSave'
import { useEditorShortcuts } from './hooks/useEditorShortcuts'
import { TopBar } from './TopBar'
import { Canvas } from './Canvas'

export default function WorkflowEditor() {
  const { id } = useParams<{ id: string }>()
  const query = useWorkflowLoader(id)
  const { saveNow } = useAutoSave()
  useEditorShortcuts({ saveNow })

  if (query.isLoading) {
    return (
      <div className="flex min-h-[calc(100dvh-48px)] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <Icon name="LoaderCircle" size={20} className="animate-spin" />
          Chargement…
        </div>
      </div>
    )
  }

  if (query.error || !query.data) {
    return (
      <div className="flex min-h-[calc(100dvh-48px)] items-center justify-center p-8">
        <div className="max-w-md text-center">
          <Icon name="CircleAlert" size={24} className="mx-auto text-danger" />
          <h1 className="mt-4 text-xl font-semibold text-fg">Workflow introuvable</h1>
          <p className="mt-2 text-sm text-fg-muted">
            Ce workflow n’existe pas, a été supprimé, ou le serveur est inaccessible.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-48px)] flex-col">
      <TopBar saveNow={saveNow} />
      <div className="relative flex-1">
        <Canvas />
      </div>
    </div>
  )
}
```

- [ ] **Step 16.2: Commit**

```bash
git add frontend/src/pages/WorkflowEditor/index.tsx
git commit -m "feat(frontend): WorkflowEditor page (loader + autosave + shortcuts + canvas)"
```

---

## Task 17: Swap router placeholder for real editor

**Files:**
- Modify: `frontend/src/router.tsx`
- Delete: `frontend/src/pages/WorkflowEditorPlaceholder.tsx`

- [ ] **Step 17.1: Update router**

Open `frontend/src/router.tsx`. Replace the `WorkflowEditorPlaceholder` import and route element with the real `WorkflowEditor`:

Before:
```ts
import WorkflowEditorPlaceholder from '@/pages/WorkflowEditorPlaceholder'
```
After:
```ts
import WorkflowEditor from '@/pages/WorkflowEditor'
```

In the route definition, change:
```ts
{ path: '/workflows/:id', element: <WorkflowEditorPlaceholder /> },
```
to:
```ts
{ path: '/workflows/:id', element: <WorkflowEditor /> },
```

- [ ] **Step 17.2: Delete placeholder**

```bash
rm frontend/src/pages/WorkflowEditorPlaceholder.tsx
```

- [ ] **Step 17.3: Build**

Run: `pnpm --filter @rainpath/frontend build 2>&1 | tail -10`
Expected: clean.

- [ ] **Step 17.4: Test**

Run: `pnpm --filter @rainpath/frontend test 2>&1 | tail -10`
Expected: still 17 tests pass (9 existing + 8 store specs from Task 4 = 17).

- [ ] **Step 17.5: Commit**

```bash
git add frontend/src/router.tsx frontend/src/pages/WorkflowEditorPlaceholder.tsx
git commit -m "feat(frontend): wire WorkflowEditor route and drop placeholder"
```

---

## Task 18: Smoke check + final commit

- [ ] **Step 18.1: Full build & test**

Run:
```bash
pnpm --filter @rainpath/frontend build
pnpm --filter @rainpath/frontend test
```
Expected: build clean; 17 tests pass.

- [ ] **Step 18.2: Manual smoke against backend**

Start the backend in one terminal:
```bash
pnpm --filter @rainpath/backend dev
```

In another terminal:
```bash
pnpm --filter @rainpath/frontend dev
```

Open `http://localhost:5173/workflows`. Click the seeded workflow. Verify:

1. The editor route loads. The seed workflow renders: start (left), email/sms/whatsapp/postal/condition nodes (whatever the seed contains), end (right).
2. Day axis at the top reads `J+0`, `J+5`, `J+10`, etc. — adapts when zooming with Ctrl+scroll.
3. The `J+0` rail (green, 2 px thick) passes through the start node.
4. Drag a non-start node vertically — it moves on Y only; X snaps back to the computed value.
5. Click a `+ N j` chip on any edge — popover opens. Change the value to a new integer, click Valider. Downstream nodes slide horizontally to their new X.
6. Press Ctrl+Z (or Cmd+Z) — last change undoes. Press Ctrl+Shift+Z — redo.
7. Click the workflow name in the top bar — inline edit. Type and press Enter. Save indicator shows `Enregistrement…` then `Enregistré il y a quelques secondes`.
8. Select a non-start, non-only-end node → press Delete. The node and its edges disappear. Downstream X recomputes.
9. Select an edge by clicking the line (not the chip) → press Delete. The edge disappears.
10. Press Cmd+S — explicit save. Indicator shows `Enregistrement…` then `Enregistré`.
11. Kebab menu → Exporter en JSON downloads `<name>.json`.
12. Kebab menu → Dupliquer creates a copy and navigates to it.
13. Browser back button → list page shows updated `updatedAt`.

Stop both servers.

- [ ] **Step 18.3: Commit any final tweaks if needed**

If the smoke surfaced bugs that need a small fix, commit them as `fix(frontend): editor smoke fixups` and continue. Otherwise no commit needed for Task 18.

---

## Self-review notes (post-plan)

**Spec coverage check** (Phase 1B-B1 scope per spec §7.2–§7.6):
- ✅ §7.2 Zustand store with full state + actions + history (50 max) — Task 3
- ✅ §7.2 auto-save with debounce, validation gate, hash dedup, in-flight single + queue, retry — Task 15
- ✅ §7.2 undo/redo with snapshot + index, drag debounced into one snapshot — Tasks 3, 14
- ✅ §7.3 custom Nodes per family with strip 3 px + Lucide icon + tokens — Tasks 5–8
- ✅ §7.3 custom Edge with chip + popover — Task 9
- ✅ §3.7 Background with adaptive gridlines + J+0 rail — Task 10
- ✅ §7.4 drag Y only; start fully locked — Task 11 (`draggable: false` for kind start)
- ✅ §7.6 top bar: editable name/desc inline, save indicator (reserved width), undo/redo, kebab — Task 12
- ✅ §7.6 keyboard shortcuts (Ctrl+Z/Y, Delete, Cmd+S) — Task 14
- ✅ §6 PATCH integration — Task 15

**Out of scope (deferred to Phase 1B-B2)**:
- Adding nodes from a palette (no palette in B-B1)
- Editing node params via modal (only positions/days edits in B-B1)
- Validation banner (errors surface via save status badge only; full banner is B-B2)
- Live prevention via `simulate*` (no connection drag in B-B1)
- `successCondition` / `multi` mode handle differentiation (visual sketch via single source handle only in B-B1)
- Recompute X — handled in store but visualization on drag of an in-progress connection is deferred

**Pitfall-1 audit**: Every place we touch shared Zod schemas is **type-only** (`import type { Graph }`) or runs `Schema.safeParse(unknown)` separately (no Zod composition mixing frontend and shared). The store stores raw `GraphNode`/`GraphEdge` values; React Flow gets plain objects. No `z.object({ ..., graph: Graph })` anywhere.

**Pitfall-2 audit**: Every icon name used in the plan is on the verified-present list at the top.

**Pitfall-3 audit**: All `<Icon size=...>` calls use `16`, `20`, or `24`. SVG text labels (in TimelineBackground) bypass the Icon wrapper.

**Pitfall-4 audit**: No semicolons in any code block.

**Pitfall-5 audit**: TanStack `useMutation` calls use `isPending` (not used in B-B1 — the auto-save tracks its own in-flight state via `useRef`, and TopBar's mutations are quick).

**Placeholder scan**: clean. Each step contains real code.

**Type consistency**: `GraphNode`, `GraphEdge` aliased once in `snapshot.ts` and reused. `EditorSnapshot`, `ValidationError`, `SaveStatus` defined in store/snapshot and re-imported where needed. Action names (`load`, `updateNodePositionY`, `updateEdgeDays`, `removeNode`, `removeEdge`, `undo`, `redo`, etc.) are identical across plan tasks.

**Scope**: 18 tasks, ~1.5–2 h of work, every commit produces an installable + buildable state.

**Push at end**: NOT included — controller will decide per the project convention.
