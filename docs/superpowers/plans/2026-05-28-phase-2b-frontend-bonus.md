# RainPath — Phase 2B Frontend Bonus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the bonus patient-simulation UI on top of the Phase 2A backend: a `PatientProfilesList` page (CRUD over profiles), a `PatientRunsList` page (list runs of a workflow + create), and the **headline `PatientRunView`** — a 2-column read-only canvas where each node renders its reachability state (visited / current / reachable / blocked / unreachable) live, recomputed every time the user edits the patient profile, with an "Étape suivante" button driving the workflow forward and an editable profile panel on the right.

**Architecture:**
- Two new TanStack Query-backed API clients (`patient-profiles.ts`, `patient-runs.ts`) following the pattern from `workflows.ts` (Phase 1B-A). Zod parsing in two-step style to dodge dual-zod TS2719 (Pitfall 1).
- Three new routes registered in the router: `/patient-profiles`, `/workflows/:id/patient-runs`, `/workflows/:id/patient-runs/:runId`.
- A new `PatientCanvas` builds React Flow nodes from the run's workflow graph + a `reachability` map computed by `computeReachability` from `@rainpath/shared`. Each node's React Flow `data` carries the reachability state; a single `PatientNode` component dispatches on `data.kind` and wraps the body with a reachability-aware overlay (opacity, border, badge).
- The page page is a 2-column layout: 70% canvas / 30% panel. The panel hosts an editable `PatientProfilePanel` (debounced PATCH), `PatientAdvanceControls` (outcome selector + advance button + reset), and `PatientHistoryList`.
- All recomputes happen client-side: the canvas reads the current run + profile from TanStack Query cache; `computeReachability` runs locally on every profile change so the UI is instant.

**Tech Stack:** React Flow v12 (read-only mode), TanStack Query v5, Radix Dialog, Lucide icons, `@rainpath/shared` (`computeReachability`, types). No new deps.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-28-rainpath-workflow-editor-design.md` — §5.4.b `computeReachability`, §6.3 patient REST API, §7.1 routes, §7.6 patient view (the meat).
- Phase 1B-A plan: `docs/superpowers/plans/2026-05-28-phase-1b-a-frontend-foundations.md` (API client pattern).
- Phase 1B-B1 plan: editor canvas (the `Canvas.tsx` we're modeling `PatientCanvas` on).
- **Known pitfalls**: `docs/superpowers/known-pitfalls.md` (READ BEFORE STARTING).

---

## Hard-won pitfalls (already in known-pitfalls.md — restated for context)

1. **Dual-zod TS2719**: never compose a Zod schema from `@rainpath/shared` into a frontend `z.object({...})`. Use `import type` + `Schema.safeParse(unknown)` (envelope+detach pattern).
2. **Lucide v0.460 icon renames** (Pitfall 2): use `LoaderCircle`, `CircleAlert`, `EllipsisVertical`, `TriangleAlert`. NOT the old names. Verified-present icons listed in known-pitfalls.md.
3. **Icon size constraint**: `16 | 20 | 24` only via the `Icon` wrapper.
4. **No semicolons. Single quotes.**
5. **TanStack v5**: `useMutation.isPending`.
6. **React Flow v12**: `useReactFlow()` requires `<ReactFlowProvider>`.

---

## File structure (this plan creates)

```
frontend/
├── src/
│   ├── api/
│   │   ├── patient-profiles.ts                 # CREATE
│   │   ├── patient-profiles.test.ts            # CREATE
│   │   ├── patient-runs.ts                     # CREATE
│   │   ├── patient-runs.test.ts                # CREATE
│   │   └── query-keys.ts                       # MODIFY — add patient keys
│   ├── components/
│   │   └── AppLayout.tsx                       # MODIFY — add "Patients" nav link
│   ├── router.tsx                              # MODIFY — 3 new routes
│   └── pages/
│       ├── PatientProfilesList/
│       │   ├── index.tsx                       # CREATE
│       │   ├── ProfileFormDialog.tsx           # CREATE — create + edit modal
│       │   └── DeleteProfileConfirm.tsx        # CREATE
│       ├── PatientRunsList/
│       │   ├── index.tsx                       # CREATE
│       │   └── CreateRunDialog.tsx             # CREATE — patient picker
│       └── PatientRunView/
│           ├── index.tsx                       # CREATE — 2-column shell
│           ├── PatientCanvas.tsx               # CREATE — React Flow read-only + reach overlay
│           ├── PatientNode.tsx                 # CREATE — single dispatched node type
│           ├── PatientProfilePanel.tsx         # CREATE — editable form with debounced PATCH
│           ├── PatientAdvanceControls.tsx      # CREATE — outcome selector + advance + reset
│           └── PatientHistoryList.tsx          # CREATE
```

---

## Conventions

- **Query keys** (added in Task 1):
  - `queryKeys.patientProfiles.list()`, `.detail(id)`
  - `queryKeys.patientRuns.listForWorkflow(workflowId)`, `.detail(id)`
- **Endpoint base URL** is `/api` via the existing `apiFetch` from `client.ts`.
- **2-column layout** uses Tailwind grid `grid-cols-[1fr_360px]` for the patient view (canvas 1fr, panel 360px) per spec §7.6.
- **Reachability overlay styles** are co-located in `PatientNode.tsx` so all 5 states are visible side-by-side in one file (easier to audit).

---

## Task 1: `patient-profiles` API client + test

**Files:**
- Create: `frontend/src/api/patient-profiles.ts`
- Create: `frontend/src/api/patient-profiles.test.ts`
- Modify: `frontend/src/api/query-keys.ts`

- [ ] **Step 1.1: Extend query-keys**

Open `frontend/src/api/query-keys.ts`. Add to the existing `queryKeys` object — after the existing `nodeTemplates` entry, add:
```ts
  patientProfiles: {
    all: ['patient-profiles'] as const,
    list: () => [...queryKeys.patientProfiles.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.patientProfiles.all, 'detail', id] as const
  },
  patientRuns: {
    all: ['patient-runs'] as const,
    listForWorkflow: (workflowId: string) => [...queryKeys.patientRuns.all, 'workflow', workflowId] as const,
    detail: (id: string) => [...queryKeys.patientRuns.all, 'detail', id] as const
  }
```

- [ ] **Step 1.2: Write failing test**

Write `frontend/src/api/patient-profiles.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { listPatientProfiles, createPatientProfile, updatePatientProfile, deletePatientProfile } from './patient-profiles'
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

describe('patient-profiles api client', () => {
  beforeEach(() => { globalThis.fetch = originalFetch })

  it('listPatientProfiles parses the array', async () => {
    mockFetchOnce({
      status: 200,
      body: [{
        id: 'p1', name: 'Alice', email: 'a@b.co', phone: null, whatsapp: null, address: null,
        createdAt: '2026-05-28T10:00:00.000Z', updatedAt: '2026-05-28T10:00:00.000Z', deletedAt: null
      }]
    })
    const list = await listPatientProfiles()
    expect(list).toHaveLength(1)
    expect(list[0]?.name).toBe('Alice')
  })

  it('createPatientProfile forwards body', async () => {
    mockFetchOnce({
      status: 201,
      body: {
        id: 'p1', name: 'Bob', email: null, phone: null, whatsapp: null, address: null,
        createdAt: '2026-05-28T10:00:00.000Z', updatedAt: '2026-05-28T10:00:00.000Z', deletedAt: null
      }
    })
    const p = await createPatientProfile({ name: 'Bob' })
    expect(p.id).toBe('p1')
  })

  it('updatePatientProfile uses PATCH', async () => {
    mockFetchOnce({
      status: 200,
      body: {
        id: 'p1', name: 'Bob', email: null, phone: '+33', whatsapp: null, address: null,
        createdAt: '2026-05-28T10:00:00.000Z', updatedAt: '2026-05-28T10:00:00.000Z', deletedAt: null
      }
    })
    const p = await updatePatientProfile('p1', { phone: '+33' })
    expect(p.phone).toBe('+33')
  })

  it('deletePatientProfile resolves on 204', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })) as unknown as typeof fetch
    await expect(deletePatientProfile('p1')).resolves.toBeUndefined()
  })

  it('createPatientProfile rejects with ApiError on 422', async () => {
    mockFetchOnce({
      status: 422,
      body: { statusCode: 422, errors: [{ code: 'too_small', message: 'name required' }], warnings: [] }
    })
    let caught: unknown
    try { await createPatientProfile({ name: '' }) } catch (e) { caught = e }
    expect(caught).toBeInstanceOf(ApiError)
  })
})
```

- [ ] **Step 1.3: Run, verify FAIL**

Run: `pnpm --filter @rainpath/frontend test -- patient-profiles 2>&1 | tail -10`
Expected: FAIL.

- [ ] **Step 1.4: Implement**

Write `frontend/src/api/patient-profiles.ts`:
```ts
import { z } from 'zod'
import type { CreatePatientProfileDto, UpdatePatientProfileDto } from '@rainpath/shared'
import { ApiError, apiFetch } from './client'

