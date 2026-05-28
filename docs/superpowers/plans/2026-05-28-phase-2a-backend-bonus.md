# RainPath — Phase 2A Backend Bonus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the bonus backend modules required by the patient simulation feature: `PatientProfilesModule` (CRUD over `/api/patient-profiles`) and `PatientRunsModule` (run creation per workflow + the `advance` and `reset` endpoints that step a fictitious patient through a workflow graph).

**Architecture:**
- A pure function `resolveAdvance({ graph, currentNodeId, outcome })` lives in `backend/src/patient-runs/advance.ts` and computes the next node ID + handle. It throws typed exceptions that the service translates to HTTP 4xx. Pure-function isolation makes the advance algorithm fully testable without DB IO.
- `PatientProfilesService` follows the same shape as `WorkflowsService` (read via `buildSoftDeleteClient`, write via raw `prisma`). DELETE = soft-delete; **no cascade to runs** (per spec §6.3 — runs stay visible after profile deletion; the frontend renders a "Patient supprimé" placeholder later in Phase 2B).
- `PatientRunsService` reads runs and includes the related workflow + patient by joining via the raw `prisma` client (so soft-deleted patients still surface a name). `create()` seeds `currentNodeId` to the workflow's `start` node and seeds `history` with one entry. `advance()` runs `resolveAdvance`, persists, returns. `reset()` rewinds to start and clears history.
- Validation: DTO bodies parsed by the existing `ZodValidationPipe`. Spec-shaped 422 payloads via the existing `ZodExceptionFilter`. The advance logic throws domain exceptions (`HttpException` subclasses) that flow through Nest's default exception handler with structured bodies.
- Tests: 2 unit suites per service + 1 spec for `resolveAdvance` + 2 e2e suites.

**Tech Stack:** NestJS 10, Prisma 5/6, SQLite, `@rainpath/shared` (DTOs already exported in Phase 0). No new deps.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-28-rainpath-workflow-editor-design.md` — §5.1 Prisma schema, §6.3 patient endpoints (advance logic detailed there).
- Phase 1A plan (already shipped): `docs/superpowers/plans/2026-05-28-phase-1a-backend.md` — established patterns.
- **Known pitfalls**: `docs/superpowers/known-pitfalls.md` (read before starting). Especially relevant here:
  - Pitfall 4 (no semicolons / single quotes — backend matches the frontend style).
  - Pitfall 10 (supertest default-import workaround for backend e2e: `import * as request from 'supertest'` + `(request as any)(...)`).
  - Pitfall 11 (Jest `moduleNameMapper` for `@rainpath/shared` is already wired; tests can `import` from shared directly).
  - Pitfall 9 (`ValidationWarning` has no `edgeId` — not directly used in this phase, but be aware if you touch the validation surface).

---

## State after Phase 1A (DO NOT redo)

- `backend/prisma/schema.prisma` already declares `PatientProfile` and `PatientRun` with `deletedAt` + indexes. **No migration needed** — the tables already exist.
- `backend/src/prisma/prisma.service.ts` exposes `PrismaService` and `buildSoftDeleteClient(base)`.
- `backend/src/validation/{zod-validation.pipe.ts, zod-exception.filter.ts, graph-validation.error.ts, format-zod-error.ts}` are all live.
- `backend/src/workflows/graph-codec.ts` exports `encodeGraph` / `decodeGraph` with drift detection.
- `backend/test/test-app.ts` exports `buildTestApp()` and `resetTables(prisma)`. `resetTables` already deletes from `patientRun` and `patientProfile` first (correct order for FK constraints).
- `backend/test/jest-e2e.json` is configured with `globalSetup` that resets `e2e.db` and the `moduleNameMapper` for `@rainpath/shared`.
- `@rainpath/shared` exports DTOs: `CreatePatientProfileDto`, `UpdatePatientProfileDto`, `CreatePatientRunDto`, `AdvancePatientRunDto`. (Confirmed from Phase 0 Task 6.)

---

## File structure (this plan creates)

```
backend/
├── src/
│   ├── app.module.ts                                    # MODIFY — register two new modules
│   ├── patient-profiles/
│   │   ├── patient-profiles.module.ts                   # CREATE
│   │   ├── patient-profiles.controller.ts               # CREATE
│   │   ├── patient-profiles.service.ts                  # CREATE
│   │   └── patient-profiles.service.spec.ts             # CREATE — Jest unit
│   └── patient-runs/
│       ├── advance.ts                                   # CREATE — pure function `resolveAdvance`
│       ├── advance.spec.ts                              # CREATE — Jest unit for the pure function
│       ├── patient-runs.module.ts                       # CREATE
│       ├── patient-runs.controller.ts                   # CREATE
│       ├── patient-runs.service.ts                      # CREATE
│       └── patient-runs.service.spec.ts                 # CREATE — Jest unit
└── test/
    ├── patient-profiles.e2e-spec.ts                     # CREATE
    └── patient-runs.e2e-spec.ts                         # CREATE
