# RainPath — Phase 1B-A Frontend Foundations + WorkflowsList Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the frontend application shell (router, error boundary, query client, toast host, UI primitives), a typed API client backed by TanStack Query, and the **WorkflowsList page** with full CRUD UX (create, duplicate, export JSON, soft-delete, import JSON). The editor page renders a Phase-1B-B-coming-soon placeholder so the route is reachable.

**Architecture:**
- React Router v6 (data router with `createBrowserRouter`) for `/`, `/workflows`, `/workflows/:id`, and a catch-all 404.
- TanStack Query owns server cache (list / get / mutate / invalidate) — no manual state for fetched data.
- A small typed fetch client wraps `fetch`, parses JSON, and throws a normalized `ApiError` (status + body) on non-2xx so the global `ErrorBoundary` and per-page error states can render it. Responses are validated against `@rainpath/shared` Zod schemas on the way in.
- `sonner` for toasts (success / error / warning).
- Tailwind + DS tokens already configured by Phase 0; we add only a handful of UI primitives (`Button`, `IconButton`, `Dialog`, `Tooltip`, `DropdownMenu` wrappers using Radix) that downstream tasks reuse.
- The list page uses a table layout (DS §7.7), `date-fns` for relative dates (`fr` locale), and a kebab menu per row (Rename, Duplicate, Export JSON, Delete).