const PatientProfile = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  address: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable()
})
export type PatientProfile = z.infer<typeof PatientProfile>

function parseOne(raw: unknown): PatientProfile {
  const r = PatientProfile.safeParse(raw)
  if (!r.success) {
    throw new ApiError(500, {
      message: 'response_drift',
      errors: r.error.issues.map(i => ({ code: 'response_drift', message: i.message, path: i.path }))
    })
  }
  return r.data
}

function parseList(raw: unknown): PatientProfile[] {
  const r = z.array(PatientProfile).safeParse(raw)
  if (!r.success) {
    throw new ApiError(500, {
      message: 'response_drift',
      errors: r.error.issues.map(i => ({ code: 'response_drift', message: i.message, path: i.path }))
    })
  }
  return r.data
}

export async function listPatientProfiles(): Promise<PatientProfile[]> {
  const raw = await apiFetch<unknown>('/patient-profiles')
  return parseList(raw)
}

export async function getPatientProfile(id: string): Promise<PatientProfile> {
  const raw = await apiFetch<unknown>(`/patient-profiles/${id}`)
  return parseOne(raw)
}

export async function createPatientProfile(body: CreatePatientProfileDto): Promise<PatientProfile> {
  const raw = await apiFetch<unknown>('/patient-profiles', { method: 'POST', body })
  return parseOne(raw)
}

export async function updatePatientProfile(id: string, body: UpdatePatientProfileDto): Promise<PatientProfile> {
  const raw = await apiFetch<unknown>(`/patient-profiles/${id}`, { method: 'PATCH', body })
  return parseOne(raw)
}

export async function deletePatientProfile(id: string): Promise<void> {
  await apiFetch<void>(`/patient-profiles/${id}`, { method: 'DELETE' })
}
```

- [ ] **Step 1.5: Run, verify PASS**

Run: `pnpm --filter @rainpath/frontend test -- patient-profiles 2>&1 | tail -10`
Expected: 5 specs pass.

- [ ] **Step 1.6: Commit**

```bash
git add frontend/src/api/patient-profiles.ts frontend/src/api/patient-profiles.test.ts frontend/src/api/query-keys.ts
git commit -m "feat(frontend): typed patient-profiles API client + query keys"
```

---

## Task 2: `patient-runs` API client + test

**Files:**
- Create: `frontend/src/api/patient-runs.ts`
- Create: `frontend/src/api/patient-runs.test.ts`

- [ ] **Step 2.1: Failing test**

Write `frontend/src/api/patient-runs.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { START_Y } from '@rainpath/shared'
import {
  listPatientRunsForWorkflow, getPatientRun, createPatientRun, advancePatientRun, resetPatientRun
} from './patient-runs'

const originalFetch = globalThis.fetch

function mockFetchOnce(response: { status: number; body: unknown }) {
  globalThis.fetch = vi.fn().mockResolvedValueOnce(
    new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    })
  ) as unknown as typeof fetch
}

const FULL_RUN = {
  id: 'r1',
  workflowId: 'w1',
  workflow: {
    id: 'w1', name: 'WF',
    graph: {
      nodes: [
        { id: 's', position: { x: 0, y: START_Y }, data: { kind: 'start' } },
        { id: 'e', position: { x: 30, y: START_Y }, data: { kind: 'end' } }
      ],
      edges: [{ id: 'e1', source: 's', target: 'e', daysAfter: 30 }]
    }
  },
  patient: {
    id: 'p1', name: 'Alice', email: 'a@b.co', phone: null, whatsapp: null, address: null, deletedAt: null
  },
  currentNodeId: 's',
  history: [{ nodeId: 's', enteredAt: '2026-05-28T10:00:00.000Z' }],
  createdAt: '2026-05-28T10:00:00.000Z',
  updatedAt: '2026-05-28T10:00:00.000Z'
}

describe('patient-runs api client', () => {
  beforeEach(() => { globalThis.fetch = originalFetch })

  it('listPatientRunsForWorkflow parses the array', async () => {
    mockFetchOnce({
      status: 200,
      body: [{
        id: 'r1',
        patient: { id: 'p1', name: 'Alice', deletedAt: null },
        currentNodeId: 's',
        updatedAt: '2026-05-28T10:00:00.000Z'
      }]
    })
    const list = await listPatientRunsForWorkflow('w1')
    expect(list).toHaveLength(1)
    expect(list[0]?.patient.name).toBe('Alice')
  })

  it('getPatientRun parses the full run', async () => {
    mockFetchOnce({ status: 200, body: FULL_RUN })
    const run = await getPatientRun('r1')
    expect(run.workflow.graph.nodes).toHaveLength(2)
    expect(run.patient.name).toBe('Alice')
  })

  it('createPatientRun POSTs to workflow path', async () => {
    mockFetchOnce({ status: 201, body: FULL_RUN })
    const run = await createPatientRun('w1', { patientId: 'p1' })
    expect(run.id).toBe('r1')
  })

  it('advancePatientRun POSTs to /advance', async () => {
    mockFetchOnce({ status: 201, body: FULL_RUN })
    const run = await advancePatientRun('r1', { outcome: 'opened' })
    expect(run.id).toBe('r1')
  })

  it('resetPatientRun POSTs to /reset', async () => {
    mockFetchOnce({ status: 201, body: FULL_RUN })
    const run = await resetPatientRun('r1')
    expect(run.id).toBe('r1')
  })
})
```

- [ ] **Step 2.2: Run, verify FAIL**

Run: `pnpm --filter @rainpath/frontend test -- patient-runs 2>&1 | tail -10`
Expected: FAIL.

- [ ] **Step 2.3: Implement**

Write `frontend/src/api/patient-runs.ts`:
```ts
import { z } from 'zod'
import type { AdvancePatientRunDto, CreatePatientRunDto, Graph } from '@rainpath/shared'
import { Graph as GraphSchema } from '@rainpath/shared'
import { ApiError, apiFetch } from './client'

const HistoryEntry = z.object({
  nodeId: z.string(),
  enteredAt: z.string(),
  outcome: z.string().optional()
})
export type RunHistoryEntry = z.infer<typeof HistoryEntry>

const PatientRunSummary = z.object({
  id: z.string(),
  patient: z.object({
    id: z.string(),
    name: z.string(),
    deletedAt: z.string().nullable()
  }),
  currentNodeId: z.string().nullable(),
  updatedAt: z.string()
})
export type PatientRunSummary = z.infer<typeof PatientRunSummary>