```

---

## Conventions across tasks

- **Response envelopes**:
  - `GET /patient-profiles` returns `Array<{ id, name, email, phone, whatsapp, address, updatedAt }>`. `email/phone/whatsapp/address` are `string | null`, never undefined.
  - `GET /workflows/:id/patient-runs` returns `Array<{ id, patient: { id, name, deletedAt: string | null }, currentNodeId, updatedAt }>`. Including `deletedAt` lets the frontend render "Patient supprimé" without an extra fetch.
  - `GET /patient-runs/:id` returns the full run: `{ id, workflowId, workflow: { id, name, graph }, patient: {...full profile incl. deletedAt}, currentNodeId, history: RunHistoryEntry[], updatedAt }`. The graph is the parsed `Graph` (decoded via `decodeGraph`).
- **`RunHistoryEntry`** shape: `{ nodeId: string; enteredAt: string; outcome?: string }`. Persisted as a JSON-stringified array in `PatientRun.history` (SQLite `String` column).
- **Advance failure codes** (from `resolveAdvance`):
  - `workflow_already_finished` → 400
  - `condition_outcome_required` → 422 (the user didn't provide `outcome` for a `condition` node)
  - `unhandled_outcome` → 422 (sent outcome doesn't match any output condition)
  - `no_outgoing_edge` → 422 (the current node has no edge for the resolved handle)
- **Soft-delete cascade policy**:
  - `WorkflowsService.softDelete(id)` already cascades to `PatientRun`s (Phase 1A — preserve).
  - `PatientProfilesService.softDelete(id)` does NOT cascade. The runs stay visible; the frontend handles UI fallback.
- **Imports of `@rainpath/shared`** in tests work directly via `moduleNameMapper` (Pitfall 11). No special config needed.

---

## Task 1: `resolveAdvance` pure function + spec (TDD)

**Files:**
- Create: `backend/src/patient-runs/advance.ts`
- Create: `backend/src/patient-runs/advance.spec.ts`

- [ ] **Step 1.1: Write the failing spec**

Write `backend/src/patient-runs/advance.spec.ts`:
```ts
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
    // simple mode but only the success edge wired
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
```

- [ ] **Step 1.2: Run, verify FAIL**

Run: `pnpm --filter @rainpath/backend test -- advance.spec 2>&1 | tail -15`
Expected: FAIL — module not found.

- [ ] **Step 1.3: Implement `resolveAdvance`**

Write `backend/src/patient-runs/advance.ts`:
```ts
import type { Graph } from '@rainpath/shared'

export type AdvanceErrorCode =
  | 'workflow_already_finished'
  | 'condition_outcome_required'
  | 'unhandled_outcome'
  | 'no_outgoing_edge'
  | 'current_node_missing'

export class AdvanceError extends Error {
  constructor(
    public readonly code: AdvanceErrorCode,
    public readonly status: number,
    public readonly detail?: Record<string, unknown>
  ) {
    super(code)
    this.name = 'AdvanceError'
  }
}

interface Ctx {
  graph: Graph
  currentNodeId: string
  outcome?: string
}

type ResolvedHandle =
  | { type: 'single' }
  | { type: 'handle'; handle: string }

function resolveHandle(node: Graph['nodes'][number], outcome: string | undefined): ResolvedHandle {
  const data = node.data

  if (data.kind === 'start') return { type: 'single' }

  if (data.kind === 'condition') {
    if (outcome !== 'true' && outcome !== 'false') {
      throw new AdvanceError('condition_outcome_required', 422, { nodeId: node.id })
    }
    return { type: 'handle', handle: outcome }
  }

  // send_* family
  if (
    data.kind === 'send_email' ||
    data.kind === 'send_sms' ||
    data.kind === 'send_whatsapp' ||
    data.kind === 'send_postal'
  ) {
    const out = data.params.output
    if (out.mode === 'single') return { type: 'single' }

    if (out.mode === 'simple') {
      if (outcome && out.successCondition.statuses.includes(outcome)) {
        return { type: 'handle', handle: 'success' }
      }
      return { type: 'handle', handle: 'failure' }
    }

    // multi
    if (!outcome) {
      throw new AdvanceError('unhandled_outcome', 422, {
        nodeId: node.id,
        outcome: null,
        availableStatuses: out.outputs.flatMap(o => o.condition.statuses)
      })
    }
    const match = out.outputs.find(o => o.condition.statuses.includes(outcome))
    if (!match) {
      throw new AdvanceError('unhandled_outcome', 422, {
        nodeId: node.id,
        outcome,
        availableStatuses: out.outputs.flatMap(o => o.condition.statuses)
      })
    }
    return { type: 'handle', handle: match.id }
  }

  // end (or anything else)
  throw new AdvanceError('workflow_already_finished', 400, { nodeId: node.id })
}

/**
 * Resolve the next node ID given the current node and an optional outcome.
 * Throws `AdvanceError` with a typed code on any failure.
 */
export function resolveAdvance(ctx: Ctx): { nextNodeId: string; outcome?: string } {
  const current = ctx.graph.nodes.find(n => n.id === ctx.currentNodeId)
  if (!current) {
    throw new AdvanceError('current_node_missing', 500, { nodeId: ctx.currentNodeId })
  }

  if (current.data.kind === 'end') {
    throw new AdvanceError('workflow_already_finished', 400, { nodeId: current.id })
  }

  const resolved = resolveHandle(current, ctx.outcome)

  let edge: Graph['edges'][number] | undefined
  if (resolved.type === 'single') {
    edge = ctx.graph.edges.find(e => e.source === current.id && !e.sourceHandle)
    // Fallback: if the source happens to have a sourceHandle but only one outgoing edge.
    if (!edge) {
      const outgoing = ctx.graph.edges.filter(e => e.source === current.id)
      if (outgoing.length === 1) edge = outgoing[0]
    }
  } else {
    edge = ctx.graph.edges.find(e => e.source === current.id && e.sourceHandle === resolved.handle)
  }

  if (!edge) {
    throw new AdvanceError('no_outgoing_edge', 422, {
      nodeId: current.id,
      handle: resolved.type === 'handle' ? resolved.handle : null
    })
  }

  return { nextNodeId: edge.target, outcome: ctx.outcome }
}
```

- [ ] **Step 1.4: Run, verify PASS**

Run: `pnpm --filter @rainpath/backend test -- advance.spec 2>&1 | tail -15`
Expected: 9 specs pass.

- [ ] **Step 1.5: Commit**

```bash
git add backend/src/patient-runs/advance.ts backend/src/patient-runs/advance.spec.ts
git commit -m "feat(backend): resolveAdvance pure function for patient run progression"
```

---

## Task 2: `PatientProfilesService` + spec

**Files:**
- Create: `backend/src/patient-profiles/patient-profiles.service.ts`
- Create: `backend/src/patient-profiles/patient-profiles.service.spec.ts`

- [ ] **Step 2.1: Write the failing spec**

Write `backend/src/patient-profiles/patient-profiles.service.spec.ts`:
```ts
import { Test } from '@nestjs/testing'
import { execSync } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaModule } from '../prisma/prisma.module'
import { PrismaService } from '../prisma/prisma.service'
import { PatientProfilesService } from './patient-profiles.service'

const TEST_DB = join(__dirname, '..', '..', 'test', 'patient-profiles-svc.db')