**Tech Stack:** Vite 5, React 18 + TS, Tailwind v3 + DS tokens (Phase 0), React Router v6, TanStack Query v5, sonner, date-fns (fr locale), Radix UI (Dialog/Popover/DropdownMenu/Tooltip — already installed Phase 0), `@paralleldrive/cuid2`, Vitest + React Testing Library + jsdom (deps installed Phase 0, **not configured yet**).

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-28-rainpath-workflow-editor-design.md` — §6 (API contract), §7.1 (routes), §7.5.b (workflow list page), §7.7 (transverse behaviors), §7.10 (three states).
- Design System: `design-system/MASTER.md` — §7.7 list, §7.8 dialog, §7.10 states, §7.9 toasts.
- Phase 0 plan: `docs/superpowers/plans/2026-05-28-phase-0-foundations.md` — frontend bootstrap & tokens.
- Phase 1A plan (just shipped): `docs/superpowers/plans/2026-05-28-phase-1a-backend.md` — API contract is live on `:3000/api`.

---

## State after Phase 0 + 1A (DO NOT redo)

- `frontend/package.json` declares: react 18, Radix primitives, lucide-react, framer-motion, @floating-ui/react, @fontsource/inter, @rainpath/shared, plus devDeps `vitest@1.6.0`, `@testing-library/react@16`, `@testing-library/jest-dom@6`, `jsdom@24`, `@vitejs/plugin-react`, `tailwindcss@3.4`.
- `frontend/vite.config.ts` has aliases `@/* → src/*` and `@rainpath/shared → ../shared/src` + dev proxy `/api → http://localhost:3000`.
- `frontend/src/styles/tokens.css` declares full DS tokens (colors, node-family colors, spacing, radius, elevation, typography); `globals.css` imports it; `tailwind.config.ts` exposes them as utilities.
- `frontend/src/components/Icon.tsx` is a Lucide wrapper accepting `name`, `size`, `className`.
- `frontend/src/App.tsx` and `main.tsx` currently render a single Phase-0 smoke check page — they will be replaced by Task 4.
- Backend `/api/workflows` and `/api/node-templates` are live (per Phase 1A) and serve the 422-shaped payload `{ statusCode, errors, warnings }`.

---

## File structure (this plan creates)

```
frontend/
├── vite.config.ts                            # MODIFY — add `test` config (jsdom env + setup file)
├── package.json                              # MODIFY — add 5 deps, scripts unchanged
├── src/
│   ├── main.tsx                              # REPLACE — mount QueryClient + RouterProvider + Toaster
│   ├── App.tsx                               # DELETE (replaced by router)
│   ├── router.tsx                            # CREATE — createBrowserRouter with 4 routes
│   ├── test/
│   │   └── setup.ts                          # CREATE — testing-library/jest-dom global
│   ├── api/
│   │   ├── client.ts                         # CREATE — fetch wrapper + ApiError
│   │   ├── workflows.ts                      # CREATE — list/get/create/update/duplicate/remove + hooks
│   │   ├── query-keys.ts                     # CREATE — typed key factory
│   │   └── workflows.test.ts                 # CREATE — Zod roundtrip + error mapping
│   ├── lib/
│   │   ├── format-date.ts                    # CREATE — relativeFromNow(date) fr locale
│   │   └── download-json.ts                  # CREATE — programmatic file download for export
│   ├── components/
│   │   ├── Icon.tsx                          # EXISTING (Phase 0)
│   │   ├── ErrorBoundary.tsx                 # CREATE — class component fallback
│   │   ├── Toaster.tsx                       # CREATE — sonner with DS styling
│   │   ├── AppLayout.tsx                     # CREATE — page chrome shared by all routes
│   │   └── ui/
│   │       ├── Button.tsx                    # CREATE — variant + size + loading
│   │       ├── IconButton.tsx                # CREATE — variant ghost + aria-label required
│   │       ├── Dialog.tsx                    # CREATE — Radix Dialog wrapper with DS sizing
│   │       └── DropdownMenu.tsx              # CREATE — Radix DropdownMenu wrapper
│   └── pages/
│       ├── NotFound.tsx                      # CREATE — 404 page (route catch-all)
│       ├── WorkflowsList/
│       │   ├── index.tsx                     # CREATE — page (header + table/empty/loading/error)
│       │   ├── CreateWorkflowDialog.tsx      # CREATE — modal triggered by "+ Nouveau workflow"
│       │   ├── ImportWorkflowDialog.tsx      # CREATE — file input + Zod safeParse + confirm
│       │   ├── DeleteWorkflowConfirm.tsx     # CREATE — Radix dialog confirming delete
│       │   ├── WorkflowsTable.tsx            # CREATE — table rendering (rows + kebab menu)
│       │   └── workflows-list.test.tsx       # CREATE — RTL on table states
│       └── WorkflowEditorPlaceholder.tsx     # CREATE — Phase-1B-B-coming-soon stub
```

---

## Conventions used across tasks

- **Style**: no semicolons, single quotes — matches the existing `frontend/src/App.tsx` and the backend codebase.
- **Test runner**: Vitest. Test files use `.test.ts(x)` suffix and live next to the code under test. Components use jsdom env + `@testing-library/react`. Tasks 6, 7, and the WorkflowsList page each add one Vitest spec.
- **Toast policy** (spec §7.7): `sonner`, max 3 stacked, bottom-right. Success/info dismiss in 4s, warning in 6s, danger is manual. Never the **sole** feedback for destructive actions (the UI must also reflect the change — e.g. row removed from the table immediately, with the toast confirming "Workflow supprimé").
- **API base URL**: relative `/api` in dev (Vite proxy forwards to `:3000`), `/api` in prod (assuming same-origin). The client lib reads it from `import.meta.env.VITE_API_BASE_URL` with default `/api`.
- **Zod validation on read**: every API response is `safeParse`d against the matching Zod schema from `@rainpath/shared`. On parse failure the client throws `ApiError({ status: 500, code: 'response_drift', detail: ... })`.

---

## Task 1: Install runtime dependencies

**Files:**
- Modify: `frontend/package.json` (via pnpm add)

- [ ] **Step 1.1: Add the 5 new deps**

Run from repo root:
```bash
pnpm --filter @rainpath/frontend add \
  react-router-dom@6.26.2 \
  @tanstack/react-query@5.59.0 \
  sonner@1.5.0 \
  date-fns@3.6.0 \
  @paralleldrive/cuid2@2.2.2
```

Expected: `frontend/package.json` lists all 5 in `dependencies` (`react-router-dom` also pulls in `react-router` transitively), lockfile updated. **All router imports throughout this plan are from `'react-router-dom'`**, not `'react-router'`.

- [ ] **Step 1.2: Sanity check**

Run: `pnpm --filter @rainpath/frontend exec tsc --noEmit -p tsconfig.app.json`
Expected: clean. (No code uses these yet — TS just verifies that the types are resolvable.)

- [ ] **Step 1.3: Commit**

```bash
git add frontend/package.json pnpm-lock.yaml
git commit -m "chore(frontend): add react-router, tanstack-query, sonner, date-fns, cuid2"
```

---

## Task 2: Configure Vitest

**Files:**
- Modify: `frontend/vite.config.ts`
- Create: `frontend/src/test/setup.ts`

- [ ] **Step 2.1: Extend vite.config.ts with the `test` block**

Replace `frontend/vite.config.ts` with:
```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@rainpath/shared': path.resolve(__dirname, '../shared/src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true
  }
})
```

- [ ] **Step 2.2: Create the Vitest setup file**

Write `frontend/src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 2.3: Add a smoke test to verify the runner works**

Write `frontend/src/test/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

describe('vitest harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })

  it('has jest-dom matchers loaded', () => {
    const el = document.createElement('div')
    el.textContent = 'hello'
    document.body.appendChild(el)
    expect(el).toBeInTheDocument()
  })
})
```

- [ ] **Step 2.4: Run and verify PASS**

Run: `pnpm --filter @rainpath/frontend test`
Expected: 2 tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add frontend/vite.config.ts frontend/src/test/setup.ts frontend/src/test/smoke.test.ts
git commit -m "test(frontend): configure Vitest with jsdom + jest-dom matchers"
```

---

## Task 3: API client base (`client.ts` + `ApiError`)

**Files:**
- Create: `frontend/src/api/client.ts`

- [ ] **Step 3.1: Implement the client**

Write `frontend/src/api/client.ts`:
```ts
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'

export type ApiErrorBody = {
  statusCode?: number
  errors?: Array<{ code: string; message: string; path?: (string | number)[]; nodeId?: string; edgeId?: string }>
  warnings?: Array<{ code: string; message: string; nodeId?: string; edgeId?: string; missingStatuses?: string[] }>
  message?: string
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody,
    message?: string
  ) {
    super(message ?? body.message ?? `HTTP ${status}`)
    this.name = 'ApiError'
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const init: RequestInit = {
    method: opts.method ?? 'GET',
    signal: opts.signal,
    headers: { 'Content-Type': 'application/json' }
  }
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body)

  const res = await fetch(`${BASE_URL}${path}`, init)

  if (res.status === 204) {
    return undefined as T
  }

  const isJson = (res.headers.get('content-type') ?? '').includes('application/json')
  const payload: unknown = isJson ? await res.json() : await res.text()

  if (!res.ok) {
    const body = (isJson ? payload : { message: String(payload) }) as ApiErrorBody
    throw new ApiError(res.status, body)
  }

  return payload as T
}
```

- [ ] **Step 3.2: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat(frontend): typed fetch client with ApiError"
```

---

## Task 4: Workflows API hooks + Zod validation + roundtrip test

**Files:**
- Create: `frontend/src/api/query-keys.ts`
- Create: `frontend/src/api/workflows.ts`
- Create: `frontend/src/api/workflows.test.ts`

- [ ] **Step 4.1: Query key factory**

Write `frontend/src/api/query-keys.ts`:
```ts
export const queryKeys = {
  workflows: {
    all: ['workflows'] as const,
    list: () => [...queryKeys.workflows.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.workflows.all, 'detail', id] as const
  },
  nodeTemplates: {
    all: ['node-templates'] as const,
    list: () => [...queryKeys.nodeTemplates.all, 'list'] as const
  }
}
```

- [ ] **Step 4.2: Write the failing workflows API spec**

Write `frontend/src/api/workflows.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { START_Y } from '@rainpath/shared'
import { listWorkflows, getWorkflow, createWorkflow } from './workflows'
import { ApiError } from './client'

const originalFetch = globalThis.fetch

function mockFetchOnce(response: { status: number; body: unknown; headers?: Record<string, string> }) {
  globalThis.fetch = vi.fn().mockResolvedValueOnce(
    new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', ...(response.headers ?? {}) }
    })
  ) as unknown as typeof fetch
}

describe('workflows api client', () => {
  beforeEach(() => { globalThis.fetch = originalFetch })

  it('listWorkflows() parses the array response', async () => {
    mockFetchOnce({
      status: 200,
      body: [{ id: 'w1', name: 'A', description: null, updatedAt: '2026-05-28T10:00:00.000Z' }]
    })
    const list = await listWorkflows()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: 'w1', name: 'A' })
  })

  it('getWorkflow(id) parses the full workflow including graph', async () => {
    const graph = {
      nodes: [
        { id: 's', position: { x: 0, y: START_Y }, data: { kind: 'start' } },
        { id: 'e', position: { x: 30, y: START_Y }, data: { kind: 'end' } }
      ],
      edges: [{ id: 'e1', source: 's', target: 'e', daysAfter: 30 }]
    }
    mockFetchOnce({
      status: 200,
      body: {
        id: 'w1',
        name: 'X',
        description: null,
        graph,
        createdAt: '2026-05-28T10:00:00.000Z',
        updatedAt: '2026-05-28T10:00:00.000Z',
        warnings: []
      }
    })
    const wf = await getWorkflow('w1')
    expect(wf.graph.nodes).toHaveLength(2)
    expect(wf.graph.edges[0]?.daysAfter).toBe(30)
  })

  it('createWorkflow() forwards body and parses response', async () => {
    mockFetchOnce({
      status: 201,
      body: {
        id: 'w1',
        name: 'New',
        description: null,
        graph: { nodes: [], edges: [] },
        createdAt: '2026-05-28T10:00:00.000Z',
        updatedAt: '2026-05-28T10:00:00.000Z',
        warnings: []
      }
    })
    const wf = await createWorkflow({ name: 'New' })
    expect(wf.name).toBe('New')
  })

  it('rejects with ApiError on a 422 response', async () => {
    mockFetchOnce({
      status: 422,
      body: { statusCode: 422, errors: [{ code: 'too_small', message: 'name required', path: ['name'] }], warnings: [] }
    })
    let caught: unknown
    try { await createWorkflow({ name: '' }) } catch (e) { caught = e }
    expect(caught).toBeInstanceOf(ApiError)
    expect((caught as ApiError).status).toBe(422)
    expect((caught as ApiError).body.errors?.[0]?.code).toBe('too_small')
  })
})
```

- [ ] **Step 4.3: Run, verify FAIL (module missing)**

Run: `pnpm --filter @rainpath/frontend test -- workflows`
Expected: FAIL — cannot import from `./workflows`.

- [ ] **Step 4.4: Implement the API module**

Write `frontend/src/api/workflows.ts`:
```ts
import { z } from 'zod'
import {
  CreateWorkflowDto,
  DuplicateWorkflowDto,
  Graph,
  UpdateWorkflowDto
} from '@rainpath/shared'
import { ApiError, apiFetch } from './client'

// ---- Response schemas ----

const WorkflowSummary = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  updatedAt: z.string()
})
export type WorkflowSummary = z.infer<typeof WorkflowSummary>

const Warning = z.object({
  code: z.string(),
  message: z.string(),
  nodeId: z.string().optional(),
  edgeId: z.string().optional(),
  missingStatuses: z.array(z.string()).optional()
})

const WorkflowDetail = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  graph: Graph,
  createdAt: z.string(),
  updatedAt: z.string(),
  warnings: z.array(Warning)
})
export type WorkflowDetail = z.infer<typeof WorkflowDetail>

function parseOrThrow<T>(schema: z.ZodSchema<T>, raw: unknown): T {
  const r = schema.safeParse(raw)
  if (!r.success) {
    throw new ApiError(500, {
      message: 'response_drift',
      errors: r.error.issues.map(i => ({ code: 'response_drift', message: i.message, path: i.path }))
    })
  }
  return r.data
}

// ---- Methods ----

export async function listWorkflows(): Promise<WorkflowSummary[]> {
  const raw = await apiFetch<unknown>('/workflows')
  return parseOrThrow(z.array(WorkflowSummary), raw)
}

export async function getWorkflow(id: string): Promise<WorkflowDetail> {
  const raw = await apiFetch<unknown>(`/workflows/${id}`)
  return parseOrThrow(WorkflowDetail, raw)
}

export async function createWorkflow(body: CreateWorkflowDto): Promise<WorkflowDetail> {
  const raw = await apiFetch<unknown>('/workflows', { method: 'POST', body })
  return parseOrThrow(WorkflowDetail, raw)
}

export async function updateWorkflow(id: string, body: UpdateWorkflowDto): Promise<WorkflowDetail> {
  const raw = await apiFetch<unknown>(`/workflows/${id}`, { method: 'PATCH', body })
  return parseOrThrow(WorkflowDetail, raw)
}

export async function duplicateWorkflow(id: string, body: DuplicateWorkflowDto): Promise<WorkflowDetail> {
  const raw = await apiFetch<unknown>(`/workflows/${id}/duplicate`, { method: 'POST', body })
  return parseOrThrow(WorkflowDetail, raw)
}

export async function deleteWorkflow(id: string): Promise<void> {
  await apiFetch<void>(`/workflows/${id}`, { method: 'DELETE' })
}
```

- [ ] **Step 4.5: Run spec, verify PASS**

Run: `pnpm --filter @rainpath/frontend test -- workflows`
Expected: 4 tests pass.

- [ ] **Step 4.6: Commit**

```bash
git add frontend/src/api/workflows.ts frontend/src/api/query-keys.ts frontend/src/api/workflows.test.ts
git commit -m "feat(frontend): typed workflows API client with Zod parse and ApiError"
```

---

## Task 5: UI primitives (Button, IconButton, Dialog, DropdownMenu)

**Files:**
- Create: `frontend/src/components/ui/Button.tsx`
- Create: `frontend/src/components/ui/IconButton.tsx`
- Create: `frontend/src/components/ui/Dialog.tsx`
- Create: `frontend/src/components/ui/DropdownMenu.tsx`

- [ ] **Step 5.1: Button**

Write `frontend/src/components/ui/Button.tsx`:
```tsx
import { ButtonHTMLAttributes, forwardRef } from 'react'
import { Icon } from '@/components/Icon'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'default' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed',
  secondary:
    'bg-surface text-fg border border-border hover:bg-surface-muted disabled:opacity-60 disabled:cursor-not-allowed',
  ghost:
    'bg-transparent text-fg hover:bg-surface-muted disabled:opacity-60 disabled:cursor-not-allowed',
  danger:
    'bg-transparent text-danger hover:bg-[#FEF2F2] disabled:opacity-60 disabled:cursor-not-allowed'
}

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  default: 'h-9 px-4 text-sm gap-2',
  lg: 'h-10 px-5 text-base gap-2'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'default', loading, disabled, className, children, ...rest },
  ref
) {
  const classes =
    'inline-flex items-center justify-center rounded-md font-medium transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
    `${VARIANT[variant]} ${SIZE[size]} ${className ?? ''}`
  return (
    <button ref={ref} className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <Icon name="Loader2" size={16} className="animate-spin" /> : children}
    </button>
  )
})
```

- [ ] **Step 5.2: IconButton**

Write `frontend/src/components/ui/IconButton.tsx`:
```tsx
import { ButtonHTMLAttributes, forwardRef } from 'react'
import { Icon, IconName } from '@/components/Icon'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  /** Required for screen-readers — describes the action this button performs. */
  'aria-label': string
  size?: 'sm' | 'default'
  variant?: 'ghost' | 'danger'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, size = 'default', variant = 'ghost', className, ...rest },
  ref
) {
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'
  const tone = variant === 'danger' ? 'text-danger hover:bg-[#FEF2F2]' : 'text-fg hover:bg-surface-muted'
  return (
    <button
      ref={ref}
      className={
        `inline-flex items-center justify-center rounded-md transition-colors ` +
        `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ` +
        `${dim} ${tone} ${className ?? ''}`
      }
      {...rest}
    >
      <Icon name={icon} size={16} />
    </button>
  )
})
```

- [ ] **Step 5.3: Export `IconName` from `Icon.tsx`**

The existing `frontend/src/components/Icon.tsx` already declares `type IconName = keyof typeof icons` but does **not** export it. The `IconButton` in Step 5.2 needs it. Apply the minimal change:

```ts
// before
type IconName = keyof typeof icons
// after
export type IconName = keyof typeof icons
```

That's the only edit to this file. Do not touch anything else in `Icon.tsx`.

- [ ] **Step 5.4: Dialog wrapper (Radix)**

Write `frontend/src/components/ui/Dialog.tsx`:
```tsx
import * as RadixDialog from '@radix-ui/react-dialog'
import { ReactNode } from 'react'
import { Icon } from '@/components/Icon'

