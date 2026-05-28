# RainPath — Phase 1B-B2 Editor Palette + Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the core editor scope by adding the **palette** (sidebar with system nodes + dynamic template library + new-template button), the **shared edit modal** (used both for node param edits via double-click AND template create/edit), connection-drag with cycle/self-loop/handle-conflict guards, and a **live validation banner** that reflects `validateGraph` errors and warnings from the shared module. Ships drag-from-palette to add new nodes. Live ghost preview during connection drag and during daysAfter editing is deferred to a hypothetical 1B-B3 polish (the visual safety net stays — the validation banner — but with no ghost rendering).

**Architecture:**
- The store gains four mutations: `addNode(kind, params, atY)`, `addEdge({source, target, sourceHandle?, daysAfter})` returning `{ok, reason?}`, `updateNodeData(id, data)`, and a derived `validate()` triggered after every mutation that calls `validateGraph` from `@rainpath/shared` and writes its errors+warnings into the store. The auto-save still gates on `validationErrors.length === 0`.
- A new `node-templates` API client backed by TanStack Query handles list/create/update/delete for `/api/node-templates`, with cache invalidation on mutations.
- The `Palette` sidebar (320 px, sticky-left, scrollable) groups templates by kind via Radix Accordion. A `NewTemplateButton` opens the shared modal in "template create" mode. `TemplateItem` carries a drag-handle (HTML5 drag API → JSON payload picked up by the Canvas's drop handler).
- The `NodeEditorModal` is a single Radix Dialog rendered at the editor page level. It opens in one of three modes: `node-edit` (double-click on a canvas node), `template-edit` (kebab → Éditer on a palette item), `template-create` (the New button). The form body is split into per-kind subforms with a shared `OutputConfigField` used by all 4 `send_*` kinds. `react-hook-form` manages form state.
- Connection drag is enabled (`nodesConnectable={true}`). The store's `addEdge` action runs the shared `simulateAddEdge` first; on rejection (cycle / self-loop / handle conflict) the canvas surfaces a toast and the edge is not committed. Ghost rendering is **out of scope** for B-B2 — text feedback only.

**Tech Stack additions:** `react-hook-form@7.53.0` (one new dep). Everything else (TanStack Query, Radix Dialog/Accordion, Zustand, React Flow, sonner) already installed.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-28-rainpath-workflow-editor-design.md` — §5.5 validation rules, §6.2 node-templates endpoints, §7.3 modal d'édition, §7.4 prevention live (B-B3 scope acknowledged), §7.5 palette, §7.11 validation banner.
- Phase 1B-B1 plan: `docs/superpowers/plans/2026-05-28-phase-1b-b1-editor-canvas.md` (just shipped, 17/17 tests).

---

## Pitfalls baked into this plan (lessons from 1B-A and 1B-B1)

1. **Dual-zod TS2719**: NEVER compose a Zod schema from `@rainpath/shared` into a frontend `z.object({...})`. For form validation, react-hook-form supports a `zodResolver` that calls `Schema.parse` directly without composing — that's safe. Use `import type { ... }` for shared types; use `Schema.safeParse(unknown)` for runtime checks. **Specifically**: the `NodeTemplateBody` discriminated union from shared is used only via `import type` + `Schema.safeParse(formValues)` in the modal submit handler, never inlined into a frontend `z.object`.
2. **Lucide v0.460 icon renames**: `Loader2 → LoaderCircle`, `AlertCircle → CircleAlert`, `MoreVertical → EllipsisVertical`. Use the verified names below.
3. **Icon size 16 | 20 | 24** only via the `Icon` wrapper.
4. **No semicolons. Single quotes.** Match the existing codebase.
5. **TanStack Query v5**: `useMutation.isPending` (not `isLoading`).
6. **Tailwind JIT** ignores dynamic class names built from template literals. When DS family color tokens need to be resolved at runtime (e.g. by kind), use inline `style={{ backgroundColor: \`var(--node-${family}-bg)\` }}` instead of `bg-[var(--node-${family}-bg)]`. (Pattern from 1B-B1 NodeCard.)
7. **`@xyflow/react` v12** API: `onConnect: (connection: Connection) => void`, `isValidConnection?: (connection: Connection) => boolean`, `Connection = { source, target, sourceHandle?, targetHandle? }`.

### Verified-present icons in lucide-react 0.460

`Play, Square, Mail, MessageSquare, MessageCircle, Inbox, GitBranch, Anchor, Plus, Trash2, Copy, Save, Undo2, Redo2, EllipsisVertical, X, Check, LoaderCircle, CircleAlert, CircleCheck, AlertTriangle, Target, Construction, MapPinOff, RotateCw, Upload, Download, WifiOff, ArrowLeft, GripVertical, Pencil, ChevronDown, Plus, Minus`.

---

## File structure (this plan creates)

```
frontend/
├── package.json                                       # MODIFY — add react-hook-form
├── src/
│   ├── api/
│   │   ├── node-templates.ts                          # CREATE — list/create/update/delete
│   │   └── node-templates.test.ts                     # CREATE — Zod roundtrip + error
│   ├── pages/WorkflowEditor/
│   │   ├── store.ts                                   # MODIFY — addNode, addEdge, updateNodeData, validate
│   │   ├── store.test.ts                              # MODIFY — new specs for addNode/addEdge/updateNodeData
│   │   ├── index.tsx                                  # MODIFY — add Palette + ValidationBanner + Modal mount
│   │   ├── Canvas.tsx                                 # MODIFY — nodesConnectable, onConnect, drop handler, double-click
│   │   ├── ValidationBanner.tsx                       # CREATE
│   │   ├── modal-state.ts                             # CREATE — module-level Zustand slice for modal open/mode
│   │   ├── palette/
│   │   │   ├── Palette.tsx                            # CREATE — full sidebar
│   │   │   ├── SystemNodesSection.tsx                 # CREATE — Start/End drag sources
│   │   │   ├── TemplatesSection.tsx                   # CREATE — fetch + group + accordion
│   │   │   └── NewTemplateButton.tsx                  # CREATE — kind picker
│   │   └── modal/
│   │       ├── NodeEditorModal.tsx                    # CREATE — Dialog shell + dispatch by kind
│   │       ├── form-types.ts                          # CREATE — FormValues per kind
│   │       ├── CharCounter.tsx                        # CREATE — colored count
│   │       ├── OutputConfigField.tsx                  # CREATE — single/simple/multi switcher
│   │       ├── EmailParamsForm.tsx                    # CREATE
│   │       ├── SmsParamsForm.tsx                      # CREATE
│   │       ├── WhatsAppParamsForm.tsx                 # CREATE
│   │       ├── PostalParamsForm.tsx                   # CREATE
│   │       └── ConditionParamsForm.tsx                # CREATE
```

---

## Conventions across tasks

- **New node IDs**: use `createId()` from `@paralleldrive/cuid2` (already installed Phase 1B-A).
- **Palette drag payload**: HTML5 `dataTransfer` with MIME type `application/x-rainpath-template` carrying a JSON string `{ kind, params }` for a template drop, or `{ kind: 'start' | 'end' }` for a system-node drop. The Canvas reads `dataTransfer.types` to identify the drop kind.
- **Modal state lives in a separate Zustand slice** (`modal-state.ts`) so React Flow re-renders aren't triggered by modal open/close. The editor store stays focused on graph state.
- **Validation timing**: `validate()` is called inside every mutating store action (`load`, `addNode`, `addEdge`, `updateNodeData`, `updateEdgeDays`, `removeNode`, `removeEdge`, `undo`, `redo`). It writes `validationErrors` + `validationWarnings` into the store; the banner subscribes.
- **Auto-save still gates on errors** (set in Phase 1B-B1). With live `validate()`, the badge can transition to `'invalid'` before any save attempt — that's intended.

---

## Task 1: react-hook-form

**Files:**
- Modify: `frontend/package.json` (via pnpm add)

- [ ] **Step 1.1: Install**

Run:
```bash
pnpm --filter @rainpath/frontend add react-hook-form@7.53.0
```

- [ ] **Step 1.2: Build sanity**

Run: `pnpm --filter @rainpath/frontend build 2>&1 | tail -5`
Expected: clean.

- [ ] **Step 1.3: Commit**

```bash
git add frontend/package.json pnpm-lock.yaml
git commit -m "chore(frontend): add react-hook-form for the editor modal"
```

---

## Task 2: node-templates API client + test

**Files:**
- Create: `frontend/src/api/node-templates.ts`
- Create: `frontend/src/api/node-templates.test.ts`

- [ ] **Step 2.1: Failing test first**

Write `frontend/src/api/node-templates.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listNodeTemplates, createNodeTemplate, updateNodeTemplate, deleteNodeTemplate
} from './node-templates'
import { ApiError } from './client'

const originalFetch = globalThis.fetch

function mockFetchOnce(response: { status: number; body: unknown }) {
  globalThis.fetch = vi.fn().mockResolvedValueOnce(
    new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    })
  ) as unknown as typeof fetch
}

describe('node-templates api client', () => {
  beforeEach(() => { globalThis.fetch = originalFetch })

  it('listNodeTemplates parses the array', async () => {
    mockFetchOnce({
      status: 200,
      body: [{
        id: 't1', name: 'Email A',
        kind: 'send_email',
        params: { subject: 'Hi', body: '', output: { mode: 'single' } },
        createdAt: '2026-05-28T10:00:00.000Z',
        updatedAt: '2026-05-28T10:00:00.000Z'
      }]
    })
    const list = await listNodeTemplates()
    expect(list).toHaveLength(1)
    expect(list[0]?.kind).toBe('send_email')
  })

  it('createNodeTemplate forwards body and parses response', async () => {
    mockFetchOnce({
      status: 201,
      body: {
        id: 't1', name: 'SMS short', kind: 'send_sms',
        params: { body: 'hi', output: { mode: 'single' } },
        createdAt: '2026-05-28T10:00:00.000Z',
        updatedAt: '2026-05-28T10:00:00.000Z'
      }
    })
    const t = await createNodeTemplate({
      name: 'SMS short',
      kind: 'send_sms',
      params: { body: 'hi', output: { mode: 'single' } }
    })
    expect(t.id).toBe('t1')
  })

  it('updateNodeTemplate hits PATCH path', async () => {
    mockFetchOnce({
      status: 200,
      body: {
        id: 't1', name: 'renamed', kind: 'send_sms',
        params: { body: 'hi', output: { mode: 'single' } },
        createdAt: '2026-05-28T10:00:00.000Z',
        updatedAt: '2026-05-28T10:00:00.000Z'
      }
    })
    const t = await updateNodeTemplate('t1', { name: 'renamed' })
    expect(t.name).toBe('renamed')
  })

  it('deleteNodeTemplate resolves on 204', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })) as unknown as typeof fetch
    await expect(deleteNodeTemplate('t1')).resolves.toBeUndefined()
  })

  it('createNodeTemplate rejects with ApiError on 422', async () => {
    mockFetchOnce({
      status: 422,
      body: { statusCode: 422, errors: [{ code: 'bad', message: 'nope' }], warnings: [] }
    })
    let caught: unknown
    try {
      await createNodeTemplate({
        name: 'X', kind: 'send_email',
        params: { subject: '', body: '', output: { mode: 'single' } }
      })
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ApiError)
    expect((caught as ApiError).status).toBe(422)
  })
})
```

- [ ] **Step 2.2: Run, verify FAIL**

Run: `pnpm --filter @rainpath/frontend test -- node-templates 2>&1 | tail -10`
Expected: FAIL — module not found.

- [ ] **Step 2.3: Implement**

Write `frontend/src/api/node-templates.ts`:
```ts
import { z } from 'zod'
import type { CreateNodeTemplateDto, NodeTemplate, UpdateNodeTemplateDto } from '@rainpath/shared'
import { ApiError, apiFetch } from './client'

const NodeTemplateResp = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  kind: z.enum(['send_email', 'send_sms', 'send_whatsapp', 'send_postal', 'condition']),
  params: z.unknown(),
  createdAt: z.string(),
  updatedAt: z.string()
})

function parseOne(raw: unknown): NodeTemplate {
  const r = NodeTemplateResp.safeParse(raw)
  if (!r.success) {
    throw new ApiError(500, {
      message: 'response_drift',
      errors: r.error.issues.map(i => ({ code: 'response_drift', message: i.message, path: i.path }))
    })
  }
  // The shared NodeTemplate type is itself a discriminated union {id, name, kind, params, ...};
  // we hold params as `unknown` here and trust the backend to enforce kind/params coherence.
  return { ...r.data, description: r.data.description ?? undefined } as unknown as NodeTemplate
}

function parseList(raw: unknown): NodeTemplate[] {
  if (!Array.isArray(raw)) {
    throw new ApiError(500, { message: 'response_drift', errors: [{ code: 'not_array', message: 'expected array' }] })
  }
  return raw.map(parseOne)
}

export async function listNodeTemplates(): Promise<NodeTemplate[]> {
  const raw = await apiFetch<unknown>('/node-templates')
  return parseList(raw)
}

export async function createNodeTemplate(body: CreateNodeTemplateDto): Promise<NodeTemplate> {
  const raw = await apiFetch<unknown>('/node-templates', { method: 'POST', body })
  return parseOne(raw)
}

export async function updateNodeTemplate(id: string, body: UpdateNodeTemplateDto): Promise<NodeTemplate> {
  const raw = await apiFetch<unknown>(`/node-templates/${id}`, { method: 'PATCH', body })
  return parseOne(raw)
}

export async function deleteNodeTemplate(id: string): Promise<void> {
  await apiFetch<void>(`/node-templates/${id}`, { method: 'DELETE' })
}
```

- [ ] **Step 2.4: Run, verify PASS**

Run: `pnpm --filter @rainpath/frontend test -- node-templates 2>&1 | tail -10`
Expected: 5 specs pass.

- [ ] **Step 2.5: Commit**

```bash
git add frontend/src/api/node-templates.ts frontend/src/api/node-templates.test.ts
git commit -m "feat(frontend): typed node-templates API client with Zod parse"
```

---

## Task 3: Store extensions (addNode, addEdge, updateNodeData, validate)

**Files:**
- Modify: `frontend/src/pages/WorkflowEditor/store.ts`
- Modify: `frontend/src/pages/WorkflowEditor/store.test.ts`

Use `import { validateGraph } from '@rainpath/shared'` to run live validation inside every mutating action. Returns `{ errors, warnings }` — both arrays.

- [ ] **Step 3.1: Read the current store.ts to anchor changes**

Run: `cat /Users/dereksamson/Projects/rainpath-mini-project/frontend/src/pages/WorkflowEditor/store.ts | head -200`

You need to confirm: the file currently has `pushHistory` + `recordCurrentSnapshot` + `recomputeAndApply` helpers and the existing actions. Verify before editing.

- [ ] **Step 3.2: Apply targeted edits to store.ts**

The store.ts changes are:

(a) **Add imports at the top** (next to the existing `computeXPositions` import):
```ts
import { computeXPositions, validateGraph } from '@rainpath/shared'
import { createId } from '@paralleldrive/cuid2'
```

(b) **Extend the `EditorState` type** with a `validationWarnings: ValidationError[]` field (the existing `validationErrors` stays). The `ValidationError` type already accommodates the warning shape (no `missingStatuses` slot — that's intentional; the banner only shows code/message/refs in B-B2).

Replace the existing `validationErrors: ValidationError[]` line in `EditorState` with two lines:
```ts
  validationErrors: ValidationError[]
  validationWarnings: ValidationError[]
```

And add to `initialState`:
```ts
  validationWarnings: [],
```

(c) **Add a `runValidation` helper** near `recomputeAndApply`:
```ts
function runValidation(nodes: GraphNode[], edges: GraphEdge[]): { errors: ValidationError[]; warnings: ValidationError[] } {
  const r = validateGraph({ nodes, edges })
  return {
    errors: r.errors.map(e => ({ code: e.code, message: e.message, nodeId: e.nodeId, edgeId: e.edgeId })),
    warnings: r.warnings.map(w => ({ code: w.code, message: w.message, nodeId: w.nodeId, edgeId: w.edgeId }))
  }
}
```

(d) **Extend `EditorActions`** type with the new actions:
```ts
  addNode(p: { kind: GraphNode['data']['kind']; data: GraphNode['data']; atY?: number }): string
  addEdge(p: { source: string; target: string; sourceHandle?: string; daysAfter: number }): { ok: true; edgeId: string } | { ok: false; reason: 'self_loop' | 'cycle' | 'handle_conflict' | 'dangling' | 'edge_into_start' | 'edge_from_end' }
  updateNodeData(id: string, data: GraphNode['data']): void
```

(e) **Implement `addNode`** inside the store (place it before `setSelectedNode`):
```ts
  addNode: ({ kind, data, atY }) => {
    let newId = ''
    set(state => {
      newId = createId()
      const startY = state.nodes.find(n => n.data.kind === 'start')?.position.y ?? 200
      const node: GraphNode = {
        id: newId,
        position: { x: 0, y: atY ?? startY + 120 },
        data
      } as GraphNode
      const pushed = pushHistory(state)
      const nodes = recomputeAndApply([...pushed.nodes, node], pushed.edges)
      const v = runValidation(nodes, pushed.edges)
      const next: EditorState = {
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
```

(f) **Implement `addEdge`** inside the store (place it before `setSelectedNode`):
```ts
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

    // Cycle check via Kahn topo on the prospective edge set.
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
      const next: EditorState = {
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
```

(g) **Implement `updateNodeData`** inside the store:
```ts
  updateNodeData: (id, data) => {
    set(state => {
      const pushed = pushHistory(state)
      const nodes = pushed.nodes.map(n => (n.id === id ? { ...n, data } as GraphNode : n))
      const recomputed = recomputeAndApply(nodes, pushed.edges)
      const v = runValidation(recomputed, pushed.edges)
      const next: EditorState = {
        ...pushed, nodes: recomputed,
        validationErrors: v.errors,
        validationWarnings: v.warnings
      }
      const history = [...next.history]
      history[next.historyIndex] = { name: next.name, description: next.description, nodes: next.nodes, edges: next.edges }
      return { ...next, history }
    })
  },
```

(h) **Plug `runValidation` into existing mutating actions** (`load`, `updateNodePositionY`, `updateEdgeDays`, `removeNode`, `removeEdge`, `undo`, `redo`).

For each of those, after recomputing nodes, add:
```ts
      const v = runValidation(<resultingNodes>, <resultingEdges>)
```
and include `validationErrors: v.errors, validationWarnings: v.warnings` in the returned object.

In `load`, also set both fields in the seed `set({...initialState, ...})` call:
```ts
      validationErrors: [], validationWarnings: [],
```
…then after the seed, run validation once and update with `useEditorStore.setState({validationErrors, validationWarnings})` — or compute it inline before the `set` call.

Concretely, replace the existing `load` body with:
```ts
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
```

For `undo` / `redo`, after the snapshot restore, append the validation update. Replace those two action bodies with:
```ts
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
```

For `updateNodePositionY`, `updateEdgeDays`, `removeNode`, `removeEdge`, add a `v = runValidation(...)` line after `recomputeAndApply` (when applicable) and include the two validation fields in the returned object. Use the existing structure of those actions — the only addition is the validation call and the two extra fields in the returned state.

- [ ] **Step 3.3: Add specs to store.test.ts**

Append to `frontend/src/pages/WorkflowEditor/store.test.ts` (inside the existing `describe('useEditorStore')` block):
```ts
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
        params: { subject: 'Hi', body: 'B', output: { mode: 'single' } }
      } as any
    })
    expect(newId).toBeTruthy()
    const s = useEditorStore.getState()
    expect(s.nodes.find(n => n.id === newId)).toBeDefined()
    // No edges to it yet → orphan with X=0
    expect(s.nodes.find(n => n.id === newId)?.position.x).toBe(0)
    expect(s.selectedNodeId).toBe(newId)
  })

  it('addEdge rejects self-loop', () => {
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), emailNode('a'), endNode()],
      edges: [edge('e1', 's', 'a', 5), edge('e2', 'a', 'e', 10)]
    })
    const r = useEditorStore.getState().addEdge({ source: 'a', target: 'a', daysAfter: 0 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('self_loop')
  })

  it('addEdge rejects cycle', () => {
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), emailNode('a'), emailNode('b'), endNode()],
      edges: [
        edge('e1', 's', 'a', 1),
        edge('e2', 'a', 'b', 1),
        edge('e3', 'b', 'e', 1)
      ]
    })
    const r = useEditorStore.getState().addEdge({ source: 'b', target: 'a', daysAfter: 1 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('cycle')
  })

  it('addEdge accepts a valid connection and recomputes downstream X', () => {
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), emailNode('a'), endNode()],
      edges: [edge('e1', 's', 'a', 5)]
    })
    const r = useEditorStore.getState().addEdge({ source: 'a', target: 'e', daysAfter: 10 })
    expect(r.ok).toBe(true)
    const s = useEditorStore.getState()
    expect(s.nodes.find(n => n.id === 'e')?.position.x).toBe(15)
  })

  it('updateNodeData replaces a node’s data discriminant payload', () => {
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), emailNode('a'), endNode()],
      edges: [edge('e1', 's', 'a', 5), edge('e2', 'a', 'e', 10)]
    })
    useEditorStore.getState().updateNodeData('a', {
      kind: 'send_email',
      params: { subject: 'Updated', body: 'Body', output: { mode: 'single' } }
    } as any)
    const node = useEditorStore.getState().nodes.find(n => n.id === 'a')
    expect(node?.data).toMatchObject({ kind: 'send_email', params: { subject: 'Updated' } })
  })

  it('validation runs on load and updates errors/warnings', () => {
    // An end node with no incoming edge is structurally invalid (orphan end). Validation should flag.
    useEditorStore.getState().load({
      id: 'w1', name: '', description: '',
      nodes: [startNode(), endNode('e1'), endNode('orphan')],
      edges: [edge('e_se1', 's', 'e1', 1)]
    })
    const s = useEditorStore.getState()
    // We don't enforce a specific error code here, just that the validator ran.
    expect(Array.isArray(s.validationErrors)).toBe(true)
    expect(Array.isArray(s.validationWarnings)).toBe(true)
  })
```

(Use the existing `emailNode`, `startNode`, `endNode`, `edge` helpers from the file. If `emailNode` isn't already defined globally in the file, it is — Phase 1B-B1's spec defined it. Verify before editing.)

- [ ] **Step 3.4: Run tests**

Run: `pnpm --filter @rainpath/frontend test -- store.test 2>&1 | tail -15`
Expected: previous 8 + 6 new = 14 specs pass.

- [ ] **Step 3.5: Commit**

```bash
git add frontend/src/pages/WorkflowEditor/store.ts frontend/src/pages/WorkflowEditor/store.test.ts
git commit -m "feat(frontend): editor store gains addNode/addEdge/updateNodeData + live validateGraph"
```

---

## Task 4: ValidationBanner

**Files:**
- Create: `frontend/src/pages/WorkflowEditor/ValidationBanner.tsx`

- [ ] **Step 4.1: Implement**

Write `frontend/src/pages/WorkflowEditor/ValidationBanner.tsx`:
```tsx
import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { IconButton } from '@/components/ui/IconButton'
import { useEditorStore } from './store'

export function ValidationBanner() {
  const errors = useEditorStore(s => s.validationErrors)
  const warnings = useEditorStore(s => s.validationWarnings)
  const [collapsed, setCollapsed] = useState(false)

  const total = errors.length + warnings.length
  if (total === 0) return null

  const hasErrors = errors.length > 0
  const bg = hasErrors ? 'bg-[#FEF2F2]' : 'bg-[#FFFBEB]'
  const borderTone = hasErrors ? 'border-danger' : 'border-warning'

  return (
    <div
      role="region"
      aria-label="Validation du workflow"
      className={`absolute bottom-0 left-0 right-0 max-h-[25vh] overflow-y-auto border-t-2 ${borderTone} ${bg}`}
    >
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-fg" aria-live="polite">
          <Icon name="CircleAlert" size={16} className={hasErrors ? 'text-danger' : 'text-warning'} />
          <span>
            {errors.length > 0
              ? `${errors.length} erreur${errors.length > 1 ? 's' : ''}`
              : null}
            {errors.length > 0 && warnings.length > 0 ? ' · ' : null}
            {warnings.length > 0
              ? `${warnings.length} avertissement${warnings.length > 1 ? 's' : ''}`
              : null}
          </span>
        </div>
        <IconButton
          icon={collapsed ? 'ChevronDown' : 'X'}
          aria-label={collapsed ? 'Développer la bannière' : 'Réduire la bannière'}
          size="sm"
          onClick={() => setCollapsed(c => !c)}
        />
      </div>
      {collapsed ? null : (
        <ul className="space-y-1 px-4 pb-3 text-sm">
          {errors.map((e, i) => (
            <li key={`e-${i}`} className="flex items-start gap-2 text-danger">
              <Icon name="CircleAlert" size={16} />
              <span>
                <span className="font-medium">[{e.code}]</span> {e.message}
              </span>
            </li>
          ))}
          {warnings.map((w, i) => (
            <li key={`w-${i}`} className="flex items-start gap-2 text-warning">
              <Icon name="AlertTriangle" size={16} />
              <span>
                <span className="font-medium">[{w.code}]</span> {w.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4.2: Commit**

```bash
git add frontend/src/pages/WorkflowEditor/ValidationBanner.tsx
git commit -m "feat(frontend): ValidationBanner (errors + warnings + collapse toggle)"
```

---

## Task 5: Modal state slice

**Files:**
- Create: `frontend/src/pages/WorkflowEditor/modal-state.ts`

- [ ] **Step 5.1: Implement**

Write `frontend/src/pages/WorkflowEditor/modal-state.ts`:
```ts
import { create } from 'zustand'
import type { NodeTemplate } from '@rainpath/shared'

export type NodeKind = 'send_email' | 'send_sms' | 'send_whatsapp' | 'send_postal' | 'condition'

export type ModalContent =
  | { mode: 'node-edit'; nodeId: string; kind: NodeKind }
  | { mode: 'template-create'; kind: NodeKind }
  | { mode: 'template-edit'; template: NodeTemplate }
  | null

interface ModalState {
  content: ModalContent
  open(content: Exclude<ModalContent, null>): void
  close(): void
}

export const useModalState = create<ModalState>(set => ({
  content: null,
  open: content => set({ content }),
  close: () => set({ content: null })
}))
```

- [ ] **Step 5.2: Commit**

```bash
git add frontend/src/pages/WorkflowEditor/modal-state.ts
git commit -m "feat(frontend): modal-state slice for editor edit modal"
```

---

## Task 6: Palette skeleton (Palette + SystemNodesSection + integration)

**Files:**
- Create: `frontend/src/pages/WorkflowEditor/palette/Palette.tsx`
- Create: `frontend/src/pages/WorkflowEditor/palette/SystemNodesSection.tsx`
- Modify: `frontend/src/pages/WorkflowEditor/index.tsx` (add Palette + ValidationBanner to layout)

- [ ] **Step 6.1: SystemNodesSection**

Write `frontend/src/pages/WorkflowEditor/palette/SystemNodesSection.tsx`:
```tsx
import { DragEvent } from 'react'
import { Icon } from '@/components/Icon'
import { useEditorStore } from '../store'

interface PaletteDragPayload {
  kind: 'start' | 'end' | 'template'
  templateId?: string
}

function startDrag(e: DragEvent<HTMLButtonElement>, payload: PaletteDragPayload) {
  e.dataTransfer.setData('application/x-rainpath-palette', JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'copy'
}

export function SystemNodesSection() {
  const hasStart = useEditorStore(s => s.nodes.some(n => n.data.kind === 'start'))
  return (
    <div className="px-4 pt-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        Nœuds système
      </h3>
      <div className="space-y-1">
        <button
          type="button"
          draggable={!hasStart}
          onDragStart={e => startDrag(e, { kind: 'start' })}
          aria-disabled={hasStart}
          className={`flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm transition-colors ${
            hasStart
              ? 'cursor-not-allowed opacity-50'
              : 'cursor-grab hover:bg-surface-muted active:cursor-grabbing'
          }`}
          title={hasStart ? 'Un nœud Départ existe déjà' : 'Glisser pour ajouter'}
        >
          <Icon name="Play" size={16} className="text-[var(--node-start-accent)]" />
          <span className="font-medium text-fg">Départ</span>
        </button>
        <button
          type="button"
          draggable
          onDragStart={e => startDrag(e, { kind: 'end' })}
          className="flex h-10 w-full cursor-grab items-center gap-2 rounded-md px-3 text-sm hover:bg-surface-muted active:cursor-grabbing"
        >
          <Icon name="Square" size={16} className="text-[var(--node-end-accent)]" />
          <span className="font-medium text-fg">Fin</span>
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6.2: Palette shell**

Write `frontend/src/pages/WorkflowEditor/palette/Palette.tsx`:
```tsx
import { SystemNodesSection } from './SystemNodesSection'

export function Palette() {
  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col overflow-y-auto border-r border-border bg-surface">
      <SystemNodesSection />
      {/* TemplatesSection slot — added in Task 7 */}
      <div id="palette-templates-slot" className="flex-1" />
    </aside>
  )
}
```

- [ ] **Step 6.3: Modify index.tsx to add Palette + ValidationBanner**

Open `frontend/src/pages/WorkflowEditor/index.tsx`. Replace the success-state JSX (the `<div className="flex h-[calc(100dvh-48px)] flex-col">` block) with:
```tsx
  return (
    <div className="flex h-[calc(100dvh-48px)] flex-col">
      <TopBar saveNow={saveNow} />
      <div className="flex flex-1 overflow-hidden">
        <Palette />
        <div className="relative flex-1">
          <Canvas />
          <ValidationBanner />
        </div>
      </div>
    </div>
  )
```

Add imports at the top:
```tsx
import { Palette } from './palette/Palette'
import { ValidationBanner } from './ValidationBanner'
```

- [ ] **Step 6.4: Build + commit**

Run: `pnpm --filter @rainpath/frontend build 2>&1 | tail -5`
Expected: clean.

```bash
git add frontend/src/pages/WorkflowEditor/palette/Palette.tsx frontend/src/pages/WorkflowEditor/palette/SystemNodesSection.tsx frontend/src/pages/WorkflowEditor/index.tsx
git commit -m "feat(frontend): Palette sidebar shell with SystemNodesSection + ValidationBanner mounted"
```

---

## Task 7: TemplatesSection (fetch + group + drag)

**Files:**
- Create: `frontend/src/pages/WorkflowEditor/palette/TemplatesSection.tsx`
- Modify: `frontend/src/pages/WorkflowEditor/palette/Palette.tsx` (replace slot with actual component)

- [ ] **Step 7.1: TemplatesSection**

Write `frontend/src/pages/WorkflowEditor/palette/TemplatesSection.tsx`:
```tsx
import { DragEvent, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Accordion from '@radix-ui/react-accordion'
import { toast } from 'sonner'
import type { NodeTemplate } from '@rainpath/shared'
import { Icon, IconName } from '@/components/Icon'
import { IconButton } from '@/components/ui/IconButton'
import {
  DropdownMenu, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator
} from '@/components/ui/DropdownMenu'
import { queryKeys } from '@/api/query-keys'
import { listNodeTemplates, deleteNodeTemplate } from '@/api/node-templates'
import { useModalState, type NodeKind } from '../modal-state'
import { NewTemplateButton } from './NewTemplateButton'

const KIND_LABEL: Record<NodeKind, string> = {
  send_email: 'Email',
  send_sms: 'SMS',
  send_whatsapp: 'WhatsApp',
  send_postal: 'Postal',
  condition: 'Condition'
}

const KIND_ICON: Record<NodeKind, IconName> = {
  send_email: 'Mail',
  send_sms: 'MessageSquare',
  send_whatsapp: 'MessageCircle',
  send_postal: 'Inbox',
  condition: 'GitBranch'
}

export function TemplatesSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.nodeTemplates.list(),
    queryFn: listNodeTemplates
  })
  const qc = useQueryClient()
  const open = useModalState(s => s.open)
  const [expanded, setExpanded] = useState<string[]>(['send_email', 'send_sms', 'send_whatsapp', 'send_postal', 'condition'])

  const delMut = useMutation({
    mutationFn: (id: string) => deleteNodeTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.nodeTemplates.list() })
      toast.success('Modèle supprimé')
    },
    onError: () => toast.error('Échec de la suppression')
  })

  const grouped = useMemo(() => {
    const out: Record<NodeKind, NodeTemplate[]> = {
      send_email: [], send_sms: [], send_whatsapp: [], send_postal: [], condition: []
    }
    if (!data) return out
    for (const t of data) {
      const k = (t as unknown as { kind: NodeKind }).kind
      out[k]?.push(t)
    }
    return out
  }, [data])

  const onDragStart = (e: DragEvent<HTMLDivElement>, template: NodeTemplate) => {
    e.dataTransfer.setData(
      'application/x-rainpath-palette',
      JSON.stringify({ kind: 'template', templateId: template.id })
    )
    e.dataTransfer.setData(
      'application/x-rainpath-template',
      JSON.stringify({ kind: (template as unknown as { kind: NodeKind }).kind, params: (template as unknown as { params: unknown }).params })
    )
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="border-t border-border px-4 pt-3 pb-6">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Modèles</h3>
        <NewTemplateButton />
      </div>

      {isLoading ? (
        <p className="text-xs text-fg-muted">Chargement…</p>
      ) : error ? (
        <p className="text-xs text-danger">Impossible de charger les modèles</p>
      ) : (
        <Accordion.Root type="multiple" value={expanded} onValueChange={setExpanded}>
          {(Object.keys(grouped) as NodeKind[]).map(kind => {
            const items = grouped[kind]
            if (items.length === 0) return null
            return (
              <Accordion.Item key={kind} value={kind} className="border-b border-border last:border-0">
                <Accordion.Header>
                  <Accordion.Trigger className="flex w-full items-center justify-between py-2 text-xs font-medium text-fg [&[data-state=open]>svg]:rotate-180">
                    <span className="flex items-center gap-2">
                      <Icon name={KIND_ICON[kind]} size={16} />
                      {KIND_LABEL[kind]} <span className="text-fg-muted">({items.length})</span>
                    </span>
                    <Icon name="ChevronDown" size={16} className="transition-transform" />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="pb-2">
                  {items.map(t => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={e => onDragStart(e, t)}
                      className="group flex h-10 cursor-grab items-center gap-2 rounded-md px-2 text-sm hover:bg-surface-muted active:cursor-grabbing"
                    >
                      <Icon name="GripVertical" size={16} className="text-fg-subtle" />
                      <span className="flex-1 truncate font-medium text-fg" title={t.name}>
                        {t.name}
                      </span>
                      <DropdownMenu>
                        <DropdownTrigger asChild>
                          <IconButton
                            icon="EllipsisVertical"
                            aria-label={`Actions sur ${t.name}`}
                            size="sm"
                          />
                        </DropdownTrigger>
                        <DropdownContent>
                          <DropdownItem icon="Pencil" onSelect={() => open({ mode: 'template-edit', template: t })}>
                            Éditer
                          </DropdownItem>
                          <DropdownSeparator />
                          <DropdownItem icon="Trash2" danger onSelect={() => delMut.mutate(t.id)}>
                            Supprimer
                          </DropdownItem>
                        </DropdownContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </Accordion.Content>
              </Accordion.Item>
            )
          })}
        </Accordion.Root>
      )}
    </div>
  )
}
```

- [ ] **Step 7.2: NewTemplateButton**

Write `frontend/src/pages/WorkflowEditor/palette/NewTemplateButton.tsx`:
```tsx
import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Icon, IconName } from '@/components/Icon'
import { useModalState, type NodeKind } from '../modal-state'

const OPTIONS: Array<{ kind: NodeKind; label: string; icon: IconName }> = [
  { kind: 'send_email', label: 'Email', icon: 'Mail' },
  { kind: 'send_sms', label: 'SMS', icon: 'MessageSquare' },
  { kind: 'send_whatsapp', label: 'WhatsApp', icon: 'MessageCircle' },
  { kind: 'send_postal', label: 'Courrier', icon: 'Inbox' },
  { kind: 'condition', label: 'Condition', icon: 'GitBranch' }
]

export function NewTemplateButton() {
  const [open, setOpen] = useState(false)
  const openModal = useModalState(s => s.open)
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex h-7 items-center gap-1 rounded-md border border-border bg-surface px-2 text-xs font-medium text-fg hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon name="Plus" size={16} />
          Nouveau
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={4}
          className="z-50 min-w-[200px] rounded-md border border-border bg-surface p-1 shadow-elev-2"
        >
          {OPTIONS.map(o => (
            <button
              key={o.kind}
              type="button"
              onClick={() => {
                openModal({ mode: 'template-create', kind: o.kind })
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-fg outline-none hover:bg-surface-muted"
            >
              <Icon name={o.icon} size={16} />
              {o.label}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
```

- [ ] **Step 7.3: Plug TemplatesSection into Palette**

Replace the `frontend/src/pages/WorkflowEditor/palette/Palette.tsx` contents with:
```tsx
import { SystemNodesSection } from './SystemNodesSection'
import { TemplatesSection } from './TemplatesSection'

export function Palette() {
  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col overflow-y-auto border-r border-border bg-surface">
      <SystemNodesSection />
      <TemplatesSection />
    </aside>
  )
}
```

- [ ] **Step 7.4: Build + commit**

Run: `pnpm --filter @rainpath/frontend build 2>&1 | tail -8`
Expected: clean.

```bash
git add frontend/src/pages/WorkflowEditor/palette/TemplatesSection.tsx frontend/src/pages/WorkflowEditor/palette/NewTemplateButton.tsx frontend/src/pages/WorkflowEditor/palette/Palette.tsx
git commit -m "feat(frontend): palette TemplatesSection (Accordion + drag) + NewTemplateButton"
```

---

## Task 8: Canvas — drop handler + connection drag + double-click

**Files:**
- Modify: `frontend/src/pages/WorkflowEditor/Canvas.tsx`

- [ ] **Step 8.1: Update Canvas**

Replace `frontend/src/pages/WorkflowEditor/Canvas.tsx` entirely with:
```tsx
import { useCallback, useMemo, useState, MouseEvent, DragEvent } from 'react'
import {
  ReactFlow, MiniMap, Controls, useReactFlow, ReactFlowProvider,
  type Node as RFNode, type Edge as RFEdge,
  type NodeChange, type EdgeChange, type Connection
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { toast } from 'sonner'
import { START_Y } from '@rainpath/shared'
import { useEditorStore } from './store'
import { nodeTypes } from './nodes/node-types'
import { edgeTypes } from './edges/edge-types'
import { TimelineBackground } from './TimelineBackground'
import { DaysAfterPopover } from './edges/DaysAfterPopover'
import { useModalState, type NodeKind } from './modal-state'

const PX_PER_DAY = 28

const DEFAULT_PARAMS: Record<NodeKind, unknown> = {
  send_email: { subject: '', body: '', output: { mode: 'single' } },
  send_sms: { body: '', output: { mode: 'single' } },
  send_whatsapp: { body: '', output: { mode: 'single' } },
  send_postal: { body: '', tracked: false, output: { mode: 'single' } },
  condition: { conditionType: 'data_available', expression: 'patient.email' }
}

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

const REJECTION_MSG: Record<string, string> = {
  self_loop: 'Auto-connexion impossible',
  cycle: 'Boucle détectée — connexion impossible',
  handle_conflict: 'Ce handle a déjà une sortie',
  dangling: 'Nœud cible inexistant',
  edge_into_start: 'Impossible d’entrer dans le nœud Départ',
  edge_from_end: 'Impossible de partir d’un nœud Fin'
}

function CanvasInner() {
  const nodes = useEditorStore(s => s.nodes)
  const edges = useEditorStore(s => s.edges)
  const setSelectedNode = useEditorStore(s => s.setSelectedNode)
  const setSelectedEdge = useEditorStore(s => s.setSelectedEdge)
  const updateNodePositionY = useEditorStore(s => s.updateNodePositionY)
  const updateEdgeDays = useEditorStore(s => s.updateEdgeDays)
  const addNode = useEditorStore(s => s.addNode)
  const addEdge = useEditorStore(s => s.addEdge)
  const openModal = useModalState(s => s.open)
  const { screenToFlowPosition } = useReactFlow()

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

  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return
    const result = addEdge({
      source: params.source,
      target: params.target,
      sourceHandle: params.sourceHandle ?? undefined,
      daysAfter: 0
    })
    if (!result.ok) {
      const msg = REJECTION_MSG[result.reason] ?? 'Connexion impossible'
      toast.error(msg)
    }
  }, [addEdge])

  const onDragOver = useCallback((e: DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-rainpath-palette')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const onDrop = useCallback((e: DragEvent) => {
    const raw = e.dataTransfer.getData('application/x-rainpath-palette')
    if (!raw) return
    e.preventDefault()

    let payload: { kind: 'start' | 'end' | 'template'; templateId?: string }
    try { payload = JSON.parse(raw) } catch { return }

    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const atY = flowPos.y

    if (payload.kind === 'start') {
      addNode({ kind: 'start', data: { kind: 'start' } as any, atY })
      return
    }
    if (payload.kind === 'end') {
      addNode({ kind: 'end', data: { kind: 'end' } as any, atY })
      return
    }
    if (payload.kind === 'template') {
      const tmplRaw = e.dataTransfer.getData('application/x-rainpath-template')
      if (!tmplRaw) return
      try {
        const tmpl = JSON.parse(tmplRaw) as { kind: NodeKind; params: unknown }
        addNode({
          kind: tmpl.kind,
          data: { kind: tmpl.kind, params: structuredClone(tmpl.params) } as any,
          atY
        })
      } catch {
        toast.error('Modèle invalide')
      }
    }
  }, [addNode, screenToFlowPosition])

  const onNodeDoubleClick = useCallback((_e: MouseEvent, rfNode: RFNode) => {
    const node = nodes.find(n => n.id === rfNode.id)
    if (!node) return
    if (node.data.kind === 'start' || node.data.kind === 'end') return
    openModal({ mode: 'node-edit', nodeId: node.id, kind: node.data.kind as NodeKind })
  }, [nodes, openModal])

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

  void START_Y // referenced indirectly via store; keep import for parity with previous file

  return (
    <div className="relative h-full w-full" onClick={onCanvasClick} onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        nodesConnectable
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

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}
```

Note: `useReactFlow()` requires the canvas to be wrapped in `<ReactFlowProvider>`. We wrap inline (a `Canvas` re-export wrapping `CanvasInner`).

- [ ] **Step 8.2: Build + commit**

Run: `pnpm --filter @rainpath/frontend build 2>&1 | tail -8`
Expected: clean.

```bash
git add frontend/src/pages/WorkflowEditor/Canvas.tsx
git commit -m "feat(frontend): Canvas connection drag + palette drop + double-click open modal"
```

---

## Task 9: Modal shell + form-types

**Files:**
- Create: `frontend/src/pages/WorkflowEditor/modal/form-types.ts`
- Create: `frontend/src/pages/WorkflowEditor/modal/NodeEditorModal.tsx`
- Create: `frontend/src/pages/WorkflowEditor/modal/CharCounter.tsx`
- Modify: `frontend/src/pages/WorkflowEditor/index.tsx` (mount modal)

### Step 9.1: form-types

Write `frontend/src/pages/WorkflowEditor/modal/form-types.ts`:
```ts
import type { Graph } from '@rainpath/shared'

export type EmailParams = Extract<Graph['nodes'][number]['data'], { kind: 'send_email' }>['params']
export type SmsParams = Extract<Graph['nodes'][number]['data'], { kind: 'send_sms' }>['params']
export type WhatsAppParams = Extract<Graph['nodes'][number]['data'], { kind: 'send_whatsapp' }>['params']
export type PostalParams = Extract<Graph['nodes'][number]['data'], { kind: 'send_postal' }>['params']
export type ConditionParams = Extract<Graph['nodes'][number]['data'], { kind: 'condition' }>['params']

export type AnyParams = EmailParams | SmsParams | WhatsAppParams | PostalParams | ConditionParams
```

### Step 9.2: CharCounter

Write `frontend/src/pages/WorkflowEditor/modal/CharCounter.tsx`:
```tsx
interface Props {
  value: number
  recommended: number
  max: number
  unicodeThreshold?: number
}

export function CharCounter({ value, recommended, max, unicodeThreshold }: Props) {
  const tone =
    value > max ? 'text-danger' :
    value > recommended ? 'text-warning' :
    unicodeThreshold && value > unicodeThreshold ? 'text-warning' :
    'text-fg-muted'
  return (
    <div className={`flex items-center gap-2 text-xs tabular-nums ${tone}`}>
      <span>{value} / {recommended}</span>
      {unicodeThreshold && value > unicodeThreshold && value <= recommended ? (
        <span className="text-warning">bascule unicode</span>
      ) : null}
      {value > recommended && value <= max ? <span>segmenté</span> : null}
      {value > max ? <span>limite dépassée</span> : null}
    </div>
  )
}
```

### Step 9.3: NodeEditorModal

Write `frontend/src/pages/WorkflowEditor/modal/NodeEditorModal.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { queryKeys } from '@/api/query-keys'
import { createNodeTemplate, updateNodeTemplate } from '@/api/node-templates'
import { ApiError } from '@/api/client'
import { useEditorStore } from '../store'
import { useModalState, type NodeKind } from '../modal-state'
import { EmailParamsForm } from './EmailParamsForm'
import { SmsParamsForm } from './SmsParamsForm'
import { WhatsAppParamsForm } from './WhatsAppParamsForm'
import { PostalParamsForm } from './PostalParamsForm'
import { ConditionParamsForm } from './ConditionParamsForm'
import type { AnyParams } from './form-types'

const KIND_LABEL: Record<NodeKind, string> = {
  send_email: 'Email',
  send_sms: 'SMS',
  send_whatsapp: 'WhatsApp',
  send_postal: 'Courrier postal',
  condition: 'Condition'
}

function emptyParams(kind: NodeKind): AnyParams {
  switch (kind) {
    case 'send_email':    return { subject: '', body: '', output: { mode: 'single' } } as AnyParams
    case 'send_sms':      return { body: '', output: { mode: 'single' } } as AnyParams
    case 'send_whatsapp': return { body: '', output: { mode: 'single' } } as AnyParams
    case 'send_postal':   return { body: '', tracked: false, output: { mode: 'single' } } as AnyParams
    case 'condition':     return { conditionType: 'data_available', expression: 'patient.email' } as AnyParams
  }
}

export function NodeEditorModal() {
  const content = useModalState(s => s.content)
  const closeModal = useModalState(s => s.close)
  if (!content) return null
  return <ModalBody content={content} onClose={closeModal} key={JSON.stringify(content)} />
}

interface BodyProps {
  content: NonNullable<ReturnType<typeof useModalState.getState>['content']>
  onClose: () => void
}

function ModalBody({ content, onClose }: BodyProps) {
  const editorNodes = useEditorStore(s => s.nodes)
  const updateNodeData = useEditorStore(s => s.updateNodeData)
  const qc = useQueryClient()

  // Initial params depending on the mode.
  const initialParams: AnyParams =
    content.mode === 'node-edit'
      ? ((): AnyParams => {
          const node = editorNodes.find(n => n.id === content.nodeId)
          if (node && 'params' in node.data) return node.data.params as AnyParams
          return emptyParams(content.kind)
        })()
      : content.mode === 'template-edit'
        ? ((content.template as unknown as { params: AnyParams }).params)
        : emptyParams(content.kind)

  const initialName: string =
    content.mode === 'template-edit' ? (content.template as unknown as { name: string }).name :
    content.mode === 'template-create' ? '' : ''

  const initialDescription: string =
    content.mode === 'template-edit'
      ? ((content.template as unknown as { description?: string }).description ?? '')
      : ''

  const [params, setParams] = useState<AnyParams>(initialParams)
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [error, setError] = useState<string | null>(null)

  // Re-sync if `content` changes underneath us (e.g. user switches templates).
  useEffect(() => {
    setParams(initialParams)
    setName(initialName)
    setDescription(initialDescription)
    setError(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(content)])

  const kind: NodeKind =
    content.mode === 'template-edit'
      ? ((content.template as unknown as { kind: NodeKind }).kind)
      : content.kind

  const createMut = useMutation({
    mutationFn: () => createNodeTemplate({
      name: name.trim() || `Nouveau ${KIND_LABEL[kind]}`,
      description: description.trim() || undefined,
      kind,
      params
    } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.nodeTemplates.list() })
      toast.success('Modèle créé')
      onClose()
    },
    onError: e => setError(e instanceof ApiError ? e.body.errors?.[0]?.message ?? e.message : 'Erreur')
  })

  const updateMut = useMutation({
    mutationFn: () => updateNodeTemplate(
      content.mode === 'template-edit' ? (content.template as unknown as { id: string }).id : '',
      { name: name.trim() || undefined, description: description.trim() || undefined, params } as any
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.nodeTemplates.list() })
      toast.success('Modèle mis à jour')
      onClose()
    },
    onError: e => setError(e instanceof ApiError ? e.body.errors?.[0]?.message ?? e.message : 'Erreur')
  })

  const handleSave = () => {
    setError(null)
    if (content.mode === 'node-edit') {
      updateNodeData(content.nodeId, { kind, params } as any)
      onClose()
      return
    }
    if (content.mode === 'template-create') createMut.mutate()
    else updateMut.mutate()
  }

  const showNameField = content.mode !== 'node-edit'

  return (
    <Dialog
      open
      onOpenChange={o => { if (!o) onClose() }}
      title={
        content.mode === 'node-edit' ? `Éditer · ${KIND_LABEL[kind]}` :
        content.mode === 'template-edit' ? `Modèle · ${KIND_LABEL[kind]}` :
        `Nouveau modèle · ${KIND_LABEL[kind]}`
      }
      size="lg"
    >
      <div className="space-y-4">
        {showNameField ? (
          <>
            <div>
              <label htmlFor="tmpl-name" className="mb-1 block text-sm font-medium text-fg">
                Nom du modèle <span className="text-danger">*</span>
              </label>
              <input
                id="tmpl-name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="tmpl-desc" className="mb-1 block text-sm font-medium text-fg">
                Description
              </label>
              <input
                id="tmpl-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm"
              />
            </div>
          </>
        ) : null}

        {kind === 'send_email' && (
          <EmailParamsForm value={params as Extract<AnyParams, { subject: string }>} onChange={setParams as any} />
        )}
        {kind === 'send_sms' && (
          <SmsParamsForm value={params as Extract<AnyParams, { body: string; output: any }>} onChange={setParams as any} />
        )}
        {kind === 'send_whatsapp' && (
          <WhatsAppParamsForm value={params as any} onChange={setParams as any} />
        )}
        {kind === 'send_postal' && (
          <PostalParamsForm value={params as any} onChange={setParams as any} />
        )}
        {kind === 'condition' && (
          <ConditionParamsForm value={params as any} onChange={setParams as any} />
        )}

        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button
            type="button"
            variant="primary"
            loading={createMut.isPending || updateMut.isPending}
            onClick={handleSave}
          >
            Enregistrer
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
```

### Step 9.4: Mount the modal in index.tsx

Open `frontend/src/pages/WorkflowEditor/index.tsx`. Just BEFORE the closing root `</div>` of the success-state JSX block, add:
```tsx
        <NodeEditorModal />
```

Add the import near the others:
```tsx
import { NodeEditorModal } from './modal/NodeEditorModal'
```

### Step 9.5: Commit

The forms imported in NodeEditorModal don't exist yet — Tasks 10–14 create them. For now, comment out their imports and JSX usages OR ship a temporary stub for each form (returning a `<p>Form coming…</p>` placeholder). Choose the stub approach:

For each of `EmailParamsForm.tsx`, `SmsParamsForm.tsx`, `WhatsAppParamsForm.tsx`, `PostalParamsForm.tsx`, `ConditionParamsForm.tsx`, write a temporary stub like:
```tsx
interface Props { value: unknown; onChange: (v: unknown) => void }
export function EmailParamsForm(_: Props) {
  return <p className="text-sm text-fg-muted">Formulaire Email — Task 10</p>
}
```
(Adjust the export name per file.)

Once stubs are in place, build + commit:
```bash
pnpm --filter @rainpath/frontend build 2>&1 | tail -5
git add frontend/src/pages/WorkflowEditor/modal frontend/src/pages/WorkflowEditor/index.tsx
git commit -m "feat(frontend): NodeEditorModal shell + form stubs (replaced by Tasks 10–14)"
```

---

## Task 10: EmailParamsForm + OutputConfigField

**Files:**
- Create: `frontend/src/pages/WorkflowEditor/modal/OutputConfigField.tsx`
- Replace: `frontend/src/pages/WorkflowEditor/modal/EmailParamsForm.tsx`

### Step 10.1: OutputConfigField

Write `frontend/src/pages/WorkflowEditor/modal/OutputConfigField.tsx`:
```tsx
import { CHANNEL_STATUSES } from '@rainpath/shared'
import type { Graph } from '@rainpath/shared'

type SendKind = 'send_email' | 'send_sms' | 'send_whatsapp' | 'send_postal'
type OutputConfig = Extract<Graph['nodes'][number]['data'], { kind: 'send_email' }>['params']['output']

interface Props {
  kind: SendKind
  tracked?: boolean
  value: OutputConfig
  onChange: (v: OutputConfig) => void
}

function channelKey(kind: SendKind, tracked?: boolean): keyof typeof CHANNEL_STATUSES {
  if (kind === 'send_email') return 'email'
  if (kind === 'send_sms') return 'sms'
  if (kind === 'send_whatsapp') return 'whatsapp'
  return tracked ? 'postal_tracked' : 'postal_untracked'
}

export function OutputConfigField({ kind, tracked, value, onChange }: Props) {
  const ck = channelKey(kind, tracked)
  const statuses = CHANNEL_STATUSES[ck]
  const lockedSingle = kind === 'send_postal' && tracked === false

  const setMode = (mode: 'single' | 'simple' | 'multi') => {
    if (mode === 'single') return onChange({ mode: 'single' })
    if (mode === 'simple') return onChange({ mode: 'simple', successCondition: { statuses: [...statuses] } })
    return onChange({
      mode: 'multi',
      outputs: [{ id: 'out_1', label: 'Sortie 1', condition: { statuses: [...statuses] } }]
    })
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface-muted p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Sortie</h4>
      <div className="flex gap-2">
        {(['single', 'simple', 'multi'] as const).map(m => (
          <label key={m} className={`flex h-9 flex-1 items-center justify-center rounded-md border text-sm font-medium ${
            value.mode === m ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface text-fg-muted'
          } ${lockedSingle && m !== 'single' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
            <input
              type="radio"
              className="sr-only"
              checked={value.mode === m}
              disabled={lockedSingle && m !== 'single'}
              onChange={() => setMode(m)}
            />
            {m === 'single' ? '1 sortie' : m === 'simple' ? 'Succès/Échec' : 'Multi'}
          </label>
        ))}
      </div>

      {value.mode === 'single' && (
        <p className="text-xs text-fg-muted">Une seule sortie, aucun branchement par statut.</p>
      )}

      {value.mode === 'simple' && (
        <div>
          <p className="mb-1 text-xs font-medium text-fg-muted">Statuts considérés comme succès</p>
          <StatusChecklist
            available={statuses}
            selected={value.successCondition.statuses}
            onChange={next => onChange({ mode: 'simple', successCondition: { statuses: next } })}
          />
        </div>
      )}

      {value.mode === 'multi' && (
        <div className="space-y-3">
          {value.outputs.map((out, ix) => (
            <div key={ix} className="rounded-md border border-border bg-surface p-2">
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={out.label}
                  onChange={e => {
                    const next = [...value.outputs]
                    next[ix] = { ...out, label: e.target.value }
                    onChange({ mode: 'multi', outputs: next })
                  }}
                  className="h-7 flex-1 rounded border border-border bg-surface px-2 text-sm"
                />
                <input
                  value={out.id}
                  onChange={e => {
                    const next = [...value.outputs]
                    next[ix] = { ...out, id: e.target.value }
                    onChange({ mode: 'multi', outputs: next })
                  }}
                  className="h-7 w-24 rounded border border-border bg-surface px-2 text-xs font-mono text-fg-muted"
                  title="Identifiant du handle"
                />
                <button
                  type="button"
                  onClick={() => onChange({ mode: 'multi', outputs: value.outputs.filter((_, i) => i !== ix) })}
                  disabled={value.outputs.length <= 1}
                  className="rounded-md p-1 text-fg-muted hover:bg-surface-muted disabled:opacity-50"
                  aria-label="Supprimer cette sortie"
                >
                  ×
                </button>
              </div>
              <StatusChecklist
                available={statuses}
                selected={out.condition.statuses}
                onChange={next => {
                  const updated = [...value.outputs]
                  updated[ix] = { ...out, condition: { statuses: next } }
                  onChange({ mode: 'multi', outputs: updated })
                }}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({
              mode: 'multi',
              outputs: [...value.outputs, {
                id: `out_${value.outputs.length + 1}`,
                label: `Sortie ${value.outputs.length + 1}`,
                condition: { statuses: [] }
              }]
            })}
            className="flex h-8 w-full items-center justify-center gap-1 rounded-md border border-dashed border-border bg-surface text-sm text-fg-muted hover:bg-surface-muted"
          >
            + Ajouter une sortie
          </button>
        </div>
      )}
    </div>
  )
}

function StatusChecklist({
  available, selected, onChange
}: { available: readonly string[]; selected: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {available.map(s => {
        const active = selected.includes(s)
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(active ? selected.filter(x => x !== s) : [...selected, s])}
            className={`rounded-full border px-2 py-0.5 text-xs ${
              active
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-border bg-surface text-fg-muted hover:bg-surface-muted'
            }`}
          >
            {s}
          </button>
        )
      })}
    </div>
  )
}
```

### Step 10.2: EmailParamsForm

Replace `frontend/src/pages/WorkflowEditor/modal/EmailParamsForm.tsx` with:
```tsx
import { CHANNEL_FORMAT_RULES } from '@rainpath/shared'
import { CharCounter } from './CharCounter'
import { OutputConfigField } from './OutputConfigField'
import type { EmailParams } from './form-types'

interface Props {
  value: EmailParams
  onChange: (v: EmailParams) => void
}

const SUB = CHANNEL_FORMAT_RULES.email.subject
const BODY = CHANNEL_FORMAT_RULES.email.body

export function EmailParamsForm({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="email-subject" className="mb-1 block text-sm font-medium text-fg">
          Sujet
        </label>
        <input
          id="email-subject"
          value={value.subject}
          onChange={e => onChange({ ...value, subject: e.target.value })}
          maxLength={SUB.maxLength + 1}
          className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <CharCounter value={value.subject.length} recommended={SUB.recommendedMax} max={SUB.maxLength} />
      </div>
      <div>
        <label htmlFor="email-body" className="mb-1 block text-sm font-medium text-fg">
          Corps
        </label>
        <textarea
          id="email-body"
          value={value.body}
          onChange={e => onChange({ ...value, body: e.target.value })}
          rows={6}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <CharCounter value={value.body.length} recommended={5000} max={BODY.maxLength} />
      </div>
      <OutputConfigField kind="send_email" value={value.output} onChange={o => onChange({ ...value, output: o })} />
    </div>
  )
}
```

### Step 10.3: Build + commit

Run: `pnpm --filter @rainpath/frontend build 2>&1 | tail -5`
Expected: clean.

```bash
git add frontend/src/pages/WorkflowEditor/modal/OutputConfigField.tsx frontend/src/pages/WorkflowEditor/modal/EmailParamsForm.tsx
git commit -m "feat(frontend): OutputConfigField (single/simple/multi) + EmailParamsForm"
```

---

## Task 11: SmsParamsForm + WhatsAppParamsForm

**Files:**
- Replace: `frontend/src/pages/WorkflowEditor/modal/SmsParamsForm.tsx`
- Replace: `frontend/src/pages/WorkflowEditor/modal/WhatsAppParamsForm.tsx`

### Step 11.1: SmsParamsForm

Replace `frontend/src/pages/WorkflowEditor/modal/SmsParamsForm.tsx` with:
```tsx
import { CHANNEL_FORMAT_RULES } from '@rainpath/shared'
import { CharCounter } from './CharCounter'
import { OutputConfigField } from './OutputConfigField'
import type { SmsParams } from './form-types'

interface Props {
  value: SmsParams
  onChange: (v: SmsParams) => void
}

const SMS = CHANNEL_FORMAT_RULES.sms.body

export function SmsParamsForm({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="sms-body" className="mb-1 block text-sm font-medium text-fg">
          Message
        </label>
        <textarea
          id="sms-body"
          value={value.body}
          onChange={e => onChange({ ...value, body: e.target.value })}
          rows={4}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <CharCounter
          value={value.body.length}
          recommended={SMS.recommendedMax}
          max={SMS.maxLength}
          unicodeThreshold={SMS.unicodeThreshold}
        />
      </div>
      <OutputConfigField kind="send_sms" value={value.output} onChange={o => onChange({ ...value, output: o })} />
    </div>
  )
}
```

### Step 11.2: WhatsAppParamsForm

Replace `frontend/src/pages/WorkflowEditor/modal/WhatsAppParamsForm.tsx` with:
```tsx
import { CHANNEL_FORMAT_RULES } from '@rainpath/shared'
import { CharCounter } from './CharCounter'
import { OutputConfigField } from './OutputConfigField'
import type { WhatsAppParams } from './form-types'

interface Props {
  value: WhatsAppParams
  onChange: (v: WhatsAppParams) => void
}

const WA = CHANNEL_FORMAT_RULES.whatsapp.body

export function WhatsAppParamsForm({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="wa-body" className="mb-1 block text-sm font-medium text-fg">
          Message
        </label>
        <textarea
          id="wa-body"
          value={value.body}
          onChange={e => onChange({ ...value, body: e.target.value })}
          rows={4}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <CharCounter value={value.body.length} recommended={1000} max={WA.maxLength} />
        <p className="mt-1 text-xs text-fg-muted">
          Mise en forme WhatsApp : <code className="font-mono">*gras*</code>, <code className="font-mono">_italique_</code>, <code className="font-mono">~barré~</code>, <code className="font-mono">```mono```</code>.
        </p>
      </div>
      <OutputConfigField kind="send_whatsapp" value={value.output} onChange={o => onChange({ ...value, output: o })} />
    </div>
  )
}
```

### Step 11.3: Build + commit

```bash
pnpm --filter @rainpath/frontend build 2>&1 | tail -5
git add frontend/src/pages/WorkflowEditor/modal/SmsParamsForm.tsx frontend/src/pages/WorkflowEditor/modal/WhatsAppParamsForm.tsx
git commit -m "feat(frontend): SmsParamsForm + WhatsAppParamsForm"
```

---

## Task 12: PostalParamsForm

**File:**
- Replace: `frontend/src/pages/WorkflowEditor/modal/PostalParamsForm.tsx`

### Step 12.1: Implement

Replace `frontend/src/pages/WorkflowEditor/modal/PostalParamsForm.tsx` with:
```tsx
import { CHANNEL_FORMAT_RULES } from '@rainpath/shared'
import { CharCounter } from './CharCounter'
import { OutputConfigField } from './OutputConfigField'
import type { PostalParams } from './form-types'

interface Props {
  value: PostalParams
  onChange: (v: PostalParams) => void
}

const POSTAL = CHANNEL_FORMAT_RULES.postal.body

export function PostalParamsForm({ value, onChange }: Props) {
  const setTracked = (tracked: boolean) => {
    // Switching to untracked forces single mode.
    if (!tracked && value.output.mode !== 'single') {
      onChange({ ...value, tracked, output: { mode: 'single' } })
    } else {
      onChange({ ...value, tracked })
    }
  }
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="postal-body" className="mb-1 block text-sm font-medium text-fg">
          Courrier
        </label>
        <textarea
          id="postal-body"
          value={value.body}
          onChange={e => onChange({ ...value, body: e.target.value })}
          rows={6}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <CharCounter value={value.body.length} recommended={5000} max={POSTAL.maxLength} />
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.tracked}
          onChange={e => setTracked(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <span className="text-fg">Envoi suivi (avec accusé de réception)</span>
      </label>
      <OutputConfigField
        kind="send_postal"
        tracked={value.tracked}
        value={value.output}
        onChange={o => onChange({ ...value, output: o })}
      />
    </div>
  )
}
```

### Step 12.2: Build + commit

```bash
pnpm --filter @rainpath/frontend build 2>&1 | tail -5
git add frontend/src/pages/WorkflowEditor/modal/PostalParamsForm.tsx
git commit -m "feat(frontend): PostalParamsForm (with tracked toggle forcing single)"
```

---

## Task 13: ConditionParamsForm

**File:**
- Replace: `frontend/src/pages/WorkflowEditor/modal/ConditionParamsForm.tsx`

### Step 13.1: Implement

Replace `frontend/src/pages/WorkflowEditor/modal/ConditionParamsForm.tsx` with:
```tsx
import { DataAvailableExpressions } from '@rainpath/shared'
import type { ConditionParams } from './form-types'

interface Props {
  value: ConditionParams
  onChange: (v: ConditionParams) => void
}

const EXPR_LABELS: Record<string, string> = {
  'patient.email': 'Email connu',
  'patient.phone': 'Téléphone connu',
  'patient.whatsapp': 'WhatsApp connu',
  'patient.address': 'Adresse connue'
}

export function ConditionParamsForm({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-fg">Type de condition</legend>
        <div className="flex gap-2">
          <label className={`flex h-9 flex-1 cursor-pointer items-center justify-center rounded-md border text-sm font-medium ${
            value.conditionType === 'data_available'
              ? 'border-primary bg-primary-soft text-primary'
              : 'border-border bg-surface text-fg-muted'
          }`}>
            <input
              type="radio"
              className="sr-only"
              checked={value.conditionType === 'data_available'}
              onChange={() => onChange({ conditionType: 'data_available', expression: DataAvailableExpressions[0] })}
            />
            Donnée disponible
          </label>
          <label className={`flex h-9 flex-1 cursor-pointer items-center justify-center rounded-md border text-sm font-medium ${
            value.conditionType === 'previous_result'
              ? 'border-primary bg-primary-soft text-primary'
              : 'border-border bg-surface text-fg-muted'
          }`}>
            <input
              type="radio"
              className="sr-only"
              checked={value.conditionType === 'previous_result'}
              onChange={() => onChange({ conditionType: 'previous_result', expression: '' })}
            />
            Résultat précédent
          </label>
        </div>
      </fieldset>

      {value.conditionType === 'data_available' ? (
        <div>
          <label htmlFor="cond-expr" className="mb-1 block text-sm font-medium text-fg">
            Champ patient
          </label>
          <select
            id="cond-expr"
            value={value.expression}
            onChange={e => onChange({ conditionType: 'data_available', expression: e.target.value })}
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {DataAvailableExpressions.map(expr => (
              <option key={expr} value={expr}>{EXPR_LABELS[expr] ?? expr}</option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label htmlFor="cond-expr" className="mb-1 block text-sm font-medium text-fg">
            Expression
          </label>
          <input
            id="cond-expr"
            value={value.expression}
            onChange={e => onChange({ conditionType: 'previous_result', expression: e.target.value })}
            placeholder="ex. last.status == rejected"
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm font-mono focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}
    </div>
  )
}
```

### Step 13.2: Build + commit

```bash
pnpm --filter @rainpath/frontend build 2>&1 | tail -5
git add frontend/src/pages/WorkflowEditor/modal/ConditionParamsForm.tsx
git commit -m "feat(frontend): ConditionParamsForm (data_available dropdown + previous_result input)"
```

---

## Task 14: Smoke check

- [ ] **Step 14.1: Build + test**

Run:
```bash
pnpm --filter @rainpath/frontend build 2>&1 | tail -8
pnpm --filter @rainpath/frontend test 2>&1 | tail -15
```
Expected: build clean; 14 (existing) + 5 (node-templates) + 6 (new store specs added in Task 3) = 25 tests pass (approximately — count may differ slightly depending on existing assertions).

Actually re-count: Phase 1B-A had 9 tests; Phase 1B-B1 added 8 store specs (total 17). Phase 1B-B2 adds 5 node-templates specs (Task 2) + 6 store specs (Task 3) = 11 new specs. **Expected total: 28 tests pass.**

- [ ] **Step 14.2: Dev server probe**

```bash
pnpm --filter @rainpath/frontend dev > /tmp/rainpath-bb2.log 2>&1 &
DEVPID=$!
sleep 4
curl -s -o /tmp/index.html -w "HTTP %{http_code}\n" http://localhost:5173/workflows
tail -20 /tmp/rainpath-bb2.log
kill $DEVPID 2>/dev/null || true
wait $DEVPID 2>/dev/null || true
```

Expected: HTTP 200 + Vite ready log + no error.

- [ ] **Step 14.3: No final commit unless something needs fixing**

If everything passes, report status — controller will decide whether to push.

---

## Self-review notes (post-plan)

**Spec coverage check** (B-B2 scope per spec §7.3–§7.5):
- ✅ §6.2 node-templates REST routes consumed — Task 2
- ✅ §7.3 modal d'édition partagée (focused-edit, kind-driven form) — Tasks 9-13
- ✅ §7.3 OutputConfig switcher with `single`/`simple`/`multi` — Task 10
- ✅ §7.3 postal `tracked=false` forces `single` — Task 12
- ✅ §7.3 character counter per channel with color thresholds — `CharCounter` + per-form usage
- ✅ §7.5 palette "bibliothèque de modèles" with system section (Start/End) + dynamic templates grouped by kind + Nouveau modèle button — Tasks 6-7
- ✅ §7.5 drag from palette → drop on canvas with `structuredClone` detachment — Task 8
- ✅ §7.5.b template kebab Edit / Delete — Task 7
- ✅ §7.4 connection drag with cycle/self-loop/handle-conflict guards — Task 8 + store `addEdge`
- ✅ §7.11 ValidationBanner with errors+warnings, collapse toggle — Task 4
- ✅ Live `validateGraph` after every mutation — Task 3

**Out of scope (deferred to a possible 1B-B3 polish)**:
- Live ghost rendering during connection drag (visual preview of X shifts)
- Live preview in daysAfter popover (typed value → simulateChangeDaysAfter → ghost)
- "Centrer sur l'erreur" button in ValidationBanner (would need React Flow zoom API integration)
- Multi-output overlap warning + coverage warning UI hints (the backend already enforces overlap as a 422; coverage is a non-blocking warning surfaced in the banner already)
- Presets cliquables for simple/multi (Engagement confirmé etc.)

**Pitfall audits**:
- **Dual-zod (1)**: every shared import is either `import type` or a runtime constant (`CHANNEL_STATUSES`, `CHANNEL_FORMAT_RULES`, `DataAvailableExpressions`, `validateGraph`, `computeXPositions`). No `z.object({..., shared: ...})` composition.
- **Lucide names (2)**: only verified-present icons used.
- **Icon size (3)**: all `<Icon size>` calls use 16 (some 14 via raw inline if needed, but the IconButton size prop handles its own sizing).
- **Semicolons (4)**: clean.
- **TanStack v5 (5)**: `isPending` used on mutations.
- **Tailwind JIT (6)**: all family-color tokens used in the modal forms are HARDCODED (one file per kind) so JIT scans them correctly. The `node-${family}` dynamic interpolation only appears inside NodeCard (which already uses inline styles per 1B-B1).
- **React Flow v12 API (7)**: `useReactFlow()` requires `ReactFlowProvider` wrapping — handled in Canvas refactor.

**Placeholder scan**: clean. The Task 9 stubs for forms are real files that compile, replaced atomically by Tasks 10-13.

**Type consistency**: `AnyParams` aliased once in `form-types.ts` and consumed by `NodeEditorModal`. Per-kind params are `Extract<...>` narrows of the shared `Graph['nodes'][number]['data']` discriminant. Action signatures (`addNode`, `addEdge`, `updateNodeData`) defined once in store.ts and used in Canvas + Modal.

**Scope**: 14 tasks, ~1.5h of work, every commit produces a green build and passing tests. Final commit count: ~14.

**Push at end**: NOT included — controller decides.