function resetDb() {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB)
  process.env.DATABASE_URL = `file:${TEST_DB}`
  execSync('pnpm exec prisma db push --skip-generate', {
    cwd: join(__dirname, '..', '..'),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
  })
}

describe('PatientProfilesService', () => {
  let service: PatientProfilesService
  let prisma: PrismaService

  beforeAll(() => { resetDb() })
  afterAll(async () => { await prisma?.$disconnect() })

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [PatientProfilesService]
    }).compile()
    service = moduleRef.get(PatientProfilesService)
    prisma = moduleRef.get(PrismaService)
    await prisma.patientRun.deleteMany()
    await prisma.patientProfile.deleteMany()
  })

  it('create() persists a profile with nullable fields preserved', async () => {
    const p = await service.create({ name: 'Alice', email: 'a@b.co' })
    expect(p).toMatchObject({ name: 'Alice', email: 'a@b.co', phone: null, whatsapp: null, address: null })
  })

  it('list() omits soft-deleted profiles', async () => {
    const a = await service.create({ name: 'Alice' })
    await service.create({ name: 'Bob' })
    await service.softDelete(a.id)
    const list = await service.list()
    expect(list.map(p => p.name).sort()).toEqual(['Bob'])
  })

  it('get() throws 404 on unknown id', async () => {
    await expect(service.get('nope')).rejects.toMatchObject({ status: 404 })
  })

  it('update() accepts nulls to clear fields', async () => {
    const p = await service.create({ name: 'Alice', email: 'a@b.co', phone: '+33...' })
    const updated = await service.update(p.id, { email: null, phone: null })
    expect(updated.email).toBeNull()
    expect(updated.phone).toBeNull()
    expect(updated.name).toBe('Alice')
  })

  it('softDelete() does NOT cascade to runs (spec §6.3)', async () => {
    const p = await service.create({ name: 'Alice' })
    const wf = await prisma.workflow.create({
      data: { name: 'WF', graph: JSON.stringify({ nodes: [], edges: [] }) }
    })
    const run = await prisma.patientRun.create({
      data: { workflowId: wf.id, patientId: p.id, currentNodeId: null, history: '[]' }
    })
    await service.softDelete(p.id)
    const reloaded = await prisma.patientRun.findUnique({ where: { id: run.id } })
    expect(reloaded?.deletedAt).toBeNull()
  })
})
```

- [ ] **Step 2.2: Run, verify FAIL**

Run: `pnpm --filter @rainpath/backend test -- patient-profiles.service.spec 2>&1 | tail -15`
Expected: FAIL — service not found.

- [ ] **Step 2.3: Implement the service**

Write `backend/src/patient-profiles/patient-profiles.service.ts`:
```ts
import { Injectable, NotFoundException } from '@nestjs/common'
import type { CreatePatientProfileDto, UpdatePatientProfileDto } from '@rainpath/shared'
import { PrismaService, buildSoftDeleteClient } from '../prisma/prisma.service'

type PatientProfileOut = {
  id: string
  name: string
  email: string | null
  phone: string | null
  whatsapp: string | null
  address: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

@Injectable()
export class PatientProfilesService {
  private readonly db: ReturnType<typeof buildSoftDeleteClient>

  constructor(private readonly prisma: PrismaService) {
    this.db = buildSoftDeleteClient(prisma)
  }

  async list(): Promise<PatientProfileOut[]> {
    const rows = await this.db.patientProfile.findMany({ orderBy: { updatedAt: 'desc' } })
    return rows.map(r => this.toResponse(r))
  }

  async get(id: string): Promise<PatientProfileOut> {
    const row = await this.db.patientProfile.findUnique({ where: { id } })
    if (!row) throw new NotFoundException(`PatientProfile ${id} not found`)
    return this.toResponse(row)
  }

  async create(dto: CreatePatientProfileDto): Promise<PatientProfileOut> {
    const row = await this.prisma.patientProfile.create({
      data: {
        name: dto.name,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        whatsapp: dto.whatsapp ?? null,
        address: dto.address ?? null
      }
    })
    return this.toResponse(row)
  }

  async update(id: string, dto: UpdatePatientProfileDto): Promise<PatientProfileOut> {
    const existing = await this.db.patientProfile.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`PatientProfile ${id} not found`)
    const row = await this.prisma.patientProfile.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.whatsapp !== undefined ? { whatsapp: dto.whatsapp } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {})
      }
    })
    return this.toResponse(row)
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.db.patientProfile.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`PatientProfile ${id} not found`)
    await this.prisma.patientProfile.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  private toResponse(row: {
    id: string
    name: string
    email: string | null
    phone: string | null
    whatsapp: string | null
    address: string | null
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
  }): PatientProfileOut {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      whatsapp: row.whatsapp,
      address: row.address,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null
    }
  }
}
```

- [ ] **Step 2.4: Run, verify PASS**

Run: `pnpm --filter @rainpath/backend test -- patient-profiles.service.spec 2>&1 | tail -15`
Expected: 5 specs pass.

- [ ] **Step 2.5: Commit**

```bash
git add backend/src/patient-profiles/patient-profiles.service.ts backend/src/patient-profiles/patient-profiles.service.spec.ts
git commit -m "feat(backend): PatientProfilesService CRUD with soft-delete (no run cascade)"
```

---

## Task 3: `PatientProfilesController` + `PatientProfilesModule`

**Files:**
- Create: `backend/src/patient-profiles/patient-profiles.controller.ts`
- Create: `backend/src/patient-profiles/patient-profiles.module.ts`

- [ ] **Step 3.1: Controller**

Write `backend/src/patient-profiles/patient-profiles.controller.ts`:
```ts
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UsePipes } from '@nestjs/common'
import { CreatePatientProfileDto, UpdatePatientProfileDto } from '@rainpath/shared'
import { ZodValidationPipe } from '../validation/zod-validation.pipe'
import { PatientProfilesService } from './patient-profiles.service'

@Controller('patient-profiles')
export class PatientProfilesController {
  constructor(private readonly service: PatientProfilesService) {}