type DialogSize = 'sm' | 'md' | 'lg'

const WIDTH: Record<DialogSize, string> = {
  sm: 'max-w-[420px]',
  md: 'max-w-[480px]',
  lg: 'max-w-[640px]'
}

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  size?: DialogSize
}

export function Dialog({ open, onOpenChange, title, description, children, size = 'md' }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[100] bg-[var(--elev-scrim)] data-[state=open]:animate-in data-[state=open]:fade-in" />
        <RadixDialog.Content
          className={
            'fixed left-1/2 top-1/2 z-[100] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 ' +
            'rounded-lg bg-surface p-6 shadow-elev-3 ' +
            'data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95 ' +
            WIDTH[size]
          }
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <RadixDialog.Title className="text-lg font-semibold text-fg">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 text-sm text-fg-muted">
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>
            <RadixDialog.Close
              className="rounded-md p-1 text-fg-muted hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Fermer"
            >
              <Icon name="X" size={16} />
            </RadixDialog.Close>
          </div>
          <div className="mt-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
```

- [ ] **Step 5.5: DropdownMenu wrapper**

Write `frontend/src/components/ui/DropdownMenu.tsx`:
```tsx
import * as RDM from '@radix-ui/react-dropdown-menu'
import { ReactNode } from 'react'
import { Icon, IconName } from '@/components/Icon'

export const DropdownMenu = RDM.Root
export const DropdownTrigger = RDM.Trigger
export const DropdownPortal = RDM.Portal

export function DropdownContent({ children }: { children: ReactNode }) {
  return (
    <RDM.Portal>
      <RDM.Content
        align="end"
        sideOffset={4}
        className="z-50 min-w-[200px] rounded-md border border-border bg-surface p-1 shadow-elev-2"
      >
        {children}
      </RDM.Content>
    </RDM.Portal>
  )
}

export interface DropdownItemProps {
  icon?: IconName
  onSelect: () => void
  danger?: boolean
  children: ReactNode
}

export function DropdownItem({ icon, onSelect, danger, children }: DropdownItemProps) {
  return (
    <RDM.Item
      onSelect={onSelect}
      className={
        'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none ' +
        (danger ? 'text-danger hover:bg-[#FEF2F2]' : 'text-fg hover:bg-surface-muted')
      }
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      <span>{children}</span>
    </RDM.Item>
  )
}

export function DropdownSeparator() {
  return <RDM.Separator className="my-1 h-px bg-border" />
}
```

- [ ] **Step 5.6: Sanity build**

Run: `pnpm --filter @rainpath/frontend build`
Expected: clean.

- [ ] **Step 5.7: Commit**

```bash
git add frontend/src/components/ui frontend/src/components/Icon.tsx
git commit -m "feat(frontend): UI primitives (Button, IconButton, Dialog, DropdownMenu)"
```

---

## Task 6: ErrorBoundary + Toaster + AppLayout + NotFound

**Files:**
- Create: `frontend/src/components/ErrorBoundary.tsx`
- Create: `frontend/src/components/Toaster.tsx`
- Create: `frontend/src/components/AppLayout.tsx`
- Create: `frontend/src/pages/NotFound.tsx`

- [ ] **Step 6.1: ErrorBoundary**

Write `frontend/src/components/ErrorBoundary.tsx`:
```tsx
import { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/Icon'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-dvh items-center justify-center p-8">
        <div className="max-w-md text-center">
          <Icon name="AlertCircle" size={24} className="mx-auto text-danger" />
          <h1 className="mt-4 text-xl font-semibold text-fg">Erreur de chargement</h1>
          <p className="mt-2 text-sm text-fg-muted">
            Une erreur inattendue s’est produite. Rechargez la page pour réessayer.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="primary" onClick={this.reset}>
              <Icon name="RotateCw" size={16} />
              Recharger
            </Button>
            <Button variant="secondary" onClick={() => (window.location.href = '/workflows')}>
              Retour à la liste
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
```

- [ ] **Step 6.2: Toaster (sonner with DS styling)**

Write `frontend/src/components/Toaster.tsx`:
```tsx
import { Toaster as Sonner } from 'sonner'

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      richColors
      closeButton
      visibleToasts={3}
      toastOptions={{
        duration: 4000,
        classNames: {
          toast: 'rounded-md border border-border bg-surface shadow-elev-2 text-sm text-fg',
          description: 'text-fg-muted'
        }
      }}
    />
  )
}
```

- [ ] **Step 6.3: AppLayout**

Write `frontend/src/components/AppLayout.tsx`:
```tsx
import { Outlet, Link } from 'react-router-dom'