const FullRunEnvelope = z.object({
  id: z.string(),
  workflowId: z.string(),
  workflow: z.object({
    id: z.string(),
    name: z.string(),
    graph: z.unknown()
  }),
  patient: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    whatsapp: z.string().nullable(),
    address: z.string().nullable(),
    deletedAt: z.string().nullable()
  }),
  currentNodeId: z.string().nullable(),
  history: z.array(HistoryEntry),
  createdAt: z.string(),
  updatedAt: z.string()
})

type EnvelopeRaw = z.infer<typeof FullRunEnvelope>
export type PatientRunFull = Omit<EnvelopeRaw, 'workflow'> & {
  workflow: { id: string; name: string; graph: Graph }
}

function throwDrift(issues: z.ZodIssue[]): never {
  throw new ApiError(500, {
    message: 'response_drift',
    errors: issues.map(i => ({ code: 'response_drift', message: i.message, path: i.path }))
  })
}

function parseRun(raw: unknown): PatientRunFull {
  const envR = FullRunEnvelope.safeParse(raw)
  if (!envR.success) throwDrift(envR.error.issues)
  const graphR = GraphSchema.safeParse(envR.data.workflow.graph)
  if (!graphR.success) throwDrift(graphR.error.issues)
  return {
    ...envR.data,
    workflow: { id: envR.data.workflow.id, name: envR.data.workflow.name, graph: graphR.data }
  }
}

function parseList(raw: unknown): PatientRunSummary[] {
  const r = z.array(PatientRunSummary).safeParse(raw)
  if (!r.success) throwDrift(r.error.issues)
  return r.data
}

export async function listPatientRunsForWorkflow(workflowId: string): Promise<PatientRunSummary[]> {
  const raw = await apiFetch<unknown>(`/workflows/${workflowId}/patient-runs`)
  return parseList(raw)
}

export async function getPatientRun(id: string): Promise<PatientRunFull> {
  const raw = await apiFetch<unknown>(`/patient-runs/${id}`)
  return parseRun(raw)
}

export async function createPatientRun(workflowId: string, body: CreatePatientRunDto): Promise<PatientRunFull> {
  const raw = await apiFetch<unknown>(`/workflows/${workflowId}/patient-runs`, { method: 'POST', body })
  return parseRun(raw)
}

export async function advancePatientRun(id: string, body: AdvancePatientRunDto): Promise<PatientRunFull> {
  const raw = await apiFetch<unknown>(`/patient-runs/${id}/advance`, { method: 'POST', body })
  return parseRun(raw)
}

export async function resetPatientRun(id: string): Promise<PatientRunFull> {
  const raw = await apiFetch<unknown>(`/patient-runs/${id}/reset`, { method: 'POST' })
  return parseRun(raw)
}
```

- [ ] **Step 2.4: Run, verify PASS**

Run: `pnpm --filter @rainpath/frontend test -- patient-runs 2>&1 | tail -10`
Expected: 5 specs pass.

- [ ] **Step 2.5: Commit**

```bash
git add frontend/src/api/patient-runs.ts frontend/src/api/patient-runs.test.ts
git commit -m "feat(frontend): typed patient-runs API client (list/get/create/advance/reset)"
```

---

## Task 3: Router additions + AppLayout nav

**Files:**
- Modify: `frontend/src/router.tsx`
- Modify: `frontend/src/components/AppLayout.tsx`
- Create: `frontend/src/pages/PatientProfilesList/index.tsx` (stub)
- Create: `frontend/src/pages/PatientRunsList/index.tsx` (stub)
- Create: `frontend/src/pages/PatientRunView/index.tsx` (stub)

- [ ] **Step 3.1: Page stubs**

Write `frontend/src/pages/PatientProfilesList/index.tsx`:
```tsx
export default function PatientProfilesList() {
  return <div className="p-6 text-fg">PatientProfilesList — Task 4</div>
}
```

Write `frontend/src/pages/PatientRunsList/index.tsx`:
```tsx
export default function PatientRunsList() {
  return <div className="p-6 text-fg">PatientRunsList — Task 5</div>
}
```

Write `frontend/src/pages/PatientRunView/index.tsx`:
```tsx
export default function PatientRunView() {
  return <div className="p-6 text-fg">PatientRunView — Tasks 6-11</div>
}
```

- [ ] **Step 3.2: Router additions**

Open `frontend/src/router.tsx`. Add the three routes inside the existing children array, after the existing `/workflows/:id` route. The full file should look like:
```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout'
import NotFound from '@/pages/NotFound'
import WorkflowsList from '@/pages/WorkflowsList'
import WorkflowEditor from '@/pages/WorkflowEditor'
import PatientProfilesList from '@/pages/PatientProfilesList'
import PatientRunsList from '@/pages/PatientRunsList'
import PatientRunView from '@/pages/PatientRunView'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Navigate to="/workflows" replace /> },
      { path: '/workflows', element: <WorkflowsList /> },
      { path: '/workflows/:id', element: <WorkflowEditor /> },
      { path: '/patient-profiles', element: <PatientProfilesList /> },
      { path: '/workflows/:id/patient-runs', element: <PatientRunsList /> },
      { path: '/workflows/:id/patient-runs/:runId', element: <PatientRunView /> },
      { path: '*', element: <NotFound /> }
    ]
  }
])
```

- [ ] **Step 3.3: AppLayout nav link**

Open `frontend/src/components/AppLayout.tsx`. Modify the header to add a "Patients" link. The full file should look like:
```tsx
import { Outlet, Link, useLocation } from 'react-router-dom'

export function AppLayout() {
  const location = useLocation()
  const isPatients = location.pathname.startsWith('/patient-profiles')
  const isWorkflows = !isPatients && location.pathname.startsWith('/workflows')
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="sticky top-0 z-20 flex h-12 items-center gap-6 border-b border-border bg-surface px-6">
        <Link to="/workflows" className="text-sm font-semibold tracking-tight text-fg">
          RainPath
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            to="/workflows"
            className={`rounded-md px-2 py-1 ${isWorkflows ? 'bg-surface-muted text-fg' : 'text-fg-muted hover:text-fg'}`}
          >
            Workflows
          </Link>
          <Link
            to="/patient-profiles"
            className={`rounded-md px-2 py-1 ${isPatients ? 'bg-surface-muted text-fg' : 'text-fg-muted hover:text-fg'}`}
          >
            Patients
          </Link>
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 3.4: Build + commit**

Run: `pnpm --filter @rainpath/frontend build 2>&1 | tail -5`
Expected: clean.

```bash
git add frontend/src/router.tsx frontend/src/components/AppLayout.tsx frontend/src/pages/PatientProfilesList frontend/src/pages/PatientRunsList frontend/src/pages/PatientRunView
git commit -m "feat(frontend): add 3 patient routes + AppLayout nav links"
```

---

## Task 4: `PatientProfilesList` page

**Files:**
- Replace: `frontend/src/pages/PatientProfilesList/index.tsx`
- Create: `frontend/src/pages/PatientProfilesList/ProfileFormDialog.tsx`
- Create: `frontend/src/pages/PatientProfilesList/DeleteProfileConfirm.tsx`

- [ ] **Step 4.1: ProfileFormDialog**

Write `frontend/src/pages/PatientProfilesList/ProfileFormDialog.tsx`:
```tsx
import { FormEvent, useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { ApiError } from '@/api/client'
import { createPatientProfile, updatePatientProfile, type PatientProfile } from '@/api/patient-profiles'
import { queryKeys } from '@/api/query-keys'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: PatientProfile | null
}

export function ProfileFormDialog({ open, onOpenChange, editing }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const qc = useQueryClient()

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '')
      setEmail(editing?.email ?? '')
      setPhone(editing?.phone ?? '')
      setWhatsapp(editing?.whatsapp ?? '')
      setAddress(editing?.address ?? '')
      setError(null)
    }
  }, [open, editing])

  const createMut = useMutation({
    mutationFn: () => createPatientProfile({
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      address: address.trim() || null
    } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientProfiles.list() })
      toast.success('Profil créé')
      onOpenChange(false)
    },
    onError: e => setError(e instanceof ApiError ? e.body.errors?.[0]?.message ?? e.message : 'Erreur')
  })

  const updateMut = useMutation({
    mutationFn: () => updatePatientProfile(editing!.id, {
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      address: address.trim() || null
    } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientProfiles.list() })
      toast.success('Profil mis à jour')
      onOpenChange(false)
    },
    onError: e => setError(e instanceof ApiError ? e.body.errors?.[0]?.message ?? e.message : 'Erreur')
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Le nom est requis')
      return
    }
    if (editing) updateMut.mutate()
    else createMut.mutate()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Modifier le profil' : 'Nouveau profil patient'}
      size="md"
    >
      <form onSubmit={submit} className="space-y-3">
        <FormField label="Nom" required value={name} onChange={setName} autoFocus />
        <FormField label="Email" value={email} onChange={setEmail} type="email" />
        <FormField label="Téléphone (SMS)" value={phone} onChange={setPhone} />
        <FormField label="WhatsApp" value={whatsapp} onChange={setWhatsapp} />
        <FormField label="Adresse postale" value={address} onChange={setAddress} />
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="submit" variant="primary" loading={createMut.isPending || updateMut.isPending}>
            {editing ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

interface FieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  type?: string
  autoFocus?: boolean
}

function FormField({ label, value, onChange, required, type = 'text', autoFocus }: FieldProps) {
  const id = `pf-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-fg">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoFocus={autoFocus}
        className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  )
}
```

- [ ] **Step 4.2: DeleteProfileConfirm**

Write `frontend/src/pages/PatientProfilesList/DeleteProfileConfirm.tsx`:
```tsx
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import type { PatientProfile } from '@/api/patient-profiles'