  @Get()
  list() {
    return this.service.list()
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreatePatientProfileDto))
  create(@Body() body: CreatePatientProfileDto) {
    return this.service.create(body)
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdatePatientProfileDto))
  update(@Param('id') id: string, @Body() body: UpdatePatientProfileDto) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.service.softDelete(id)
  }
}
```

- [ ] **Step 3.2: Module**

Write `backend/src/patient-profiles/patient-profiles.module.ts`:
```ts
import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { PatientProfilesController } from './patient-profiles.controller'
import { PatientProfilesService } from './patient-profiles.service'

@Module({
  imports: [PrismaModule],
  controllers: [PatientProfilesController],
  providers: [PatientProfilesService]
})
export class PatientProfilesModule {}
```

- [ ] **Step 3.3: Commit**

```bash
git add backend/src/patient-profiles/patient-profiles.controller.ts backend/src/patient-profiles/patient-profiles.module.ts
git commit -m "feat(backend): PatientProfilesController + module"
```

---

## Task 4: `PatientRunsService` + spec

The service handles all five operations: `listForWorkflow`, `get`, `create`, `advance`, `reset`. It uses `decodeGraph` for the workflow's graph blob, and `resolveAdvance` for the advance logic.

**Files:**
- Create: `backend/src/patient-runs/patient-runs.service.ts`
- Create: `backend/src/patient-runs/patient-runs.service.spec.ts`

- [ ] **Step 4.1: Write the failing spec**

Write `backend/src/patient-runs/patient-runs.service.spec.ts`:
```ts
import { Test } from '@nestjs/testing'
import { execSync } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { START_Y } from '@rainpath/shared'
import { PrismaModule } from '../prisma/prisma.module'
import { PrismaService } from '../prisma/prisma.service'
import { PatientRunsService } from './patient-runs.service'

const TEST_DB = join(__dirname, '..', '..', 'test', 'patient-runs-svc.db')

function resetDb() {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB)
  process.env.DATABASE_URL = `file:${TEST_DB}`
  execSync('pnpm exec prisma db push --skip-generate', {
    cwd: join(__dirname, '..', '..'),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
  })
}

const SIMPLE_GRAPH = {
  nodes: [
    { id: 's', position: { x: 0, y: START_Y }, data: { kind: 'start' } },
    { id: 'a', position: { x: 5, y: START_Y }, data: {
      kind: 'send_email', params: { subject: '', body: '', output: { mode: 'single' } }
    }},
    { id: 'e', position: { x: 10, y: START_Y }, data: { kind: 'end' } }
  ],
  edges: [
    { id: 'e1', source: 's', target: 'a', daysAfter: 5 },
    { id: 'e2', source: 'a', target: 'e', daysAfter: 5 }
  ]
}

describe('PatientRunsService', () => {
  let service: PatientRunsService
  let prisma: PrismaService

  beforeAll(() => { resetDb() })
  afterAll(async () => { await prisma?.$disconnect() })

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [PatientRunsService]
    }).compile()
    service = moduleRef.get(PatientRunsService)
    prisma = moduleRef.get(PrismaService)
    await prisma.patientRun.deleteMany()
    await prisma.patientProfile.deleteMany()
    await prisma.workflow.deleteMany()
  })

  async function seedWorkflowAndPatient() {
    const wf = await prisma.workflow.create({
      data: { name: 'WF', graph: JSON.stringify(SIMPLE_GRAPH) }
    })
    const patient = await prisma.patientProfile.create({ data: { name: 'Alice' } })
    return { wf, patient }
  }

  it('create() seeds currentNodeId to start and history with one entry', async () => {
    const { wf, patient } = await seedWorkflowAndPatient()
    const run = await service.create(wf.id, { patientId: patient.id })
    expect(run.currentNodeId).toBe('s')
    expect(run.history).toHaveLength(1)
    expect(run.history[0]?.nodeId).toBe('s')
  })

  it('listForWorkflow() returns runs (incl. soft-deleted patients in the join)', async () => {
    const { wf, patient } = await seedWorkflowAndPatient()
    await service.create(wf.id, { patientId: patient.id })
    await prisma.patientProfile.update({ where: { id: patient.id }, data: { deletedAt: new Date() } })
    const list = await service.listForWorkflow(wf.id)
    expect(list).toHaveLength(1)
    expect(list[0]?.patient.name).toBe('Alice')
    expect(list[0]?.patient.deletedAt).not.toBeNull()
  })

  it('get() returns the full run with parsed graph and patient', async () => {
    const { wf, patient } = await seedWorkflowAndPatient()
    const created = await service.create(wf.id, { patientId: patient.id })
    const full = await service.get(created.id)
    expect(full.workflow.id).toBe(wf.id)
    expect(full.workflow.graph.nodes.length).toBe(3)
    expect(full.patient.name).toBe('Alice')
  })

  it('advance() with single-mode email follows the only edge', async () => {
    const { wf, patient } = await seedWorkflowAndPatient()
    const created = await service.create(wf.id, { patientId: patient.id })
    await service.advance(created.id, {}) // s → a
    const afterEmail = await service.advance(created.id, {}) // a → e (single mode, outcome ignored)
    expect(afterEmail.currentNodeId).toBe('e')
    expect(afterEmail.history.length).toBe(3)
  })

  it('advance() on an end node throws 400', async () => {
    const { wf, patient } = await seedWorkflowAndPatient()
    const created = await service.create(wf.id, { patientId: patient.id })
    await service.advance(created.id, {})
    await service.advance(created.id, {})
    await expect(service.advance(created.id, {})).rejects.toMatchObject({ status: 400 })
  })

  it('reset() rewinds currentNodeId to start and seeds history with one entry', async () => {
    const { wf, patient } = await seedWorkflowAndPatient()
    const created = await service.create(wf.id, { patientId: patient.id })
    await service.advance(created.id, {})
    await service.advance(created.id, {})
    const reset = await service.reset(created.id)
    expect(reset.currentNodeId).toBe('s')
    expect(reset.history).toHaveLength(1)
  })
})
```

- [ ] **Step 4.2: Run, verify FAIL**

Run: `pnpm --filter @rainpath/backend test -- patient-runs.service.spec 2>&1 | tail -15`
Expected: FAIL — service not found.

- [ ] **Step 4.3: Implement the service**

Write `backend/src/patient-runs/patient-runs.service.ts`:
```ts
import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common'
import type { AdvancePatientRunDto, CreatePatientRunDto, Graph } from '@rainpath/shared'
import { PrismaService, buildSoftDeleteClient } from '../prisma/prisma.service'
import { decodeGraph } from '../workflows/graph-codec'
import { AdvanceError, resolveAdvance } from './advance'