export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="sticky top-0 z-20 flex h-12 items-center border-b border-border bg-surface px-6">
        <Link to="/workflows" className="text-sm font-semibold tracking-tight text-fg">
          RainPath
        </Link>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 6.4: NotFound page**

Write `frontend/src/pages/NotFound.tsx`:
```tsx
import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon'

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100dvh-48px)] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <Icon name="MapPinOff" size={24} className="mx-auto text-fg-muted" />
        <h1 className="mt-4 text-2xl font-semibold text-fg">Page introuvable</h1>
        <p className="mt-2 text-sm text-fg-muted">Cette page n’existe pas ou a été déplacée.</p>
        <Link
          to="/workflows"
          className="mt-6 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Retour aux workflows
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 6.5: Commit**

```bash
git add frontend/src/components/ErrorBoundary.tsx frontend/src/components/Toaster.tsx frontend/src/components/AppLayout.tsx frontend/src/pages/NotFound.tsx
git commit -m "feat(frontend): ErrorBoundary, Toaster, AppLayout, NotFound"
```

---

## Task 7: Router + main.tsx + WorkflowEditor placeholder

**Files:**
- Create: `frontend/src/router.tsx`
- Replace: `frontend/src/main.tsx`
- Delete: `frontend/src/App.tsx`
- Create: `frontend/src/pages/WorkflowEditorPlaceholder.tsx`

- [ ] **Step 7.1: Placeholder editor page**

Write `frontend/src/pages/WorkflowEditorPlaceholder.tsx`:
```tsx
import { Link, useParams } from 'react-router-dom'
import { Icon } from '@/components/Icon'