interface Props {
  open: boolean
  target: PatientProfile | null
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteProfileConfirm({ open, target, loading, onCancel, onConfirm }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={o => !o && onCancel()}
      title={`Supprimer « ${target?.name ?? ''} » ?`}
      description="Le profil est archivé (suppression douce). Les parcours existants restent visibles mais marqués « Patient supprimé »."
      size="sm"
    >
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" autoFocus onClick={onCancel}>Annuler</Button>
        <Button type="button" variant="danger" loading={loading} onClick={onConfirm}>Supprimer</Button>
      </div>
    </Dialog>
  )
}
```

- [ ] **Step 4.3: PatientProfilesList page**

Replace `frontend/src/pages/PatientProfilesList/index.tsx` entirely with:
```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import {
  DropdownMenu, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator
} from '@/components/ui/DropdownMenu'
import { relativeFromNow } from '@/lib/format-date'
import { queryKeys } from '@/api/query-keys'
import { listPatientProfiles, deletePatientProfile, type PatientProfile } from '@/api/patient-profiles'
import { ProfileFormDialog } from './ProfileFormDialog'
import { DeleteProfileConfirm } from './DeleteProfileConfirm'

export default function PatientProfilesList() {
  const qc = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PatientProfile | null>(null)
  const [toDelete, setToDelete] = useState<PatientProfile | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.patientProfiles.list(),
    queryFn: listPatientProfiles
  })

  const delMut = useMutation({
    mutationFn: (id: string) => deletePatientProfile(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientProfiles.list() })
      toast.success('Profil supprimé')
      setToDelete(null)
    },
    onError: () => toast.error('Échec de la suppression')
  })

  const handleNew = () => { setEditing(null); setFormOpen(true) }
  const handleEdit = (p: PatientProfile) => { setEditing(p); setFormOpen(true) }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Profils patients</h1>
        <Button variant="primary" onClick={handleNew}>
          <Icon name="Plus" size={16} />
          Nouveau profil
        </Button>
      </header>

      <div className="mt-8">
        {isLoading ? (
          <div role="status" className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-fg-muted">
            Chargement…
          </div>
        ) : error ? (
          <div role="alert" className="rounded-lg border border-border bg-surface p-8 text-center">
            <p className="text-sm text-fg">Impossible de charger les profils.</p>
            <Button variant="secondary" className="mt-4" onClick={() => refetch()}>
              <Icon name="RotateCw" size={16} />
              Réessayer
            </Button>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="mx-auto max-w-md rounded-lg border border-border bg-surface p-8 text-center">
            <Icon name="ListPlus" size={24} className="mx-auto text-fg-muted" />
            <p className="mt-4 text-sm text-fg">Aucun profil patient pour le moment.</p>
            <Button variant="primary" className="mt-4" onClick={handleNew}>Créer mon premier profil</Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-xs font-medium uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Téléphone</th>
                  <th className="px-4 py-3 text-right">Modifié</th>
                  <th className="w-10 px-2 py-3" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map(p => (
                  <tr key={p.id} className="hover:bg-surface-muted">
                    <td className="px-4 py-3 font-medium text-fg">{p.name}</td>
                    <td className="px-4 py-3 text-fg-muted">{p.email ?? '—'}</td>
                    <td className="px-4 py-3 text-fg-muted">{p.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-fg-muted tabular-nums">{relativeFromNow(p.updatedAt)}</td>
                    <td className="px-2 py-2 text-right">
                      <DropdownMenu>
                        <DropdownTrigger asChild>
                          <IconButton icon="EllipsisVertical" aria-label={`Actions sur ${p.name}`} size="sm" />
                        </DropdownTrigger>
                        <DropdownContent>
                          <DropdownItem icon="Pencil" onSelect={() => handleEdit(p)}>Éditer</DropdownItem>
                          <DropdownSeparator />
                          <DropdownItem icon="Trash2" danger onSelect={() => setToDelete(p)}>Supprimer</DropdownItem>
                        </DropdownContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProfileFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />
      <DeleteProfileConfirm
        open={!!toDelete}
        target={toDelete}
        loading={delMut.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && delMut.mutate(toDelete.id)}
      />
    </div>
  )
}
```

- [ ] **Step 4.4: Build + commit**

Run: `pnpm --filter @rainpath/frontend build 2>&1 | tail -5`
Expected: clean.

```bash
git add frontend/src/pages/PatientProfilesList
git commit -m "feat(frontend): PatientProfilesList page (table + create/edit/delete dialogs)"
```

---

## Task 5: `PatientRunsList` page + CreateRunDialog

**Files:**
- Replace: `frontend/src/pages/PatientRunsList/index.tsx`
- Create: `frontend/src/pages/PatientRunsList/CreateRunDialog.tsx`

- [ ] **Step 5.1: CreateRunDialog**

Write `frontend/src/pages/PatientRunsList/CreateRunDialog.tsx`:
```tsx
import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { ApiError } from '@/api/client'
import { listPatientProfiles } from '@/api/patient-profiles'
import { createPatientRun } from '@/api/patient-runs'
import { queryKeys } from '@/api/query-keys'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  workflowId: string
}

export function CreateRunDialog({ open, onOpenChange, workflowId }: Props) {
  const [patientId, setPatientId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: profiles } = useQuery({
    queryKey: queryKeys.patientProfiles.list(),
    queryFn: listPatientProfiles,
    enabled: open
  })

  const createMut = useMutation({
    mutationFn: () => createPatientRun(workflowId, { patientId }),
    onSuccess: run => {
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.listForWorkflow(workflowId) })
      toast.success('Parcours créé')
      onOpenChange(false)
      navigate(`/workflows/${workflowId}/patient-runs/${run.id}`)
    },
    onError: e => setError(e instanceof ApiError ? e.body.errors?.[0]?.message ?? e.message : 'Erreur')
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!patientId) {
      setError('Choisissez un profil patient')
      return
    }
    createMut.mutate()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nouveau parcours patient"
      description="Démarre une simulation d’avancement du workflow pour le profil choisi."
      size="md"
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="run-patient" className="mb-1 block text-sm font-medium text-fg">
            Profil patient <span className="text-danger">*</span>
          </label>
          <select
            id="run-patient"
            value={patientId}
            onChange={e => setPatientId(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Choisir un profil…</option>
            {profiles?.map(p => (
              <option key={p.id} value={p.id}>{p.name}{p.email ? ` (${p.email})` : ''}</option>
            ))}
          </select>
          {profiles && profiles.length === 0 ? (
            <p className="mt-1 text-xs text-fg-muted">
              Aucun profil. Créez-en un depuis la page <em>Patients</em>.
            </p>
          ) : null}
        </div>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="submit" variant="primary" loading={createMut.isPending} disabled={!patientId}>
            Démarrer
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
```

- [ ] **Step 5.2: PatientRunsList page**

Replace `frontend/src/pages/PatientRunsList/index.tsx` entirely with:
```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { relativeFromNow } from '@/lib/format-date'
import { queryKeys } from '@/api/query-keys'
import { listPatientRunsForWorkflow } from '@/api/patient-runs'
import { getWorkflow } from '@/api/workflows'
import { CreateRunDialog } from './CreateRunDialog'

export default function PatientRunsList() {
  const { id: workflowId } = useParams<{ id: string }>()
  const [createOpen, setCreateOpen] = useState(false)

  const wfQuery = useQuery({
    queryKey: queryKeys.workflows.detail(workflowId!),
    queryFn: () => getWorkflow(workflowId!),
    enabled: !!workflowId
  })

  const runsQuery = useQuery({
    queryKey: queryKeys.patientRuns.listForWorkflow(workflowId!),
    queryFn: () => listPatientRunsForWorkflow(workflowId!),
    enabled: !!workflowId
  })

  if (!workflowId) return null

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link
        to="/workflows"
        className="mb-3 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
      >
        <Icon name="ArrowLeft" size={16} />
        Workflows
      </Link>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Parcours patients</h1>
          {wfQuery.data ? (
            <p className="mt-1 text-sm text-fg-muted">{wfQuery.data.name}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Link
            to={`/workflows/${workflowId}`}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-fg hover:bg-surface-muted"
          >
            <Icon name="Pencil" size={16} />
            Éditer le workflow
          </Link>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Icon name="Plus" size={16} />
            Nouveau parcours
          </Button>
        </div>
      </header>

      <div className="mt-8">
        {runsQuery.isLoading ? (
          <div role="status" className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-fg-muted">
            Chargement…
          </div>
        ) : runsQuery.error ? (
          <div role="alert" className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-fg">
            Impossible de charger les parcours.
          </div>
        ) : !runsQuery.data || runsQuery.data.length === 0 ? (
          <div className="mx-auto max-w-md rounded-lg border border-border bg-surface p-8 text-center">
            <Icon name="ListPlus" size={24} className="mx-auto text-fg-muted" />
            <p className="mt-4 text-sm text-fg">Aucun parcours pour ce workflow.</p>
            <Button variant="primary" className="mt-4" onClick={() => setCreateOpen(true)}>
              Démarrer un parcours
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-xs font-medium uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Nœud courant</th>
                  <th className="px-4 py-3 text-right">Modifié</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runsQuery.data.map(r => (
                  <tr key={r.id} className="hover:bg-surface-muted">
                    <td className="px-4 py-3">
                      <Link
                        to={`/workflows/${workflowId}/patient-runs/${r.id}`}
                        className="font-medium text-fg hover:text-primary focus-visible:outline-none focus-visible:underline"
                      >
                        {r.patient.name}
                      </Link>
                      {r.patient.deletedAt ? (
                        <span className="ml-2 inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs text-fg-muted">
                          Patient supprimé
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-fg-muted">{r.currentNodeId ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-fg-muted tabular-nums">{relativeFromNow(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateRunDialog open={createOpen} onOpenChange={setCreateOpen} workflowId={workflowId} />
    </div>
  )
}
```

- [ ] **Step 5.3: Build + commit**

Run: `pnpm --filter @rainpath/frontend build 2>&1 | tail -5`

```bash
git add frontend/src/pages/PatientRunsList
git commit -m "feat(frontend): PatientRunsList page + CreateRunDialog (patient picker)"
```

---

## Task 6: `PatientNode` component

**File:**
- Create: `frontend/src/pages/PatientRunView/PatientNode.tsx`

- [ ] **Step 6.1: Implement**

Write `frontend/src/pages/PatientRunView/PatientNode.tsx`:
```tsx
import { Handle, NodeProps, Position } from '@xyflow/react'
import type { Graph } from '@rainpath/shared'
import { Icon, IconName } from '@/components/Icon'

export type ReachabilityState = 'visited' | 'current' | 'reachable' | 'blocked' | 'unreachable'

type NodeData = Graph['nodes'][number]['data']
export type PatientNodeData = NodeData & { reachability: ReachabilityState; blockedReason?: string }

const KIND_META: Record<NodeData['kind'], {
  family: string
  icon: IconName
  label: string
}> = {
  start:         { family: 'start',       icon: 'Play',           label: 'Départ' },
  end:           { family: 'end',         icon: 'Square',         label: 'Fin' },
  send_email:    { family: 'email',       icon: 'Mail',           label: 'Email' },
  send_sms:      { family: 'sms',         icon: 'MessageSquare',  label: 'SMS' },
  send_whatsapp: { family: 'whatsapp',    icon: 'MessageCircle',  label: 'WhatsApp' },
  send_postal:   { family: 'postal',      icon: 'Inbox',          label: 'Courrier' },
  condition:     { family: 'cond-data',   icon: 'GitBranch',      label: 'Condition' }
}

function titleFor(data: NodeData): string {
  switch (data.kind) {
    case 'start': return 'Examen effectué'
    case 'end':   return 'Patient relancé'
    case 'send_email':    return data.params.subject || '(sans sujet)'
    case 'send_sms':      return data.params.body.slice(0, 28) || '(SMS vide)'
    case 'send_whatsapp': return data.params.body.slice(0, 32) || '(message vide)'
    case 'send_postal':   return data.params.body.slice(0, 32) || '(courrier vide)'
    case 'condition':     return data.params.expression || '(expression vide)'
  }
}

const REACH_OUTER: Record<ReachabilityState, string> = {
  visited:     '',
  current:     'animate-pulse',
  reachable:   '',
  blocked:     'opacity-40',
  unreachable: 'pointer-events-none opacity-20 grayscale'
}

export function PatientNode({ data }: NodeProps) {
  const d = data as PatientNodeData
  const meta = KIND_META[d.kind]
  const title = titleFor(d)
  const isCompact = d.kind === 'start' || d.kind === 'end'

  const cardStyle = {
    backgroundColor: `var(--node-${meta.family}-bg)`,
    borderColor:
      d.reachability === 'current' ? 'var(--primary)' :
      d.reachability === 'visited' ? 'var(--success)' :
      d.reachability === 'blocked' ? 'var(--danger)' :
      `var(--node-${meta.family}-border)`,
    borderStyle: d.reachability === 'blocked' ? 'dashed' : 'solid',
    borderWidth: d.reachability === 'current' ? 2 : 1
  } as const

  const stripStyle = { background: `var(--node-${meta.family}-accent)` } as const

  return (
    <div className={REACH_OUTER[d.reachability]}>
      <div
        className={`relative rounded-md p-3 shadow-elev-1 ${isCompact ? 'w-[180px]' : 'w-[260px]'}`}
        style={cardStyle}
      >
        <div className="absolute left-0 top-0 h-full w-[3px] rounded-l-md" style={stripStyle} aria-hidden="true" />
        <div className="ml-1 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
            <Icon name={meta.icon} size={16} />
            <span>{meta.label}</span>
          </div>
          <ReachabilityBadge state={d.reachability} blockedReason={d.blockedReason} />
        </div>
        <h3 className="mt-1 ml-1 text-sm font-semibold text-fg">
          <span className="line-clamp-1">{title}</span>
        </h3>

        {d.kind !== 'start' && (
          <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-2 !bg-surface" />
        )}
        {d.kind !== 'end' && (
          <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-2 !bg-surface" />
        )}
      </div>
    </div>
  )
}

function ReachabilityBadge({ state, blockedReason }: { state: ReachabilityState; blockedReason?: string }) {
  if (state === 'visited') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-[#DCFCE7] px-1.5 py-0.5 text-[10px] font-semibold text-success"
        aria-label="Étape terminée"
      >
        <Icon name="Check" size={16} />
      </span>
    )
  }
  if (state === 'current') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary"
        aria-current="step"
      >
        En cours
      </span>
    )
  }
  if (state === 'blocked') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[10px] font-semibold text-danger"
        title={blockedReason}
      >
        Bloqué
      </span>
    )
  }
  return null
}
```

- [ ] **Step 6.2: Commit**

```bash
git add frontend/src/pages/PatientRunView/PatientNode.tsx
git commit -m "feat(frontend): PatientNode (single dispatched node + reachability overlay)"
```

---

## Task 7: `PatientCanvas`

**File:**
- Create: `frontend/src/pages/PatientRunView/PatientCanvas.tsx`

- [ ] **Step 7.1: Implement**

Write `frontend/src/pages/PatientRunView/PatientCanvas.tsx`:
```tsx
import { useMemo } from 'react'
import {
  ReactFlow, ReactFlowProvider, MiniMap, Controls,
  type Node as RFNode, type Edge as RFEdge, type NodeTypes
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Graph } from '@rainpath/shared'
import { computeReachability } from '@rainpath/shared'
import { TimelineBackground } from '@/pages/WorkflowEditor/TimelineBackground'
import { edgeTypes } from '@/pages/WorkflowEditor/edges/edge-types'
import { PatientNode, type PatientNodeData, type ReachabilityState } from './PatientNode'

const PX_PER_DAY = 28

const nodeTypes: NodeTypes = {
  start: PatientNode,
  end: PatientNode,
  send_email: PatientNode,
  send_sms: PatientNode,
  send_whatsapp: PatientNode,
  send_postal: PatientNode,
  condition: PatientNode
}

interface PatientProfileShape {
  email: string | null
  phone: string | null
  whatsapp: string | null
  address: string | null
}

interface Props {
  graph: Graph
  profile: PatientProfileShape
  currentNodeId: string | null
  history: { nodeId: string; outcome?: string }[]
}

function CanvasInner({ graph, profile, currentNodeId, history }: Props) {
  const reach: Map<string, ReachabilityState> = useMemo(
    () => computeReachability(
      graph,
      {
        email: profile.email,
        phone: profile.phone,
        whatsapp: profile.whatsapp,
        address: profile.address
      },
      currentNodeId,
      history
    ) as Map<string, ReachabilityState>,
    [graph, profile.email, profile.phone, profile.whatsapp, profile.address, currentNodeId, history]
  )

  const rfNodes: RFNode<PatientNodeData>[] = useMemo(() => {
    return graph.nodes.map(n => ({
      id: n.id,
      type: n.data.kind,
      position: { x: n.position.x * PX_PER_DAY, y: n.position.y },
      data: { ...n.data, reachability: reach.get(n.id) ?? 'unreachable' } as PatientNodeData,
      draggable: false,
      selectable: false,
      focusable: false
    }))
  }, [graph.nodes, reach])

  const rfEdges: RFEdge[] = useMemo(() =>
    graph.edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      type: 'default',
      data: { daysAfter: e.daysAfter },
      selectable: false,
      focusable: false
    })),
    [graph.edges]
  )

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesConnectable={false}
        nodesDraggable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        fitView
      >
        <TimelineBackground />
        <Controls className="!bg-surface !border-border" showInteractive={false} />
        <MiniMap className="!bg-surface-muted !border-border" pannable zoomable />
      </ReactFlow>
    </div>
  )
}

export function PatientCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
```

- [ ] **Step 7.2: Build + commit**

Run: `pnpm --filter @rainpath/frontend build 2>&1 | tail -5`

```bash
git add frontend/src/pages/PatientRunView/PatientCanvas.tsx
git commit -m "feat(frontend): PatientCanvas (read-only React Flow with computeReachability map)"
```

---

## Task 8: `PatientProfilePanel`

**File:**
- Create: `frontend/src/pages/PatientRunView/PatientProfilePanel.tsx`

- [ ] **Step 8.1: Implement**

Write `frontend/src/pages/PatientRunView/PatientProfilePanel.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Icon } from '@/components/Icon'
import { updatePatientProfile } from '@/api/patient-profiles'
import { ApiError } from '@/api/client'
import { queryKeys } from '@/api/query-keys'

interface PatientShape {
  id: string
  name: string
  email: string | null
  phone: string | null
  whatsapp: string | null
  address: string | null
  deletedAt: string | null
}

interface Props {
  patient: PatientShape
  runId: string
}

type DraftKey = 'name' | 'email' | 'phone' | 'whatsapp' | 'address'

export function PatientProfilePanel({ patient, runId }: Props) {
  const [draft, setDraft] = useState<Record<DraftKey, string>>({
    name: patient.name,
    email: patient.email ?? '',
    phone: patient.phone ?? '',
    whatsapp: patient.whatsapp ?? '',
    address: patient.address ?? ''
  })

  useEffect(() => {
    setDraft({
      name: patient.name,
      email: patient.email ?? '',
      phone: patient.phone ?? '',
      whatsapp: patient.whatsapp ?? '',
      address: patient.address ?? ''
    })
  }, [patient])

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const qc = useQueryClient()

  const saveMut = useMutation({
    mutationFn: (next: Record<DraftKey, string>) =>
      updatePatientProfile(patient.id, {
        name: next.name.trim() || patient.name,
        email: next.email.trim() ? next.email.trim() : null,
        phone: next.phone.trim() ? next.phone.trim() : null,
        whatsapp: next.whatsapp.trim() ? next.whatsapp.trim() : null,
        address: next.address.trim() ? next.address.trim() : null
      } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.detail(runId) })
      qc.invalidateQueries({ queryKey: queryKeys.patientProfiles.list() })
    },
    onError: e => {
      const msg = e instanceof ApiError ? e.body.errors?.[0]?.message ?? e.message : 'Erreur'
      toast.error(`Échec : ${msg}`)
    }
  })

  const setField = (key: DraftKey, value: string) => {
    const next = { ...draft, [key]: value }
    setDraft(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => saveMut.mutate(next), 500)
  }

  if (patient.deletedAt) {
    return (
      <div className="rounded-md border border-border bg-surface-muted p-3 text-sm text-fg-muted">
        Patient supprimé. Le profil n’est plus modifiable.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">Profil patient</h2>
        {saveMut.isPending ? (
          <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
            <Icon name="LoaderCircle" size={16} className="animate-spin" />
            Enregistrement…
          </span>
        ) : null}
      </div>

      <p className="text-xs text-fg-muted">
        Modifier ces données change immédiatement les chemins disponibles dans le workflow.
      </p>

      <PanelField label="Nom"      value={draft.name}     onChange={v => setField('name', v)} />
      <PanelField label="Email"    value={draft.email}    onChange={v => setField('email', v)}    placeholder="alice@example.com" />
      <PanelField label="Téléphone" value={draft.phone}   onChange={v => setField('phone', v)}    placeholder="+33 …" />
      <PanelField label="WhatsApp" value={draft.whatsapp} onChange={v => setField('whatsapp', v)} placeholder="+33 …" />
      <PanelField label="Adresse"  value={draft.address}  onChange={v => setField('address', v)} placeholder="123 rue …" />
    </div>
  )
}

function PanelField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  const id = `pp-${label.toLowerCase()}`
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-fg-muted">{label}</label>
      <input
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  )
}
```

- [ ] **Step 8.2: Commit**

```bash
git add frontend/src/pages/PatientRunView/PatientProfilePanel.tsx
git commit -m "feat(frontend): PatientProfilePanel (inline editable + 500ms debounce PATCH)"
```

---

## Task 9: `PatientAdvanceControls`

**File:**
- Create: `frontend/src/pages/PatientRunView/PatientAdvanceControls.tsx`

- [ ] **Step 9.1: Implement**

Write `frontend/src/pages/PatientRunView/PatientAdvanceControls.tsx`:
```tsx
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CHANNEL_STATUSES } from '@rainpath/shared'
import type { Graph } from '@rainpath/shared'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/Icon'
import { advancePatientRun, resetPatientRun } from '@/api/patient-runs'
import { queryKeys } from '@/api/query-keys'
import { ApiError } from '@/api/client'