type RunHistoryEntry = { nodeId: string; enteredAt: string; outcome?: string }

type PatientRunSummary = {
  id: string
  patient: { id: string; name: string; deletedAt: string | null }
  currentNodeId: string | null
  updatedAt: string
}

type PatientRunFull = {
  id: string
  workflowId: string
  workflow: { id: string; name: string; graph: Graph }
  patient: {
    id: string
    name: string
    email: string | null
    phone: string | null
    whatsapp: string | null
    address: string | null
    deletedAt: string | null
  }
  currentNodeId: string | null
  history: RunHistoryEntry[]
  createdAt: string
  updatedAt: string
}

@Injectable()
export class PatientRunsService {
  private readonly db: ReturnType<typeof buildSoftDeleteClient>

  constructor(private readonly prisma: PrismaService) {
    this.db = buildSoftDeleteClient(prisma)
  }

  async listForWorkflow(workflowId: string): Promise<PatientRunSummary[]> {
    const wf = await this.db.workflow.findUnique({ where: { id: workflowId } })
    if (!wf) throw new NotFoundException(`Workflow ${workflowId} not found`)

    const rows = await this.db.patientRun.findMany({
      where: { workflowId },
      orderBy: { updatedAt: 'desc' }
    })

    if (rows.length === 0) return []

    // Use the unfiltered prisma client so soft-deleted profiles still join.
    const patientIds = Array.from(new Set(rows.map(r => r.patientId)))
    const patients = await this.prisma.patientProfile.findMany({
      where: { id: { in: patientIds } }
    })
    const byId = new Map(patients.map(p => [p.id, p]))

    return rows.map(r => {
      const p = byId.get(r.patientId)
      return {
        id: r.id,
        patient: {
          id: r.patientId,
          name: p?.name ?? 'Patient inconnu',
          deletedAt: p?.deletedAt ? p.deletedAt.toISOString() : null
        },
        currentNodeId: r.currentNodeId,
        updatedAt: r.updatedAt.toISOString()
      }
    })
  }

  async get(id: string): Promise<PatientRunFull> {
    const row = await this.db.patientRun.findUnique({ where: { id } })
    if (!row) throw new NotFoundException(`PatientRun ${id} not found`)
    const wf = await this.prisma.workflow.findUnique({ where: { id: row.workflowId } })
    if (!wf) throw new NotFoundException(`Workflow ${row.workflowId} not found`)
    const patient = await this.prisma.patientProfile.findUnique({ where: { id: row.patientId } })
    if (!patient) throw new NotFoundException(`PatientProfile ${row.patientId} not found`)

    const graph = decodeGraph(wf.graph, wf.id)
    const history = JSON.parse(row.history) as RunHistoryEntry[]

    return {
      id: row.id,
      workflowId: row.workflowId,
      workflow: { id: wf.id, name: wf.name, graph },
      patient: {
        id: patient.id,
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        whatsapp: patient.whatsapp,
        address: patient.address,
        deletedAt: patient.deletedAt ? patient.deletedAt.toISOString() : null
      },
      currentNodeId: row.currentNodeId,
      history,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    }
  }

  async create(workflowId: string, dto: CreatePatientRunDto): Promise<PatientRunFull> {
    const wf = await this.db.workflow.findUnique({ where: { id: workflowId } })
    if (!wf) throw new NotFoundException(`Workflow ${workflowId} not found`)
    const patient = await this.db.patientProfile.findUnique({ where: { id: dto.patientId } })
    if (!patient) throw new NotFoundException(`PatientProfile ${dto.patientId} not found`)

    const graph = decodeGraph(wf.graph, wf.id)
    const startNode = graph.nodes.find(n => n.data.kind === 'start')
    if (!startNode) throw new BadRequestException(`Workflow ${workflowId} has no start node`)

    const history: RunHistoryEntry[] = [{ nodeId: startNode.id, enteredAt: new Date().toISOString() }]

    const row = await this.prisma.patientRun.create({
      data: {
        workflowId,
        patientId: dto.patientId,
        currentNodeId: startNode.id,
        history: JSON.stringify(history)
      }
    })

    return this.get(row.id)
  }

  async advance(id: string, dto: AdvancePatientRunDto): Promise<PatientRunFull> {
    const row = await this.db.patientRun.findUnique({ where: { id } })
    if (!row) throw new NotFoundException(`PatientRun ${id} not found`)
    if (!row.currentNodeId) throw new BadRequestException(`PatientRun ${id} has no current node`)

    const wf = await this.prisma.workflow.findUnique({ where: { id: row.workflowId } })
    if (!wf) throw new NotFoundException(`Workflow ${row.workflowId} not found`)
    const graph = decodeGraph(wf.graph, wf.id)

    let result: { nextNodeId: string; outcome?: string }
    try {
      result = resolveAdvance({ graph, currentNodeId: row.currentNodeId, outcome: dto.outcome })
    } catch (e) {
      if (e instanceof AdvanceError) {
        throw new HttpException(
          { statusCode: e.status, errors: [{ code: e.code, message: e.message, ...e.detail }], warnings: [] },
          e.status
        )
      }
      throw e
    }

    const history = JSON.parse(row.history) as RunHistoryEntry[]
    history.push({
      nodeId: result.nextNodeId,
      enteredAt: new Date().toISOString(),
      outcome: result.outcome
    })

    await this.prisma.patientRun.update({
      where: { id },
      data: {
        currentNodeId: result.nextNodeId,
        history: JSON.stringify(history)
      }
    })

    return this.get(id)
  }