export default function WorkflowEditorPlaceholder() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="flex min-h-[calc(100dvh-48px)] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <Icon name="Construction" size={24} className="mx-auto text-fg-muted" />
        <h1 className="mt-4 text-2xl font-semibold text-fg">Éditeur — Phase 1B-B</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Workflow <span className="font-mono text-xs">{id}</span> ouvert ici dans la prochaine itération.
        </p>
        <Link
          to="/workflows"
          className="mt-6 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-hover"
        >
          Retour à la liste
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 7.2: Router**

Write `frontend/src/router.tsx`:
```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout'
import NotFound from '@/pages/NotFound'
import WorkflowsList from '@/pages/WorkflowsList'
import WorkflowEditorPlaceholder from '@/pages/WorkflowEditorPlaceholder'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Navigate to="/workflows" replace /> },
      { path: '/workflows', element: <WorkflowsList /> },
      { path: '/workflows/:id', element: <WorkflowEditorPlaceholder /> },
      { path: '*', element: <NotFound /> }
    ]
  }
])
```

- [ ] **Step 7.3: Replace main.tsx and delete App.tsx**

Replace `frontend/src/main.tsx` with:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Toaster } from './components/Toaster'
import './styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true
    }
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
)
```

Then delete `frontend/src/App.tsx`:
```bash
rm frontend/src/App.tsx
```

- [ ] **Step 7.4: Verify build**

Run: `pnpm --filter @rainpath/frontend build`
Expected: clean. Note: `WorkflowsList` doesn't exist yet — temporary stub needed.

Create a temporary stub at `frontend/src/pages/WorkflowsList/index.tsx`:
```tsx
export default function WorkflowsList() {
  return <div className="p-6">WorkflowsList — Task 9</div>
}
```

(This stub is replaced in Task 9. Building before then ensures the router compiles in isolation.)

Re-run `pnpm --filter @rainpath/frontend build`. Expected: clean.

- [ ] **Step 7.5: Commit**

```bash
git add frontend/src/router.tsx frontend/src/main.tsx frontend/src/pages/WorkflowEditorPlaceholder.tsx frontend/src/pages/WorkflowsList/index.tsx frontend/src/App.tsx
git commit -m "feat(frontend): router with /workflows, /workflows/:id, 404; mount QueryClient + Toaster"
```

---

## Task 8: Lib helpers (format-date, download-json)

**Files:**
- Create: `frontend/src/lib/format-date.ts`
- Create: `frontend/src/lib/download-json.ts`

- [ ] **Step 8.1: format-date**

Write `frontend/src/lib/format-date.ts`:
```ts
import { formatDistanceToNow, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

/** Returns "il y a 2 min", "il y a 3 j", etc. — accepts ISO string or Date. */
export function relativeFromNow(input: string | Date): string {
  const date = typeof input === 'string' ? parseISO(input) : input
  return formatDistanceToNow(date, { addSuffix: true, locale: fr })
}
```

- [ ] **Step 8.2: download-json**

Write `frontend/src/lib/download-json.ts`:
```ts
/** Triggers a download of `data` as a JSON file named `filename`. */
export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 8.3: Commit**

```bash
git add frontend/src/lib
git commit -m "feat(frontend): lib helpers (relativeFromNow fr + downloadJson)"
```

---

## Task 9: WorkflowsList page — table + 3 states + create button

**Files:**
- Replace: `frontend/src/pages/WorkflowsList/index.tsx` (was a stub from Task 7)
- Create: `frontend/src/pages/WorkflowsList/WorkflowsTable.tsx`
- Create: `frontend/src/pages/WorkflowsList/workflows-list.test.tsx`

- [ ] **Step 9.1: Write the RTL spec first**

Write `frontend/src/pages/WorkflowsList/workflows-list.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import WorkflowsList from './index'

const originalFetch = globalThis.fetch

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/workflows']}>
        <WorkflowsList />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function mockFetch(status: number, body: unknown) {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  ) as unknown as typeof fetch
}

describe('WorkflowsList', () => {
  beforeEach(() => { globalThis.fetch = originalFetch })

  it('renders the empty state when the list is empty', async () => {
    mockFetch(200, [])
    renderPage()
    expect(await screen.findByText(/Aucun workflow/i)).toBeInTheDocument()
  })

  it('renders a row per workflow', async () => {
    mockFetch(200, [
      { id: 'w1', name: 'Relance standard', description: 'desc', updatedAt: new Date().toISOString() },
      { id: 'w2', name: 'Suivi rapide', description: null, updatedAt: new Date().toISOString() }
    ])
    renderPage()
    expect(await screen.findByText('Relance standard')).toBeInTheDocument()
    expect(screen.getByText('Suivi rapide')).toBeInTheDocument()
  })

  it('renders the error state on API failure', async () => {
    mockFetch(500, { message: 'boom' })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 9.2: Run, verify FAIL (no implementation)**

Run: `pnpm --filter @rainpath/frontend test -- workflows-list`
Expected: FAIL — the empty / row / error texts don't exist (still the Task-7 stub).

- [ ] **Step 9.3: WorkflowsTable component**

Write `frontend/src/pages/WorkflowsList/WorkflowsTable.tsx`:
```tsx
import { Link } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator
} from '@/components/ui/DropdownMenu'
import { IconButton } from '@/components/ui/IconButton'
import { relativeFromNow } from '@/lib/format-date'
import type { WorkflowSummary } from '@/api/workflows'