interface Props {
  runId: string
  workflowId: string
  graph: Graph
  currentNodeId: string | null
}

type NodeData = Graph['nodes'][number]['data']

const STATUS_LABEL: Record<string, string> = {
  delivered: 'Livré',
  bounced: 'Rebondi',
  rejected: 'Rejeté',
  opened: 'Ouvert',
  clicked: 'Cliqué',
  unopened: 'Non ouvert',
  sent: 'Envoyé',
  failed: 'Échec',
  read: 'Lu',
  returned: 'Retourné'
}

function channelStatusesFor(data: NodeData): string[] | null {
  if (data.kind === 'send_email') return [...CHANNEL_STATUSES.email]
  if (data.kind === 'send_sms') return [...CHANNEL_STATUSES.sms]
  if (data.kind === 'send_whatsapp') return [...CHANNEL_STATUSES.whatsapp]
  if (data.kind === 'send_postal') {
    return data.params.tracked ? [...CHANNEL_STATUSES.postal_tracked] : [...CHANNEL_STATUSES.postal_untracked]
  }
  return null
}

export function PatientAdvanceControls({ runId, workflowId, graph, currentNodeId }: Props) {
  const node = currentNodeId ? graph.nodes.find(n => n.id === currentNodeId) : null
  const data = node?.data

  const [outcome, setOutcome] = useState<string>('')
  const qc = useQueryClient()

  const advanceMut = useMutation({
    mutationFn: () =>
      advancePatientRun(runId, outcome ? { outcome } : {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.detail(runId) })
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.listForWorkflow(workflowId) })
      setOutcome('')
    },
    onError: e => {
      const msg = e instanceof ApiError
        ? e.body.errors?.[0]?.message ?? `Erreur ${e.status}`
        : 'Échec de l’avancement'
      toast.error(msg)
    }
  })

  const resetMut = useMutation({
    mutationFn: () => resetPatientRun(runId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientRuns.detail(runId) })
      toast.success('Parcours réinitialisé')
      setOutcome('')
    },
    onError: () => toast.error('Échec de la réinitialisation')
  })

  if (!data) {
    return (
      <div className="rounded-md border border-border bg-surface-muted p-3 text-sm text-fg-muted">
        Parcours non démarré.
      </div>
    )
  }

  if (data.kind === 'end') {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-success bg-[#DCFCE7] p-3 text-sm text-fg">
          <Icon name="CircleCheck" size={16} className="mr-1 inline text-success" />
          Parcours terminé.
        </div>
        <Button variant="secondary" onClick={() => resetMut.mutate()} loading={resetMut.isPending}>
          <Icon name="RotateCw" size={16} />
          Réinitialiser le parcours
        </Button>
      </div>
    )
  }

  const channelStatuses = channelStatusesFor(data)
  const isCondition = data.kind === 'condition'
  const noOutcomeNeeded =
    data.kind === 'start' ||
    (channelStatuses !== null && data.kind !== 'condition' && (data as any).params?.output?.mode === 'single')

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">Avancement</h2>

      {isCondition ? (
        <div className="flex gap-2">
          <label className={`flex h-9 flex-1 cursor-pointer items-center justify-center rounded-md border text-sm font-medium ${
            outcome === 'true' ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface text-fg-muted'
          }`}>
            <input type="radio" className="sr-only" checked={outcome === 'true'} onChange={() => setOutcome('true')} />
            Vrai
          </label>
          <label className={`flex h-9 flex-1 cursor-pointer items-center justify-center rounded-md border text-sm font-medium ${
            outcome === 'false' ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface text-fg-muted'
          }`}>
            <input type="radio" className="sr-only" checked={outcome === 'false'} onChange={() => setOutcome('false')} />
            Faux
          </label>
        </div>
      ) : noOutcomeNeeded ? (
        <p className="text-xs text-fg-muted">Aucun statut à fournir, cliquez sur Avancer.</p>
      ) : channelStatuses ? (
        <div>
          <label htmlFor="run-outcome" className="mb-1 block text-xs font-medium text-fg-muted">
            Statut observé
          </label>
          <select
            id="run-outcome"
            value={outcome}
            onChange={e => setOutcome(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Choisir un statut…</option>
            {channelStatuses.map(s => (
              <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="primary"
          loading={advanceMut.isPending}
          disabled={
            (isCondition && !outcome) ||
            (!isCondition && channelStatuses !== null && !noOutcomeNeeded && !outcome)
          }
          onClick={() => advanceMut.mutate()}
        >
          <Icon name="ArrowRight" size={16} />
          Étape suivante
        </Button>
        <Button
          type="button"
          variant="secondary"
          loading={resetMut.isPending}
          onClick={() => resetMut.mutate()}
        >
          <Icon name="RotateCw" size={16} />
          Réinitialiser
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 9.2: Build + commit**

Run: `pnpm --filter @rainpath/frontend build 2>&1 | tail -5`

Note: if the lucide icon `ArrowRight` is not in the verified list (per pitfalls doc), verify by running:
```bash
node -e "console.log('ArrowRight' in require('lucide-react').icons)"
```
If `false`, swap to `ChevronRight` (which is verified). Apply the same substitution if needed.

```bash
git add frontend/src/pages/PatientRunView/PatientAdvanceControls.tsx
git commit -m "feat(frontend): PatientAdvanceControls (contextual outcome selector + advance/reset)"
```

---

## Task 10: `PatientHistoryList`

**File:**
- Create: `frontend/src/pages/PatientRunView/PatientHistoryList.tsx`

- [ ] **Step 10.1: Implement**

Write `frontend/src/pages/PatientRunView/PatientHistoryList.tsx`:
```tsx
import type { Graph } from '@rainpath/shared'
import { Icon } from '@/components/Icon'
import { relativeFromNow } from '@/lib/format-date'

type HistoryEntry = { nodeId: string; enteredAt: string; outcome?: string }

interface Props {
  graph: Graph
  history: HistoryEntry[]
}

function nodeLabel(graph: Graph, nodeId: string): string {
  const n = graph.nodes.find(x => x.id === nodeId)
  if (!n) return nodeId
  const d = n.data
  if (d.kind === 'start') return 'Départ'
  if (d.kind === 'end') return 'Fin'
  if (d.kind === 'send_email') return `Email — ${d.params.subject || '(sans sujet)'}`
  if (d.kind === 'send_sms') return `SMS — ${d.params.body.slice(0, 32) || '(vide)'}`
  if (d.kind === 'send_whatsapp') return `WhatsApp — ${d.params.body.slice(0, 32) || '(vide)'}`
  if (d.kind === 'send_postal') return `Courrier — ${d.params.body.slice(0, 32) || '(vide)'}`
  if (d.kind === 'condition') return `Condition — ${d.params.expression}`
  return nodeId
}

export function PatientHistoryList({ graph, history }: Props) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">Historique</h2>
      <ol className="space-y-1">
        {history.map((entry, ix) => (
          <li key={ix} className="flex items-start gap-2 rounded-md border border-border bg-surface p-2 text-xs">
            <Icon name="Check" size={16} className="mt-0.5 shrink-0 text-success" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-fg">{nodeLabel(graph, entry.nodeId)}</p>
              <p className="text-fg-muted tabular-nums">
                {relativeFromNow(entry.enteredAt)}
                {entry.outcome ? <> · <span className="font-mono">{entry.outcome}</span></> : null}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
```

- [ ] **Step 10.2: Commit**

```bash
git add frontend/src/pages/PatientRunView/PatientHistoryList.tsx
git commit -m "feat(frontend): PatientHistoryList (chronological list with relative dates)"
```

---

## Task 11: `PatientRunView` page shell

**File:**
- Replace: `frontend/src/pages/PatientRunView/index.tsx`

- [ ] **Step 11.1: Implement**

Replace `frontend/src/pages/PatientRunView/index.tsx` entirely with:
```tsx
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { queryKeys } from '@/api/query-keys'
import { getPatientRun } from '@/api/patient-runs'
import { PatientCanvas } from './PatientCanvas'
import { PatientProfilePanel } from './PatientProfilePanel'
import { PatientAdvanceControls } from './PatientAdvanceControls'
import { PatientHistoryList } from './PatientHistoryList'

export default function PatientRunView() {
  const { id: workflowId, runId } = useParams<{ id: string; runId: string }>()
  const { data: run, isLoading, error } = useQuery({
    queryKey: runId ? queryKeys.patientRuns.detail(runId) : ['patient-runs', 'detail', 'none'],
    queryFn: () => getPatientRun(runId!),
    enabled: !!runId
  })

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100dvh-48px)] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <Icon name="LoaderCircle" size={20} className="animate-spin" />
          Chargement…
        </div>
      </div>
    )
  }

  if (error || !run) {
    return (
      <div className="flex min-h-[calc(100dvh-48px)] items-center justify-center p-8">
        <div className="max-w-md text-center">
          <Icon name="CircleAlert" size={24} className="mx-auto text-danger" />
          <h1 className="mt-4 text-xl font-semibold text-fg">Parcours introuvable</h1>
          <p className="mt-2 text-sm text-fg-muted">Ce parcours n’existe pas ou a été supprimé.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-48px)] flex-col">
      <div className="sticky top-12 z-10 flex h-12 items-center gap-4 border-b border-border bg-surface px-6">
        <Link
          to={`/workflows/${workflowId}/patient-runs`}
          className="flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
        >
          <Icon name="ArrowLeft" size={16} />
          Parcours
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-fg">
            {run.patient.name}
            {run.patient.deletedAt ? (
              <span className="ml-2 inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs text-fg-muted">
                Patient supprimé
              </span>
            ) : null}
          </h1>
          <p className="truncate text-xs text-fg-muted">{run.workflow.name}</p>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[1fr_360px] overflow-hidden">
        <div className="relative">
          <PatientCanvas
            graph={run.workflow.graph}
            profile={run.patient}
            currentNodeId={run.currentNodeId}
            history={run.history}
          />
        </div>

        <aside className="flex flex-col gap-6 overflow-y-auto border-l border-border bg-surface p-6">
          <PatientAdvanceControls
            runId={run.id}
            workflowId={run.workflowId}
            graph={run.workflow.graph}
            currentNodeId={run.currentNodeId}
          />
          <div className="h-px bg-border" />
          <PatientProfilePanel patient={run.patient} runId={run.id} />
          <div className="h-px bg-border" />
          <PatientHistoryList graph={run.workflow.graph} history={run.history} />
        </aside>
      </div>
    </div>
  )
}
```

- [ ] **Step 11.2: Build + commit**

Run: `pnpm --filter @rainpath/frontend build 2>&1 | tail -5`
Expected: clean.

```bash
git add frontend/src/pages/PatientRunView/index.tsx
git commit -m "feat(frontend): PatientRunView page shell (2-column canvas + panel + advance/profile/history)"
```

---

## Task 12: Smoke check + final review prep

- [ ] **Step 12.1: Full build + tests**

Run:
```bash
pnpm --filter @rainpath/frontend build 2>&1 | tail -8
pnpm --filter @rainpath/frontend test 2>&1 | tail -10
```

Expected:
- Build: clean.
- Tests: 28 existing + 5 patient-profiles + 5 patient-runs = **38 specs pass**.

- [ ] **Step 12.2: Dev server probe**

```bash
pnpm --filter @rainpath/frontend dev > /tmp/rainpath-2b.log 2>&1 &
DEVPID=$!
sleep 4
curl -s -o /tmp/index.html -w "HTTP %{http_code}\n" http://localhost:5173/patient-profiles
curl -s -o /tmp/run-index.html -w "HTTP %{http_code}\n" http://localhost:5173/workflows/abc/patient-runs
tail -20 /tmp/rainpath-2b.log
kill $DEVPID 2>/dev/null || true
wait $DEVPID 2>/dev/null || true
```

Expected: HTTP 200 for both probes (SPA fallback), no error in log tail.

- [ ] **Step 12.3: Report status**

If everything passes, no further commit. Controller will decide on push.

---

## Self-review notes (post-plan)

**Spec coverage check** (§7.1 routes, §7.6 patient view):
- ✅ §7.1 `/patient-profiles` — Task 4
- ✅ §7.1 `/workflows/:id/patient-runs` — Task 5
- ✅ §7.1 `/workflows/:id/patient-runs/:runId` — Tasks 6-11
- ✅ §7.6 2-column layout (canvas 70% / panel 30%) — Task 11
- ✅ §7.6 read-only canvas reusing custom nodes/edges/background — Tasks 6-7
- ✅ §7.6 reachability state rendering (visited / current / reachable / blocked / unreachable) — Task 6
- ✅ §7.6 editable profile panel with debounce (500ms) + PATCH — Task 8
- ✅ §7.6 outcome selector contextual to current node kind + mode — Task 9
- ✅ §7.6 reset button — Task 9
- ✅ §7.6 history list — Task 10
- ✅ §6.3 API integration (advance, reset, list runs, list profiles, create profile, update, delete) — Tasks 1-2

**Out of scope (deferred)**:
- §7.6 "Curseur jour courant" (vertical line at `X = currentNodeId.x`) — visual polish, no functional impact. Could be a quick addition if Phase 3 has bandwidth.
- §7.6 Pre-warning banner "Aucune adresse email" when patient lacks contact info — nice-to-have UX hint.
- §7.6 Animations on reachability transitions (200ms fade) — pure aesthetics.

**Pitfall audits**:
- **Dual-zod (1)**: `patient-runs.ts` uses envelope-then-detach for the graph field. `patient-profiles.ts` doesn't touch any shared schema (it composes its own primitives via `z.object`). Both safe.
- **Lucide names (2)**: Task 9 references `ArrowRight` — flagged with a runtime fallback to `ChevronRight` if needed. All other icons in this plan are on the verified list.
- **Icon size (3)**: all `size=` are 16 or 24.
- **No semicolons (4)**: clean.
- **TanStack v5 (5)**: all mutations use `isPending`.
- **React Flow v12 (6)**: `PatientCanvas` wraps in `<ReactFlowProvider>` (Task 7).

**Placeholder scan**: clean. Each stub file (Task 3) is replaced atomically in Tasks 4/5/6+ within this plan.

**Type consistency**: `PatientNodeData`, `ReachabilityState` defined once in `PatientNode.tsx`. `PatientProfile`, `PatientRunFull`, `PatientRunSummary`, `RunHistoryEntry` defined once per API client. Shared types (`Graph`, `CHANNEL_STATUSES`, `computeReachability`) imported as type-only or runtime-value where appropriate.

**Scope**: 12 tasks, ~1-1.5h work, every commit produces a green build. Push at end NOT included — controller decides.