  async reset(id: string): Promise<PatientRunFull> {
    const row = await this.db.patientRun.findUnique({ where: { id } })
    if (!row) throw new NotFoundException(`PatientRun ${id} not found`)
    const wf = await this.prisma.workflow.findUnique({ where: { id: row.workflowId } })
    if (!wf) throw new NotFoundException(`Workflow ${row.workflowId} not found`)

    const graph = decodeGraph(wf.graph, wf.id)
    const startNode = graph.nodes.find(n => n.data.kind === 'start')
    if (!startNode) throw new BadRequestException(`Workflow ${row.workflowId} has no start node`)

    const history: RunHistoryEntry[] = [{ nodeId: startNode.id, enteredAt: new Date().toISOString() }]

    await this.prisma.patientRun.update({
      where: { id },
      data: {
        currentNodeId: startNode.id,
        history: JSON.stringify(history)
      }
    })

    return this.get(id)
  }
}
```

- [ ] **Step 4.4: Run, verify PASS**

Run: `pnpm --filter @rainpath/backend test -- patient-runs.service.spec 2>&1 | tail -15`
Expected: 6 specs pass.

- [ ] **Step 4.5: Commit**

```bash
git add backend/src/patient-runs/patient-runs.service.ts backend/src/patient-runs/patient-runs.service.spec.ts
git commit -m "feat(backend): PatientRunsService (create/list/get/advance/reset)"
```

---

## Task 5: `PatientRunsController` + `PatientRunsModule`

**Files:**
- Create: `backend/src/patient-runs/patient-runs.controller.ts`
- Create: `backend/src/patient-runs/patient-runs.module.ts`

- [ ] **Step 5.1: Controller**

Write `backend/src/patient-runs/patient-runs.controller.ts`:
```ts
import { Body, Controller, Get, Param, Post, UsePipes } from '@nestjs/common'
import { AdvancePatientRunDto, CreatePatientRunDto } from '@rainpath/shared'
import { ZodValidationPipe } from '../validation/zod-validation.pipe'
import { PatientRunsService } from './patient-runs.service'

@Controller()
export class PatientRunsController {
  constructor(private readonly service: PatientRunsService) {}

  @Get('workflows/:workflowId/patient-runs')
  listForWorkflow(@Param('workflowId') workflowId: string) {
    return this.service.listForWorkflow(workflowId)
  }

  @Post('workflows/:workflowId/patient-runs')
  @UsePipes(new ZodValidationPipe(CreatePatientRunDto))
  create(@Param('workflowId') workflowId: string, @Body() body: CreatePatientRunDto) {
    return this.service.create(workflowId, body)
  }

  @Get('patient-runs/:id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post('patient-runs/:id/advance')
  @UsePipes(new ZodValidationPipe(AdvancePatientRunDto))
  advance(@Param('id') id: string, @Body() body: AdvancePatientRunDto) {
    return this.service.advance(id, body)
  }

  @Post('patient-runs/:id/reset')
  reset(@Param('id') id: string) {
    return this.service.reset(id)
  }
}
```

Note: the controller carries no class-level prefix because the routes use two different namespaces (`/workflows/:id/patient-runs` and `/patient-runs/:id/...`). The app-wide `/api` prefix from `main.ts` still applies.

- [ ] **Step 5.2: Module**

Write `backend/src/patient-runs/patient-runs.module.ts`:
```ts
import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { PatientRunsController } from './patient-runs.controller'
import { PatientRunsService } from './patient-runs.service'

@Module({
  imports: [PrismaModule],
  controllers: [PatientRunsController],
  providers: [PatientRunsService]
})
export class PatientRunsModule {}
```

- [ ] **Step 5.3: Commit**

```bash
git add backend/src/patient-runs/patient-runs.controller.ts backend/src/patient-runs/patient-runs.module.ts
git commit -m "feat(backend): PatientRunsController + module (CRUD + advance + reset)"
```

---

## Task 6: Register modules in `AppModule`

**Files:**
- Modify: `backend/src/app.module.ts`

- [ ] **Step 6.1: Update `AppModule`**

Replace `backend/src/app.module.ts` with:
```ts
import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { WorkflowsModule } from './workflows/workflows.module'
import { NodeTemplatesModule } from './node-templates/node-templates.module'
import { PatientProfilesModule } from './patient-profiles/patient-profiles.module'
import { PatientRunsModule } from './patient-runs/patient-runs.module'

@Module({
  imports: [
    PrismaModule,
    WorkflowsModule,
    NodeTemplatesModule,
    PatientProfilesModule,
    PatientRunsModule
  ]
})
export class AppModule {}
```

- [ ] **Step 6.2: Build sanity**

Run: `pnpm --filter @rainpath/backend build 2>&1 | tail -5`
Expected: clean.

- [ ] **Step 6.3: Commit**

```bash
git add backend/src/app.module.ts
git commit -m "feat(backend): register PatientProfilesModule + PatientRunsModule"
```

---

## Task 7: E2E — patient profiles

**Files:**
- Create: `backend/test/patient-profiles.e2e-spec.ts`

- [ ] **Step 7.1: Write the e2e spec**

Write `backend/test/patient-profiles.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { PrismaService } from '../src/prisma/prisma.service'
import { buildTestApp, resetTables } from './test-app'

describe('PatientProfiles (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => { ({ app, prisma } = await buildTestApp()) })
  afterAll(async () => { await app.close() })
  beforeEach(async () => { await resetTables(prisma) })

  it('POST /api/patient-profiles creates a profile', async () => {
    const res = await (request as any)(app.getHttpServer())
      .post('/api/patient-profiles')
      .send({ name: 'Alice', email: 'a@b.co' })
      .expect(201)
    expect(res.body.name).toBe('Alice')
    expect(res.body.email).toBe('a@b.co')
    expect(res.body.phone).toBeNull()
  })

  it('POST /api/patient-profiles rejects empty name (422)', async () => {
    const res = await (request as any)(app.getHttpServer())
      .post('/api/patient-profiles')
      .send({ name: '' })
      .expect(422)
    expect(res.body.errors.length).toBeGreaterThanOrEqual(1)
  })

  it('GET /api/patient-profiles lists active profiles', async () => {
    await (request as any)(app.getHttpServer()).post('/api/patient-profiles').send({ name: 'Alice' })
    await (request as any)(app.getHttpServer()).post('/api/patient-profiles').send({ name: 'Bob' })
    const res = await (request as any)(app.getHttpServer()).get('/api/patient-profiles').expect(200)
    expect(res.body.map((p: any) => p.name).sort()).toEqual(['Alice', 'Bob'])
  })

  it('PATCH /api/patient-profiles/:id accepts null to clear a field', async () => {
    const created = await (request as any)(app.getHttpServer())
      .post('/api/patient-profiles')
      .send({ name: 'Alice', email: 'a@b.co' })
    const res = await (request as any)(app.getHttpServer())
      .patch(`/api/patient-profiles/${created.body.id}`)
      .send({ email: null })
      .expect(200)
    expect(res.body.email).toBeNull()
  })

  it('DELETE /api/patient-profiles/:id soft-deletes', async () => {
    const created = await (request as any)(app.getHttpServer())
      .post('/api/patient-profiles')
      .send({ name: 'Doomed' })
    await (request as any)(app.getHttpServer())
      .delete(`/api/patient-profiles/${created.body.id}`)
      .expect(204)
    const list = await (request as any)(app.getHttpServer()).get('/api/patient-profiles').expect(200)
    expect(list.body.find((p: any) => p.id === created.body.id)).toBeUndefined()
  })
})
```

- [ ] **Step 7.2: Run e2e**

Run: `pnpm --filter @rainpath/backend test:e2e -- patient-profiles 2>&1 | tail -20`
Expected: 5 specs pass.

- [ ] **Step 7.3: Commit**

```bash
git add backend/test/patient-profiles.e2e-spec.ts
git commit -m "test(backend): e2e suite for /api/patient-profiles"
```

---

## Task 8: E2E — patient runs (full advance journey)

**Files:**
- Create: `backend/test/patient-runs.e2e-spec.ts`

- [ ] **Step 8.1: Write the e2e spec**

Write `backend/test/patient-runs.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { START_Y } from '@rainpath/shared'
import { PrismaService } from '../src/prisma/prisma.service'
import { buildTestApp, resetTables } from './test-app'