interface Props {
  rows: WorkflowSummary[]
  onDuplicate: (id: string) => void
  onExport: (id: string) => void
  onDelete: (row: WorkflowSummary) => void
}

export function WorkflowsTable({ rows, onDuplicate, onExport, onDelete }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-surface-muted text-left text-xs font-medium uppercase tracking-wide text-fg-muted">
          <tr>
            <th className="px-4 py-3">Nom</th>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3 text-right">Modifié</th>
            <th className="w-10 px-2 py-3" aria-label="Actions" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(r => (
            <tr key={r.id} className="hover:bg-surface-muted">
              <td className="px-4 py-3">
                <Link
                  to={`/workflows/${r.id}`}
                  className="font-medium text-fg hover:text-primary focus-visible:outline-none focus-visible:underline"
                >
                  {r.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-fg-muted">
                <span className="line-clamp-1">{r.description ?? '—'}</span>
              </td>
              <td className="px-4 py-3 text-right text-fg-muted tabular-nums">
                {relativeFromNow(r.updatedAt)}
              </td>
              <td className="px-2 py-2 text-right">
                <DropdownMenu>
                  <DropdownTrigger asChild>
                    <IconButton icon="EllipsisVertical" aria-label={`Actions sur ${r.name}`} />
                  </DropdownTrigger>
                  <DropdownContent>
                    <DropdownItem icon="Copy" onSelect={() => onDuplicate(r.id)}>Dupliquer</DropdownItem>
                    <DropdownItem icon="Download" onSelect={() => onExport(r.id)}>Exporter en JSON</DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem icon="Trash2" danger onSelect={() => onDelete(r)}>Supprimer</DropdownItem>
                  </DropdownContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 9.4: WorkflowsList page**

Replace `frontend/src/pages/WorkflowsList/index.tsx` with:
```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { queryKeys } from '@/api/query-keys'
import {
  deleteWorkflow,
  duplicateWorkflow,
  getWorkflow,
  listWorkflows,
  type WorkflowSummary
} from '@/api/workflows'
import { downloadJson } from '@/lib/download-json'
import { ApiError } from '@/api/client'
import { WorkflowsTable } from './WorkflowsTable'
import { CreateWorkflowDialog } from './CreateWorkflowDialog'
import { ImportWorkflowDialog } from './ImportWorkflowDialog'
import { DeleteWorkflowConfirm } from './DeleteWorkflowConfirm'

export default function WorkflowsList() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [toDelete, setToDelete] = useState<WorkflowSummary | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.workflows.list(),
    queryFn: listWorkflows
  })

  const duplicateMut = useMutation({
    mutationFn: (id: string) => duplicateWorkflow(id, {}),
    onSuccess: wf => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.list() })
      toast.success(`Workflow dupliqué : « ${wf.name} »`)
    },
    onError: () => toast.error('Échec de la duplication')
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteWorkflow(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.list() })
      const name = data?.find(w => w.id === id)?.name ?? 'le workflow'
      toast.success(`« ${name} » supprimé`)
      setToDelete(null)
    },
    onError: () => toast.error('Échec de la suppression')
  })

  const handleExport = async (id: string) => {
    try {
      const wf = await getWorkflow(id)
      downloadJson(`${wf.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'workflow'}.json`, wf)
      toast.success('Export téléchargé')
    } catch (e) {
      const msg = e instanceof ApiError ? `Erreur ${e.status}` : 'Échec de l’export'
      toast.error(msg)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Workflows</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <Icon name="Upload" size={16} />
            Importer un JSON
          </Button>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Icon name="Plus" size={16} />
            Nouveau workflow
          </Button>
        </div>
      </header>

      <div className="mt-8">
        {isLoading ? (
          <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-fg-muted">
            Chargement…
          </div>
        ) : error ? (
          <div className="rounded-lg border border-border bg-surface p-8 text-center">
            <p className="text-sm text-fg">Impossible de charger les workflows.</p>
            <Button variant="secondary" className="mt-4" onClick={() => refetch()}>
              <Icon name="RotateCw" size={16} />
              Réessayer
            </Button>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="mx-auto max-w-md rounded-lg border border-border bg-surface p-8 text-center">
            <Icon name="ListPlus" size={24} className="mx-auto text-fg-muted" />
            <p className="mt-4 text-sm text-fg">Aucun workflow créé pour le moment.</p>
            <Button variant="primary" className="mt-4" onClick={() => setCreateOpen(true)}>
              Créer mon premier workflow
            </Button>
          </div>
        ) : (
          <WorkflowsTable
            rows={data}
            onDuplicate={id => duplicateMut.mutate(id)}
            onExport={handleExport}
            onDelete={row => setToDelete(row)}
          />
        )}
      </div>

      <CreateWorkflowDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ImportWorkflowDialog open={importOpen} onOpenChange={setImportOpen} />
      <DeleteWorkflowConfirm
        open={!!toDelete}
        target={toDelete}
        loading={deleteMut.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteMut.mutate(toDelete.id)}
      />
    </div>
  )
}
```

Note: `CreateWorkflowDialog`, `ImportWorkflowDialog`, and `DeleteWorkflowConfirm` are added in Tasks 10–12. Before running the test in Step 9.6, stub them in this same task so the page compiles. Add minimal stubs at:

`frontend/src/pages/WorkflowsList/CreateWorkflowDialog.tsx`:
```tsx
export function CreateWorkflowDialog({ open }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return open ? null : null
}
```

`frontend/src/pages/WorkflowsList/ImportWorkflowDialog.tsx`:
```tsx
export function ImportWorkflowDialog({ open }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return open ? null : null
}
```

`frontend/src/pages/WorkflowsList/DeleteWorkflowConfirm.tsx`:
```tsx
import type { WorkflowSummary } from '@/api/workflows'
export function DeleteWorkflowConfirm(_: {
  open: boolean
  target: WorkflowSummary | null
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return null
}
```

These three files are replaced with real implementations in Tasks 10–12.

- [ ] **Step 9.5: Run RTL spec, verify PASS**

Run: `pnpm --filter @rainpath/frontend test -- workflows-list`
Expected: 3 tests pass.

- [ ] **Step 9.6: Commit**

```bash
git add frontend/src/pages/WorkflowsList
git commit -m "feat(frontend): WorkflowsList page with 3 states (empty/loading/error) and table"
```

---

## Task 10: CreateWorkflowDialog

**Files:**
- Replace: `frontend/src/pages/WorkflowsList/CreateWorkflowDialog.tsx`

- [ ] **Step 10.1: Implement**

Replace `frontend/src/pages/WorkflowsList/CreateWorkflowDialog.tsx` with:
```tsx
import { FormEvent, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { ApiError } from '@/api/client'
import { createWorkflow } from '@/api/workflows'
import { queryKeys } from '@/api/query-keys'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateWorkflowDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const qc = useQueryClient()
  const navigate = useNavigate()

  const mut = useMutation({
    mutationFn: () =>
      createWorkflow({ name: name.trim(), description: description.trim() || undefined }),
    onSuccess: wf => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.list() })
      toast.success('Workflow créé')
      reset()
      onOpenChange(false)
      navigate(`/workflows/${wf.id}`)
    },
    onError: err => {
      setError(err instanceof ApiError ? err.body.errors?.[0]?.message ?? err.message : 'Erreur')
    }
  })

  const reset = () => {
    setName('')
    setDescription('')
    setError(null)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Le nom est requis')
      return
    }
    mut.mutate()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Nouveau workflow"
      description="Donnez-lui un nom pour démarrer. Vous pourrez modifier description et graphe ensuite."
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="wf-name" className="mb-1 block text-sm font-medium text-fg">
            Nom <span className="text-danger">*</span>
          </label>
          <input
            id="wf-name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div>
          <label htmlFor="wf-desc" className="mb-1 block text-sm font-medium text-fg">
            Description
          </label>
          <textarea
            id="wf-desc"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" loading={mut.isPending}>
            Créer
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
```

- [ ] **Step 10.2: Commit**

```bash
git add frontend/src/pages/WorkflowsList/CreateWorkflowDialog.tsx
git commit -m "feat(frontend): CreateWorkflowDialog (form + mutation + redirect to editor)"
```

---

## Task 11: ImportWorkflowDialog

**Files:**
- Replace: `frontend/src/pages/WorkflowsList/ImportWorkflowDialog.tsx`

- [ ] **Step 11.1: Implement**

Replace `frontend/src/pages/WorkflowsList/ImportWorkflowDialog.tsx` with:
```tsx
import { ChangeEvent, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Graph } from '@rainpath/shared'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/Icon'
import { createWorkflow } from '@/api/workflows'
import { queryKeys } from '@/api/query-keys'
import { ApiError } from '@/api/client'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Parsed = { graph: Graph; suggestedName: string }

export function ImportWorkflowDialog({ open, onOpenChange }: Props) {
  const [issues, setIssues] = useState<string[]>([])
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [name, setName] = useState('')
  const qc = useQueryClient()
  const navigate = useNavigate()

  const reset = () => {
    setIssues([])
    setParsed(null)
    setName('')
  }

  const mut = useMutation({
    mutationFn: () =>
      createWorkflow({ name: name.trim() || parsed?.suggestedName || 'Workflow importé', graph: parsed?.graph }),
    onSuccess: wf => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.list() })
      toast.success('Workflow importé')
      reset()
      onOpenChange(false)
      navigate(`/workflows/${wf.id}`)
    },
    onError: err => {
      const msg = err instanceof ApiError ? err.body.errors?.[0]?.message ?? err.message : 'Erreur'
      setIssues([msg])
    }
  })

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    let text: string
    try {
      text = await file.text()
    } catch {
      setIssues(['Fichier illisible'])
      return
    }

    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      setIssues(['Fichier non JSON valide'])
      return
    }

    // Support two import shapes:
    //  (a) raw graph: { nodes, edges }
    //  (b) exported workflow: { name, graph: {...} }
    const candidate =
      json && typeof json === 'object' && 'graph' in (json as any) ? (json as any).graph : json
    const r = Graph.safeParse(candidate)
    if (!r.success) {
      setIssues(r.error.issues.slice(0, 5).map(i => `${i.path.join('.') || '·'}: ${i.message}`))
      setParsed(null)
      return
    }

    const suggested =
      (json && typeof json === 'object' && 'name' in (json as any)
        ? String((json as any).name)
        : null) ?? file.name.replace(/\.json$/i, '')
    setParsed({ graph: r.data, suggestedName: suggested })
    setName(suggested)
    setIssues([])
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Importer un workflow"
      description="Sélectionnez un fichier JSON exporté depuis RainPath."
    >
      <div className="space-y-4">
        <label className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-surface-muted text-sm text-fg-muted hover:bg-surface">
          <Icon name="Upload" size={20} />
          <span>Cliquer pour choisir un fichier JSON</span>
          <input type="file" accept=".json,application/json" className="hidden" onChange={handleFile} />
        </label>

        {parsed ? (
          <div className="rounded-md border border-border bg-surface-muted p-3 text-sm">
            <p className="font-medium text-fg">
              Graphe détecté — {parsed.graph.nodes.length} nœud(s), {parsed.graph.edges.length} arête(s)
            </p>
            <label htmlFor="import-name" className="mt-3 mb-1 block text-xs font-medium text-fg-muted">
              Nom du nouveau workflow
            </label>
            <input
              id="import-name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm"
            />
          </div>
        ) : null}

        {issues.length > 0 ? (
          <ul role="alert" className="space-y-1 rounded-md border border-danger bg-[#FEF2F2] p-3 text-sm text-danger">
            {issues.map((m, i) => (
              <li key={i}>• {m}</li>
            ))}
          </ul>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!parsed}
            loading={mut.isPending}
            onClick={() => mut.mutate()}
          >
            Importer
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
```

- [ ] **Step 11.2: Commit**

```bash
git add frontend/src/pages/WorkflowsList/ImportWorkflowDialog.tsx
git commit -m "feat(frontend): ImportWorkflowDialog (file → Zod parse → confirm → POST)"
```

---

## Task 12: DeleteWorkflowConfirm

**Files:**
- Replace: `frontend/src/pages/WorkflowsList/DeleteWorkflowConfirm.tsx`

- [ ] **Step 12.1: Implement**

Replace `frontend/src/pages/WorkflowsList/DeleteWorkflowConfirm.tsx` with:
```tsx
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import type { WorkflowSummary } from '@/api/workflows'

interface Props {
  open: boolean
  target: WorkflowSummary | null
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteWorkflowConfirm({ open, target, loading, onCancel, onConfirm }: Props) {
  const name = target?.name ?? ''
  return (
    <Dialog
      open={open}
      onOpenChange={o => !o && onCancel()}
      title={`Supprimer « ${name} » ?`}
      description="L’élément est archivé (suppression douce) et n’apparaît plus dans la liste."
      size="sm"
    >
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" autoFocus onClick={onCancel}>
          Annuler
        </Button>
        <Button type="button" variant="danger" loading={loading} onClick={onConfirm}>
          Supprimer
        </Button>
      </div>
    </Dialog>
  )
}
```

- [ ] **Step 12.2: Commit**

```bash
git add frontend/src/pages/WorkflowsList/DeleteWorkflowConfirm.tsx
git commit -m "feat(frontend): DeleteWorkflowConfirm (Radix dialog, focus on Annuler)"
```

---

## Task 13: Smoke run + final commit

- [ ] **Step 13.1: Full build**

Run: `pnpm --filter @rainpath/frontend build`
Expected: clean.

- [ ] **Step 13.2: Full test**

Run: `pnpm --filter @rainpath/frontend test`
Expected: 3 vitest files pass — `smoke.test.ts` (2), `workflows.test.ts` (4), `workflows-list.test.tsx` (3) = **9 tests pass**.

- [ ] **Step 13.3: Manual smoke against the live backend**

Make sure the backend is reachable (Phase 1A is live). In one terminal:
```bash
pnpm --filter @rainpath/backend dev
```

In a second terminal:
```bash
pnpm --filter @rainpath/frontend dev
```

Open `http://localhost:5173`. Verify:
1. `/` redirects to `/workflows`.
2. The list page shows the seeded example workflow from Phase 0.
3. `+ Nouveau workflow` opens a dialog; submitting redirects to the placeholder editor `/workflows/:id`.
4. The kebab menu on a row offers Duplicate, Export JSON, Delete.
5. Duplicate creates a new row with `(copie)` suffix.
6. Export JSON downloads a file with `.json` extension.
7. Delete opens a confirm dialog; confirming removes the row immediately and shows a success toast.
8. `Importer un JSON` accepts a previously-exported file and creates a new workflow.
9. A bad URL like `/foo` shows the 404 page.

Stop both servers.

- [ ] **Step 13.4: Push (only when user OKs it)**

Per the controller's prior practice — do **NOT** auto-push. Report status and let the controller decide.

---

## Self-review notes (post-plan)

**Spec coverage check**:
- ✅ §6.1 workflow REST routes consumed (`listWorkflows`, `getWorkflow`, `createWorkflow`, `updateWorkflow`, `duplicateWorkflow`, `deleteWorkflow`) — Task 4
- ✅ §7.1 routes `/`, `/workflows`, `/workflows/:id` + catch-all 404 — Task 7
- ✅ §7.5.b WorkflowsList page (table preferred, empty/loading/error states, kebab actions Duplicate/Export/Delete, Import flow with Zod safeParse + structured errors, Create modal redirects to editor) — Tasks 9, 10, 11, 12
- ✅ §7.7 Routing & errors (404 catch-all, ErrorBoundary) — Tasks 6, 7
- ✅ §7.7 Three states on every async surface — Task 9
- ✅ §7.9 Toasts via sonner, bottom-right, max 3, configured durations — Task 6
- ✅ §7.10 Empty state shape (centered, single primary CTA, no clip-art) — Task 9
- ✅ DS §7.1 buttons (4 variants, 3 sizes, focus ring) — Task 5
- ✅ DS §7.8 dialog (Radix, scrim, focus-trap automatic) — Task 5

**Out of scope (deferred to Phase 1B-B)**:
- WorkflowEditor canvas (replaced by `WorkflowEditorPlaceholder`)
- Zustand store, undo/redo, custom nodes/edges/background
- Node-template palette and shared edit modal
- Auto-save, validation banner, live incoherence prevention
- The `Rename` kebab item — appears trivial but spec wires it to a modal; deferred so create+rename UX is one cohesive piece of B-B work

**Type consistency check**:
- `WorkflowSummary` and `WorkflowDetail` (defined Task 4) consumed unchanged in Tasks 9–12.
- `Graph` Zod schema imported from `@rainpath/shared` in Tasks 4 + 11 — same shape.
- `queryKeys.workflows.list()` referenced consistently across Tasks 9, 10, 11.
- `ApiError` thrown from `apiFetch` (Task 3) and caught in Tasks 9–12.
- `createWorkflow({ name, graph? })` signature in Task 4 matches consumer call sites in Tasks 10 + 11.

**Placeholder scan**: clean. Two "stub" files explicitly created in Task 7 / 9 are replaced with real implementations in later tasks within this plan.

**Scope**: 13 tasks, all small/medium. Manual smoke in Task 13 exercises every CRUD path end-to-end against the live backend. The router is fully wired, leaving the editor route ready to receive the Phase 1B-B canvas.