const SIMPLE_GRAPH = {
  nodes: [
    { id: 's', position: { x: 0, y: START_Y }, data: { kind: 'start' } },
    { id: 'a', position: { x: 5, y: START_Y }, data: {
      kind: 'send_email', params: { subject: '', body: '', output: { mode: 'single' } }
    }},
    { id: 'e', position: { x: 10, y: START_Y }, data: { kind: 'end' } }
  ],
  edges: [
    { id: 'e1', source: 's', target: 'a', daysAfter: 5 },
    { id: 'e2', source: 'a', target: 'e', daysAfter: 5 }
  ]
}

describe('PatientRuns (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => { ({ app, prisma } = await buildTestApp()) })
  afterAll(async () => { await app.close() })
  beforeEach(async () => { await resetTables(prisma) })

  async function seed() {
    const wfRes = await (request as any)(app.getHttpServer())
      .post('/api/workflows')
      .send({ name: 'Simple', graph: SIMPLE_GRAPH })
    const patientRes = await (request as any)(app.getHttpServer())
      .post('/api/patient-profiles')
      .send({ name: 'Alice', email: 'alice@example.com' })
    return { workflowId: wfRes.body.id as string, patientId: patientRes.body.id as string }
  }

  it('POST /api/workflows/:id/patient-runs creates a run at the start node', async () => {
    const { workflowId, patientId } = await seed()
    const res = await (request as any)(app.getHttpServer())
      .post(`/api/workflows/${workflowId}/patient-runs`)
      .send({ patientId })
      .expect(201)
    expect(res.body.currentNodeId).toBe('s')
    expect(res.body.history).toHaveLength(1)
    expect(res.body.workflow.graph.nodes.length).toBe(3)
  })

  it('GET /api/workflows/:id/patient-runs returns runs incl. soft-deleted-patient marker', async () => {
    const { workflowId, patientId } = await seed()
    await (request as any)(app.getHttpServer())
      .post(`/api/workflows/${workflowId}/patient-runs`)
      .send({ patientId })
    await (request as any)(app.getHttpServer()).delete(`/api/patient-profiles/${patientId}`)
    const list = await (request as any)(app.getHttpServer())
      .get(`/api/workflows/${workflowId}/patient-runs`)
      .expect(200)
    expect(list.body).toHaveLength(1)
    expect(list.body[0].patient.name).toBe('Alice')
    expect(list.body[0].patient.deletedAt).not.toBeNull()
  })

  it('full journey: create → advance s→a → advance a→e → reset → advance s→a', async () => {
    const { workflowId, patientId } = await seed()
    const created = await (request as any)(app.getHttpServer())
      .post(`/api/workflows/${workflowId}/patient-runs`)
      .send({ patientId })
    const runId = created.body.id

    let r = await (request as any)(app.getHttpServer())
      .post(`/api/patient-runs/${runId}/advance`)
      .send({})
      .expect(201)
    expect(r.body.currentNodeId).toBe('a')

    r = await (request as any)(app.getHttpServer())
      .post(`/api/patient-runs/${runId}/advance`)
      .send({})
      .expect(201)
    expect(r.body.currentNodeId).toBe('e')

    // advance on end → 400
    await (request as any)(app.getHttpServer())
      .post(`/api/patient-runs/${runId}/advance`)
      .send({})
      .expect(400)

    // reset
    r = await (request as any)(app.getHttpServer())
      .post(`/api/patient-runs/${runId}/reset`)
      .expect(201)
    expect(r.body.currentNodeId).toBe('s')
    expect(r.body.history).toHaveLength(1)

    // advance after reset
    r = await (request as any)(app.getHttpServer())
      .post(`/api/patient-runs/${runId}/advance`)
      .send({})
      .expect(201)
    expect(r.body.currentNodeId).toBe('a')
  })

  it('GET /api/patient-runs/:id returns the full run', async () => {
    const { workflowId, patientId } = await seed()
    const created = await (request as any)(app.getHttpServer())
      .post(`/api/workflows/${workflowId}/patient-runs`)
      .send({ patientId })
    const full = await (request as any)(app.getHttpServer())
      .get(`/api/patient-runs/${created.body.id}`)
      .expect(200)
    expect(full.body.workflow.name).toBe('Simple')
    expect(full.body.patient.name).toBe('Alice')
    expect(full.body.patient.email).toBe('alice@example.com')
  })

  it('POST /api/workflows/:id/patient-runs rejects unknown workflowId (404)', async () => {
    const patientRes = await (request as any)(app.getHttpServer())
      .post('/api/patient-profiles')
      .send({ name: 'Alice' })
    await (request as any)(app.getHttpServer())
      .post('/api/workflows/no-such-wf/patient-runs')
      .send({ patientId: patientRes.body.id })
      .expect(404)
  })
})
```

- [ ] **Step 8.2: Run e2e**

Run: `pnpm --filter @rainpath/backend test:e2e -- patient-runs 2>&1 | tail -20`
Expected: 5 specs pass.

- [ ] **Step 8.3: Commit**

```bash
git add backend/test/patient-runs.e2e-spec.ts
git commit -m "test(backend): e2e suite for patient-runs (full advance journey + reset + 404)"
```

---

## Task 9: Smoke check

- [ ] **Step 9.1: Full build & unit tests**

Run:
```bash
pnpm --filter @rainpath/backend build
pnpm --filter @rainpath/backend test
```
Expected: build clean; **unit** test count = 21 (existing) + 9 (advance.spec) + 5 (patient-profiles svc) + 6 (patient-runs svc) = **41 specs pass**.

- [ ] **Step 9.2: Full e2e**

Run: `pnpm --filter @rainpath/backend test:e2e 2>&1 | tail -15`
Expected: workflows (9) + node-templates (6) + patient-profiles (5) + patient-runs (5) = **25 specs pass**.

- [ ] **Step 9.3: Manual smoke**

Start the backend:
```bash
pnpm --filter @rainpath/backend dev
```

In another terminal, exercise the new endpoints:
```bash
# Create a profile
PROFILE_ID=$(curl -s -X POST http://localhost:3000/api/patient-profiles \
  -H 'Content-Type: application/json' \
  -d '{"name":"SmokeAlice","email":"smoke@example.com"}' | jq -r .id)
echo "Profile: $PROFILE_ID"

# List profiles
curl -s http://localhost:3000/api/patient-profiles | jq '.[] | {id,name,email}'

# Find a workflow (the seed workflow from Phase 0)
WF_ID=$(curl -s http://localhost:3000/api/workflows | jq -r '.[0].id')
echo "Workflow: $WF_ID"

# Create a run
RUN_ID=$(curl -s -X POST http://localhost:3000/api/workflows/$WF_ID/patient-runs \
  -H 'Content-Type: application/json' \
  -d "{\"patientId\":\"$PROFILE_ID\"}" | jq -r .id)
echo "Run: $RUN_ID"

# Advance the run
curl -s -X POST http://localhost:3000/api/patient-runs/$RUN_ID/advance \
  -H 'Content-Type: application/json' -d '{}' | jq '{currentNodeId, history}'

# Reset
curl -s -X POST http://localhost:3000/api/patient-runs/$RUN_ID/reset | jq '{currentNodeId, history}'
```

Expected: each step succeeds, currentNodeId changes after advance, reset returns to start. Stop the dev server.

- [ ] **Step 9.4: No commit unless something needs fixing**

If everything passes, report status — controller will decide whether to push.

---

## Self-review notes (post-plan)

**Spec coverage check** (§5.1, §6.3 patient endpoints):
- ✅ §6.3 `GET/POST/PATCH/DELETE /api/patient-profiles` — Tasks 2-3
- ✅ §6.3 `GET/POST /api/workflows/:id/patient-runs` — Tasks 4-5
- ✅ §6.3 `GET/POST /api/patient-runs/:id`, `advance`, `reset` — Tasks 4-5
- ✅ §6.3 advance logic (start, send_* single/simple/multi, condition, end, error codes) — Task 1
- ✅ §6.3 profile soft-delete preserves runs (with `deletedAt` field in patient join) — Task 4
- ✅ §5.1 soft-delete on PatientProfile (DELETE positions `deletedAt`) — Task 2
- ✅ §5.1 PatientRun stores history as JSON-encoded array — Task 4
- ✅ Body validation via `ZodValidationPipe` + DTOs already in shared — Tasks 3, 5
- ✅ 422 structured payload via `ZodExceptionFilter` (for DTO failures) + manual HttpException with same shape (for advance failures) — Task 4

**Out of scope** (intentional):
- `GET /patient-runs/:id/reachability` endpoint (spec §5.4.b mentions it as optional — the frontend can compute reachability locally from the patient profile + graph; defer to Phase 2B if needed).
- Restoration endpoint for soft-deleted resources (not in MVP per spec §5.1).
- Pagination / cursor on lists (not needed at this scale).

**Pitfall audits**:
- **Pitfall 4 (no semicolons)**: code follows project style.
- **Pitfall 10 (supertest)**: e2e specs use `import * as request from 'supertest'` + `(request as any)(...)` per Phase 1A pattern.
- **Pitfall 11 (Jest moduleNameMapper)**: already wired — tests import from `@rainpath/shared` directly.
- **Pitfall 9 (ValidationWarning has no edgeId)**: not relevant here (this phase doesn't touch the validation surface).
- **Dual-zod TS2719**: backend doesn't suffer from this since both shared and backend use the same `zod@3.23.8` resolved via pnpm to the same store path AND there's no Vite-style alias. Still, the patient-runs service uses `import type { Graph }` for safety.

**Type consistency**: `RunHistoryEntry`, `PatientRunFull`, `PatientRunSummary`, `PatientProfileOut` defined once per service and reused. The `AdvanceError` class + `AdvanceErrorCode` union exported from `advance.ts` and consumed by `patient-runs.service.ts` only. The DTOs (`CreatePatientProfileDto`, `UpdatePatientProfileDto`, `CreatePatientRunDto`, `AdvancePatientRunDto`) all come from `@rainpath/shared` — no local re-definitions.

**Placeholder scan**: clean. Every code step has real code.

**Scope**: 9 tasks, ~45 min of work. Final commit count: ~9. Push at end NOT included — controller decides.
