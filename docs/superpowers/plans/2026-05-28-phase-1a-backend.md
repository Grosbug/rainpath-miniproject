# RainPath — Phase 1A Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the NestJS backend modules for the **core scope** of RainPath (workflows + node templates) on top of the Phase 0 monorepo, with Zod validation pipe, structured 422 responses, soft-delete cascade, and end-to-end tests. Phase 2A (PatientProfile/PatientRun) is out of scope here.

**Architecture:**
- 2 feature modules (`WorkflowsModule`, `NodeTemplatesModule`) backed by `PrismaService` (already exists from Phase 0).
- A **custom Zod validation pipe** (spec R15 fallback path — chosen over `nestjs-zod` because of `discriminatedUnion` compatibility risk) plus a global `ZodExceptionFilter` that formats Zod errors into spec-compliant 422 payloads.
- `validateGraph` from `@rainpath/shared` is the source of truth for structural / per-channel / per-output / format validation; the workflows service runs it on every create/update/import path and converts its `errors` to 422 and its `warnings` to a response field.
- Soft-delete cascade: `WorkflowsService.softDelete(id)` runs a Prisma transaction that sets `Workflow.deletedAt` and propagates `PatientRun.deletedAt` for that workflow (the relation exists; the table is empty in 1A but the cascade must already be wired).
- Tests: per-service Jest unit specs + e2e against a real SQLite test DB (file `backend/test/test.db`, recreated per test run by Prisma).

**Tech Stack:** NestJS 10, Prisma 5/6, SQLite, Zod 3, Jest + Supertest (already wired by Phase 0).

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-28-rainpath-workflow-editor-design.md`
- Phase 0 (completed) plan: `docs/superpowers/plans/2026-05-28-phase-0-foundations.md`

---

## State after Phase 0 (do not re-do)

- `backend/src/prisma/prisma.service.ts` exposes `PrismaService` and `buildSoftDeleteClient(base)`.
- `backend/src/prisma/prisma.module.ts` provides+exports `PrismaService`.
- `backend/src/app.module.ts` only imports `PrismaModule` plus stub `AppController`/`AppService` (will be removed in Task 12).
- `backend/src/main.ts` configures body limit `1mb`, prefix `/api`, CORS for `http://localhost:5173`.
- `backend/prisma/schema.prisma` defines `Workflow`, `NodeTemplate`, `PatientProfile`, `PatientRun` with `deletedAt`, all storing JSON-encoded blobs as `String` (SQLite has no native Json).
- `backend/prisma/seed.ts` already seeds 8 templates + 1 example workflow.
- `@rainpath/shared` exports: `Graph`, `GraphNode`, `GraphEdge`, `NodeData`, `NodeTemplate`, `NodeTemplateBody`, `NodeTemplateKind`, `OutputConfig`, `CHANNEL_STATUSES`, `CHANNEL_FORMAT_RULES`, `DataAvailableExpressions`, `START_Y`, `CreateWorkflowDto`, `UpdateWorkflowDto`, `DuplicateWorkflowDto`, `CreateNodeTemplateDto`, `UpdateNodeTemplateDto`, plus `computeXPositions`, `validateGraph`, `computeReachability`, `simulate*`.
- `pnpm --filter @rainpath/shared test` is green.

---

## File structure (this plan creates)

```
backend/
├── src/
│   ├── main.ts                                # MODIFY (register global pipe + filter)
│   ├── app.module.ts                          # MODIFY (register WorkflowsModule + NodeTemplatesModule, drop AppController/Service)
│   ├── app.controller.ts                      # DELETE
│   ├── app.service.ts                         # DELETE
│   ├── app.controller.spec.ts                 # DELETE
│   ├── validation/
│   │   ├── zod-validation.pipe.ts             # CREATE — generic pipe<TSchema extends ZodSchema>
│   │   ├── zod-validation.pipe.spec.ts        # CREATE — unit test
│   │   ├── zod-exception.filter.ts            # CREATE — formats ZodError + GraphValidationError → 422
│   │   ├── graph-validation.error.ts          # CREATE — domain exception (errors[], warnings[])
│   │   └── format-zod-error.ts                # CREATE — Zod path/message → {code, path, message}
│   ├── workflows/
│   │   ├── workflows.module.ts                # CREATE
│   │   ├── workflows.controller.ts            # CREATE
│   │   ├── workflows.service.ts               # CREATE
│   │   ├── workflows.service.spec.ts          # CREATE (unit, with prisma test client)
│   │   └── graph-codec.ts                     # CREATE — encode/decode Graph ↔ string + drift detection
│   └── node-templates/
│       ├── node-templates.module.ts           # CREATE
│       ├── node-templates.controller.ts       # CREATE
│       ├── node-templates.service.ts          # CREATE
│       └── node-templates.service.spec.ts     # CREATE
│
└── test/
    ├── jest-e2e.json                          # CREATE
    ├── setup-e2e.ts                           # CREATE — push schema + reset DB hooks
    ├── test-app.ts                            # CREATE — boots Nest with same pipe/filter/prefix as prod
    ├── workflows.e2e-spec.ts                  # CREATE
    └── node-templates.e2e-spec.ts             # CREATE
```

---

## Conventions used across tasks

- **422 payload shape** (spec §5.5 + §6) — **single, canonical shape** used by both `ZodExceptionFilter` and `GraphValidationError`:
  ```json
  {
    "statusCode": 422,
    "errors": [
      { "code": "<code>", "message": "<human message>", "path": ["nodes", 3, "params", "body"], "nodeId": "n_x", "edgeId": "e_y" }
    ],
    "warnings": [
      { "code": "incomplete_status_coverage", "message": "...", "nodeId": "n_x", "missingStatuses": ["bounced"] }
    ]
  }
  ```
  - `path` is `(string|number)[]` for Zod-originated errors; absent for graph-validation errors that surface `nodeId`/`edgeId`.
  - `warnings` is always present (possibly `[]`) on 2xx responses too (see Workflows POST/PATCH/Duplicate response shape below).

- **2xx response shape for Workflow create/update/duplicate**: the workflow object **plus** a `warnings` array:
  ```ts
  type WorkflowResponse = {
    id: string
    name: string
    description: string | null
    graph: Graph
    createdAt: string  // ISO
    updatedAt: string  // ISO
    warnings: GraphWarning[]   // from validateGraph
  }
  ```
  Listing endpoints (`GET /workflows`) omit `graph` and `warnings`.

- **Soft delete filter**: every read in the services uses `buildSoftDeleteClient(prisma)` so `deletedAt: null` is enforced automatically. Hard-coded `where: { deletedAt: null }` is **not** used in services — the extension is the single point of enforcement (matches spec R12).

- **Imports of `@rainpath/shared`**: use the workspace bare import (`from '@rainpath/shared'`) — `package.json` already declares the dependency.

---

## Task 1: Custom Zod validation pipe

**Files:**
- Create: `backend/src/validation/zod-validation.pipe.ts`
- Create: `backend/src/validation/format-zod-error.ts`
- Create: `backend/src/validation/zod-validation.pipe.spec.ts`

- [ ] **Step 1.1: Write the failing pipe spec**

Write `backend/src/validation/zod-validation.pipe.spec.ts`:
```ts
import { ArgumentMetadata, BadRequestException } from '@nestjs/common'
import { z, ZodError } from 'zod'
import { ZodValidationPipe } from './zod-validation.pipe'

const Schema = z.object({ name: z.string().min(1), age: z.number().int().nonnegative() })

describe('ZodValidationPipe', () => {
  const meta: ArgumentMetadata = { type: 'body', metatype: undefined, data: undefined }

  it('returns the parsed value when input is valid', () => {
    const pipe = new ZodValidationPipe(Schema)
    expect(pipe.transform({ name: 'Alice', age: 30 }, meta)).toEqual({ name: 'Alice', age: 30 })
  })

  it('throws a ZodError-bearing BadRequestException for invalid input', () => {
    const pipe = new ZodValidationPipe(Schema)
    let thrown: unknown
    try { pipe.transform({ name: '', age: -1 }, meta) } catch (e) { thrown = e }
    expect(thrown).toBeInstanceOf(BadRequestException)
    const cause = (thrown as BadRequestException).cause
    expect(cause).toBeInstanceOf(ZodError)
    expect((cause as ZodError).issues.length).toBeGreaterThanOrEqual(2)
  })

  it('ignores params/query (only validates body)', () => {
    const pipe = new ZodValidationPipe(Schema)
    const paramMeta: ArgumentMetadata = { type: 'param', metatype: undefined, data: 'id' }
    expect(pipe.transform('whatever', paramMeta)).toBe('whatever')
  })
})
```

- [ ] **Step 1.2: Run test, verify FAIL**

Run: `pnpm --filter @rainpath/backend test -- zod-validation.pipe.spec`
Expected: FAIL — module not found.

- [ ] **Step 1.3: Implement the pipe**

Write `backend/src/validation/zod-validation.pipe.ts`:
```ts
import { ArgumentMetadata, BadRequestException, PipeTransform } from '@nestjs/common'
import { ZodSchema } from 'zod'

export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, metadata: ArgumentMetadata): T | unknown {
    if (metadata.type !== 'body') return value
    const result = this.schema.safeParse(value)
    if (!result.success) {
      throw new BadRequestException('Validation failed', { cause: result.error })
    }
    return result.data
  }
}
```

- [ ] **Step 1.4: Implement the Zod error formatter (used by Task 2 filter)**

Write `backend/src/validation/format-zod-error.ts`:
```ts
import { ZodError, ZodIssue } from 'zod'

export type FormattedIssue = {
  code: string
  message: string
  path: (string | number)[]
}

export function formatZodError(err: ZodError): FormattedIssue[] {
  return err.issues.map((issue: ZodIssue) => ({
    code: issue.code,
    message: issue.message,
    path: issue.path
  }))
}
```

- [ ] **Step 1.5: Run pipe spec, verify PASS**

Run: `pnpm --filter @rainpath/backend test -- zod-validation.pipe.spec`
Expected: 3 specs pass.

- [ ] **Step 1.6: Commit**

```bash
git add backend/src/validation/zod-validation.pipe.ts backend/src/validation/zod-validation.pipe.spec.ts backend/src/validation/format-zod-error.ts
git commit -m "feat(backend): add Zod validation pipe and ZodError formatter"
```

---

## Task 2: GraphValidationError + global ZodExceptionFilter

**Files:**
- Create: `backend/src/validation/graph-validation.error.ts`
- Create: `backend/src/validation/zod-exception.filter.ts`

- [ ] **Step 2.1: Create the domain error class**

Write `backend/src/validation/graph-validation.error.ts`:
```ts
export type GraphErrorItem = {
  code: string
  message: string
  nodeId?: string
  edgeId?: string
}

export type GraphWarning = {
  code: string
  message: string
  nodeId?: string
  edgeId?: string
  missingStatuses?: string[]
}

/**
 * Thrown by services when `validateGraph` reports errors. Caught by ZodExceptionFilter
 * and turned into a structured 422 response.
 */
export class GraphValidationError extends Error {
  constructor(
    public readonly errors: GraphErrorItem[],
    public readonly warnings: GraphWarning[] = []
  ) {
    super('Graph validation failed')
    this.name = 'GraphValidationError'
  }
}
```

- [ ] **Step 2.2: Create the global exception filter**

Write `backend/src/validation/zod-exception.filter.ts`:
```ts
import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import { Response } from 'express'
import { ZodError } from 'zod'
import { formatZodError } from './format-zod-error'
import { GraphValidationError } from './graph-validation.error'

@Catch(BadRequestException, GraphValidationError)
export class ZodExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException | GraphValidationError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>()

    if (exception instanceof GraphValidationError) {
      res.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: exception.errors,
        warnings: exception.warnings
      })
      return
    }

    const cause = (exception as BadRequestException).cause
    if (cause instanceof ZodError) {
      res.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: formatZodError(cause),
        warnings: []
      })
      return
    }

    // Plain BadRequestException → forward as 400 with its body
    const status = (exception as HttpException).getStatus()
    res.status(status).json(exception.getResponse())
  }
}
```

- [ ] **Step 2.3: Commit**

```bash
git add backend/src/validation/graph-validation.error.ts backend/src/validation/zod-exception.filter.ts
git commit -m "feat(backend): add GraphValidationError and global ZodExceptionFilter (422 payload)"
```

---

## Task 3: Wire the filter globally in `main.ts`

**Files:**
- Modify: `backend/src/main.ts`

- [ ] **Step 3.1: Register the global filter**

Replace `backend/src/main.ts` with:
```ts
import { NestFactory } from '@nestjs/core'
import * as express from 'express'
import { AppModule } from './app.module'
import { ZodExceptionFilter } from './validation/zod-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false })

  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))

  app.setGlobalPrefix('api')
  app.enableCors({ origin: 'http://localhost:5173' })
  app.useGlobalFilters(new ZodExceptionFilter())

  await app.listen(3000)
}
bootstrap()
```

- [ ] **Step 3.2: Verify backend still builds**

Run: `pnpm --filter @rainpath/backend build`
Expected: `dist/main.js` produced, no TS error.

- [ ] **Step 3.3: Commit**

```bash
git add backend/src/main.ts
git commit -m "feat(backend): register ZodExceptionFilter as global filter"
```

---

## Task 4: Graph codec (Prisma string ↔ Zod Graph)

**Files:**
- Create: `backend/src/workflows/graph-codec.ts`

- [ ] **Step 4.1: Implement encode/decode helpers**

Write `backend/src/workflows/graph-codec.ts`:
```ts
import { Graph } from '@rainpath/shared'
import { InternalServerErrorException } from '@nestjs/common'

/** Serialize a validated Graph for storage in SQLite `String` column. */
export function encodeGraph(graph: Graph): string {
  return JSON.stringify(graph)
}

/**
 * Parse a stored graph string. Throws 500 on drift / corruption (spec §5.3).
 * The caller MUST have stored a Zod-validated graph at write time.
 */
export function decodeGraph(raw: string, workflowId: string): Graph {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new InternalServerErrorException(
      `Workflow ${workflowId} graph blob is not valid JSON`
    )
  }
  const result = Graph.safeParse(parsed)
  if (!result.success) {
    throw new InternalServerErrorException(
      `Workflow ${workflowId} graph failed schema validation: ${result.error.issues
        .slice(0, 3)
        .map(i => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`
    )
  }
  return result.data
}
```

- [ ] **Step 4.2: Commit**

```bash
git add backend/src/workflows/graph-codec.ts
git commit -m "feat(backend): add graph codec with drift detection (spec §5.3)"
```

---

## Task 5: WorkflowsService — CRUD + duplicate + soft cascade

**Files:**
- Create: `backend/src/workflows/workflows.service.ts`
- Create: `backend/src/workflows/workflows.service.spec.ts`

This service is the largest single unit in the plan. It has six public methods (`list`, `get`, `create`, `update`, `duplicate`, `softDelete`) sharing a private `validateAndSerialize` helper.

- [ ] **Step 5.1: Write the failing service spec (covers all 6 paths)**

Write `backend/src/workflows/workflows.service.spec.ts`:
```ts
import { Test } from '@nestjs/testing'
import { execSync } from 'node:child_process'
import { unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { Graph, START_Y } from '@rainpath/shared'
import { PrismaService } from '../prisma/prisma.service'
import { PrismaModule } from '../prisma/prisma.module'
import { GraphValidationError } from '../validation/graph-validation.error'
import { WorkflowsService } from './workflows.service'

const TEST_DB = join(__dirname, '..', '..', 'test', 'workflows-svc.db')

function resetDb() {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB)
  process.env.DATABASE_URL = `file:${TEST_DB}`
  execSync('pnpm exec prisma db push --skip-generate', {
    cwd: join(__dirname, '..', '..'),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
  })
}

describe('WorkflowsService', () => {
  let service: WorkflowsService
  let prisma: PrismaService

  beforeAll(() => { resetDb() })
  afterAll(async () => { await prisma?.$disconnect() })

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [WorkflowsService]
    }).compile()
    service = moduleRef.get(WorkflowsService)
    prisma = moduleRef.get(PrismaService)
    await prisma.patientRun.deleteMany()
    await prisma.workflow.deleteMany()
  })

  it('create() returns a default start→end graph when no graph provided', async () => {
    const wf = await service.create({ name: 'New' })
    expect(wf.graph.nodes.find(n => n.data.kind === 'start')?.position).toEqual({ x: 0, y: START_Y })
    expect(wf.graph.nodes.some(n => n.data.kind === 'end')).toBe(true)
    expect(wf.graph.edges.length).toBe(1)
    expect(wf.warnings).toEqual([])
  })

  it('create() accepts an imported graph and validates it', async () => {
    const graph: Graph = {
      nodes: [
        { id: 's', position: { x: 0, y: START_Y }, data: { kind: 'start' } },
        { id: 'e', position: { x: 5, y: START_Y }, data: { kind: 'end' } }
      ],
      edges: [{ id: 'e1', source: 's', target: 'e', daysAfter: 5 }]
    }
    const wf = await service.create({ name: 'Imported', graph })
    expect(wf.graph.edges[0]?.daysAfter).toBe(5)
  })

  it('create() rejects an invalid imported graph with GraphValidationError', async () => {
    const graph: Graph = { nodes: [], edges: [] }
    await expect(service.create({ name: 'Bad', graph })).rejects.toBeInstanceOf(GraphValidationError)
  })

  it('list() returns id/name/description/updatedAt only (no graph)', async () => {
    await service.create({ name: 'A' })
    const list = await service.list()
    expect(list[0]).toMatchObject({ name: 'A' })
    expect((list[0] as any).graph).toBeUndefined()
  })

  it('get() returns the full workflow', async () => {
    const created = await service.create({ name: 'A' })
    const fetched = await service.get(created.id)
    expect(fetched.id).toBe(created.id)
    expect(fetched.graph.nodes.length).toBeGreaterThan(0)
  })

  it('get() throws 404 for unknown id', async () => {
    await expect(service.get('does-not-exist')).rejects.toMatchObject({ status: 404 })
  })

  it('update() patches name and validates new graph', async () => {
    const wf = await service.create({ name: 'Original' })
    const renamed = await service.update(wf.id, { name: 'Renamed' })
    expect(renamed.name).toBe('Renamed')
  })

  it('update() rejects a graph that introduces a cycle', async () => {
    const wf = await service.create({ name: 'WF' })
    const cyclicGraph: Graph = {
      nodes: [
        { id: 's', position: { x: 0, y: START_Y }, data: { kind: 'start' } },
        { id: 'a', position: { x: 1, y: START_Y }, data: { kind: 'send_email', params: { subject: '', body: '', output: { mode: 'single' } } } },
        { id: 'b', position: { x: 2, y: START_Y }, data: { kind: 'send_email', params: { subject: '', body: '', output: { mode: 'single' } } } },
        { id: 'e', position: { x: 3, y: START_Y }, data: { kind: 'end' } }
      ],
      edges: [
        { id: 'e1', source: 's', target: 'a', daysAfter: 1 },
        { id: 'e2', source: 'a', target: 'b', daysAfter: 1 },
        { id: 'e3', source: 'b', target: 'a', daysAfter: 1 },
        { id: 'e4', source: 'b', target: 'e', daysAfter: 1 }
      ]
    }
    await expect(service.update(wf.id, { graph: cyclicGraph })).rejects.toBeInstanceOf(GraphValidationError)
  })

  it('duplicate() copies graph and appends "(copie)" by default', async () => {
    const wf = await service.create({ name: 'WF' })
    const dup = await service.duplicate(wf.id, {})
    expect(dup.id).not.toBe(wf.id)
    expect(dup.name).toBe('WF (copie)')
    expect(dup.graph.nodes.length).toBe(wf.graph.nodes.length)
  })

  it('duplicate() honors a provided name', async () => {
    const wf = await service.create({ name: 'WF' })
    const dup = await service.duplicate(wf.id, { name: 'Clone' })
    expect(dup.name).toBe('Clone')
  })

  it('softDelete() sets deletedAt and hides the workflow from list/get', async () => {
    const wf = await service.create({ name: 'WF' })
    await service.softDelete(wf.id)
    const list = await service.list()
    expect(list.find(w => w.id === wf.id)).toBeUndefined()
    await expect(service.get(wf.id)).rejects.toMatchObject({ status: 404 })
  })

  it('softDelete() cascades to PatientRun rows (no orphan visible)', async () => {
    const wf = await service.create({ name: 'WF' })
    const patient = await prisma.patientProfile.create({ data: { name: 'P' } })
    await prisma.patientRun.create({
      data: {
        workflowId: wf.id,
        patientId: patient.id,
        currentNodeId: null,
        history: '[]'
      }
    })
    await service.softDelete(wf.id)
    const runs = await prisma.patientRun.findMany({ where: { workflowId: wf.id } })
    expect(runs.every(r => r.deletedAt !== null)).toBe(true)
  })
})
```

- [ ] **Step 5.2: Run spec, verify FAIL**

Run: `pnpm --filter @rainpath/backend test -- workflows.service.spec`
Expected: FAIL — `WorkflowsService` not found.

- [ ] **Step 5.3: Implement `WorkflowsService`**

Write `backend/src/workflows/workflows.service.ts`:
```ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { createId } from '@paralleldrive/cuid2'
import {
  CreateWorkflowDto,
  DuplicateWorkflowDto,
  Graph,
  START_Y,
  UpdateWorkflowDto,
  validateGraph
} from '@rainpath/shared'
import { PrismaService, buildSoftDeleteClient } from '../prisma/prisma.service'
import { GraphValidationError, GraphWarning } from '../validation/graph-validation.error'
import { decodeGraph, encodeGraph } from './graph-codec'

type WorkflowOut = {
  id: string
  name: string
  description: string | null
  graph: Graph
  createdAt: string
  updatedAt: string
  warnings: GraphWarning[]
}

@Injectable()
export class WorkflowsService {
  private readonly db: ReturnType<typeof buildSoftDeleteClient>

  constructor(private readonly prisma: PrismaService) {
    this.db = buildSoftDeleteClient(prisma)
  }

  async list() {
    const rows = await this.db.workflow.findMany({
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, description: true, updatedAt: true }
    })
    return rows.map(r => ({ ...r, updatedAt: r.updatedAt.toISOString() }))
  }

  async get(id: string): Promise<WorkflowOut> {
    const row = await this.db.workflow.findUnique({ where: { id } })
    if (!row) throw new NotFoundException(`Workflow ${id} not found`)
    return this.toResponse(row, [])
  }

  async create(dto: CreateWorkflowDto): Promise<WorkflowOut> {
    const graph = dto.graph ?? this.defaultGraph()
    const warnings = this.validate(graph)
    const row = await this.prisma.workflow.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        graph: encodeGraph(graph)
      }
    })
    return this.toResponse(row, warnings)
  }

  async update(id: string, dto: UpdateWorkflowDto): Promise<WorkflowOut> {
    const existing = await this.db.workflow.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Workflow ${id} not found`)

    let warnings: GraphWarning[] = []
    const data: Record<string, unknown> = {}
    if (dto.name !== undefined) data.name = dto.name
    if (dto.description !== undefined) data.description = dto.description
    if (dto.graph !== undefined) {
      warnings = this.validate(dto.graph)
      data.graph = encodeGraph(dto.graph)
    }

    const row = await this.prisma.workflow.update({ where: { id }, data })
    return this.toResponse(row, warnings)
  }

  async duplicate(id: string, dto: DuplicateWorkflowDto): Promise<WorkflowOut> {
    const source = await this.db.workflow.findUnique({ where: { id } })
    if (!source) throw new NotFoundException(`Workflow ${id} not found`)
    const graph = decodeGraph(source.graph, source.id)
    const warnings = this.validate(graph)
    const row = await this.prisma.workflow.create({
      data: {
        name: dto.name ?? `${source.name} (copie)`,
        description: source.description,
        graph: encodeGraph(graph)
      }
    })
    return this.toResponse(row, warnings)
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.db.workflow.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Workflow ${id} not found`)
    const now = new Date()
    await this.prisma.$transaction([
      this.prisma.workflow.update({ where: { id }, data: { deletedAt: now } }),
      this.prisma.patientRun.updateMany({
        where: { workflowId: id, deletedAt: null },
        data: { deletedAt: now }
      })
    ])
  }

  private validate(graph: Graph): GraphWarning[] {
    const { errors, warnings } = validateGraph(graph)
    if (errors.length > 0) throw new GraphValidationError(errors, warnings)
    return warnings
  }

  private defaultGraph(): Graph {
    const startId = createId()
    const endId = createId()
    const edgeId = createId()
    return {
      nodes: [
        { id: startId, position: { x: 0, y: START_Y }, data: { kind: 'start' } },
        { id: endId, position: { x: 30, y: START_Y }, data: { kind: 'end' } }
      ],
      edges: [{ id: edgeId, source: startId, target: endId, daysAfter: 30 }]
    }
  }

  private toResponse(
    row: { id: string; name: string; description: string | null; graph: string; createdAt: Date; updatedAt: Date },
    warnings: GraphWarning[]
  ): WorkflowOut {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      graph: decodeGraph(row.graph, row.id),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      warnings
    }
  }
}
```

- [ ] **Step 5.4: Install the cuid2 dependency**

`@paralleldrive/cuid2` is used by Prisma at runtime for `@default(cuid())`, but is NOT exposed as a JS export. We need our own ID generation for the default-graph nodes.

Run:
```bash
pnpm --filter @rainpath/backend add @paralleldrive/cuid2@2.2.2
```
Expected: `@paralleldrive/cuid2` now in `backend/package.json` dependencies.

- [ ] **Step 5.5: Run spec, verify PASS**

Run: `pnpm --filter @rainpath/backend test -- workflows.service.spec`
Expected: all 12 specs pass. If `prisma db push` complains about a stale `dev.db`, delete it and re-run.

- [ ] **Step 5.6: Commit**

```bash
git add backend/src/workflows/workflows.service.ts backend/src/workflows/workflows.service.spec.ts backend/package.json pnpm-lock.yaml
git commit -m "feat(backend): WorkflowsService CRUD + duplicate + soft-delete cascade"
```

---

## Task 6: WorkflowsController

**Files:**
- Create: `backend/src/workflows/workflows.controller.ts`

- [ ] **Step 6.1: Implement the controller**

Write `backend/src/workflows/workflows.controller.ts`:
```ts
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UsePipes } from '@nestjs/common'
import {
  CreateWorkflowDto,
  DuplicateWorkflowDto,
  UpdateWorkflowDto
} from '@rainpath/shared'
import { ZodValidationPipe } from '../validation/zod-validation.pipe'
import { WorkflowsService } from './workflows.service'

@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly service: WorkflowsService) {}

  @Get()
  list() {
    return this.service.list()
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateWorkflowDto))
  create(@Body() body: CreateWorkflowDto) {
    return this.service.create(body)
  }

  @Post(':id/duplicate')
  @UsePipes(new ZodValidationPipe(DuplicateWorkflowDto))
  duplicate(@Param('id') id: string, @Body() body: DuplicateWorkflowDto) {
    return this.service.duplicate(id, body)
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateWorkflowDto))
  update(@Param('id') id: string, @Body() body: UpdateWorkflowDto) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.service.softDelete(id)
  }
}
```

- [ ] **Step 6.2: Commit**

```bash
git add backend/src/workflows/workflows.controller.ts
git commit -m "feat(backend): WorkflowsController (CRUD + duplicate routes under /api/workflows)"
```

---

## Task 7: WorkflowsModule

**Files:**
- Create: `backend/src/workflows/workflows.module.ts`

- [ ] **Step 7.1: Implement the module**

Write `backend/src/workflows/workflows.module.ts`:
```ts
import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { WorkflowsController } from './workflows.controller'
import { WorkflowsService } from './workflows.service'

@Module({
  imports: [PrismaModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService]
})
export class WorkflowsModule {}
```

- [ ] **Step 7.2: Commit**

```bash
git add backend/src/workflows/workflows.module.ts
git commit -m "feat(backend): WorkflowsModule wiring"
```

---

## Task 8: NodeTemplatesService

**Files:**
- Create: `backend/src/node-templates/node-templates.service.ts`
- Create: `backend/src/node-templates/node-templates.service.spec.ts`

- [ ] **Step 8.1: Write failing spec**

Write `backend/src/node-templates/node-templates.service.spec.ts`:
```ts
import { Test } from '@nestjs/testing'
import { execSync } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaModule } from '../prisma/prisma.module'
import { PrismaService } from '../prisma/prisma.service'
import { GraphValidationError } from '../validation/graph-validation.error'
import { NodeTemplatesService } from './node-templates.service'

const TEST_DB = join(__dirname, '..', '..', 'test', 'templates-svc.db')

function resetDb() {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB)
  process.env.DATABASE_URL = `file:${TEST_DB}`
  execSync('pnpm exec prisma db push --skip-generate', {
    cwd: join(__dirname, '..', '..'),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
  })
}

describe('NodeTemplatesService', () => {
  let service: NodeTemplatesService
  let prisma: PrismaService

  beforeAll(() => { resetDb() })
  afterAll(async () => { await prisma?.$disconnect() })

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [NodeTemplatesService]
    }).compile()
    service = moduleRef.get(NodeTemplatesService)
    prisma = moduleRef.get(PrismaService)
    await prisma.nodeTemplate.deleteMany()
  })

  it('create() persists and returns a parsed send_email template', async () => {
    const t = await service.create({
      name: 'Email — première relance',
      kind: 'send_email',
      params: { subject: 'Hello', body: 'Bonjour', output: { mode: 'single' } }
    } as any)
    expect(t.kind).toBe('send_email')
    if (t.kind === 'send_email') expect(t.params.subject).toBe('Hello')
  })

  it('create() rejects invalid params for the given kind', async () => {
    await expect(service.create({
      name: 'Bad',
      kind: 'send_sms',
      // sms has no `subject` field — should fail
      params: { subject: 'nope' }
    } as any)).rejects.toBeInstanceOf(GraphValidationError)
  })

  it('list() returns templates sorted by kind then name', async () => {
    await service.create({ name: 'Z', kind: 'send_sms', params: { body: 'b', output: { mode: 'single' } } } as any)
    await service.create({ name: 'A', kind: 'send_email', params: { subject: '', body: '', output: { mode: 'single' } } } as any)
    await service.create({ name: 'B', kind: 'send_email', params: { subject: '', body: '', output: { mode: 'single' } } } as any)
    const list = await service.list()
    expect(list.map(t => `${t.kind}:${t.name}`)).toEqual([
      'send_email:A',
      'send_email:B',
      'send_sms:Z'
    ])
  })

  it('update() merges params with stored kind and re-validates', async () => {
    const t = await service.create({
      name: 'T',
      kind: 'send_email',
      params: { subject: '', body: '', output: { mode: 'single' } }
    } as any)
    const updated = await service.update(t.id, {
      params: { subject: 'New', body: 'Body', output: { mode: 'simple', successCondition: { statuses: ['delivered'] } } }
    } as any)
    if (updated.kind === 'send_email') {
      expect(updated.params.subject).toBe('New')
      expect(updated.params.output.mode).toBe('simple')
    }
  })

  it('update() rejects params with a status outside the channel', async () => {
    const t = await service.create({
      name: 'T',
      kind: 'send_email',
      params: { subject: '', body: '', output: { mode: 'single' } }
    } as any)
    await expect(service.update(t.id, {
      params: { subject: '', body: '', output: { mode: 'simple', successCondition: { statuses: ['nonsense'] } } }
    } as any)).rejects.toBeInstanceOf(GraphValidationError)
  })

  it('softDelete() hides the template from list and get', async () => {
    const t = await service.create({
      name: 'T',
      kind: 'send_email',
      params: { subject: '', body: '', output: { mode: 'single' } }
    } as any)
    await service.softDelete(t.id)
    const list = await service.list()
    expect(list.find(x => x.id === t.id)).toBeUndefined()
    await expect(service.get(t.id)).rejects.toMatchObject({ status: 404 })
  })
})
```

- [ ] **Step 8.2: Run spec, verify FAIL**

Run: `pnpm --filter @rainpath/backend test -- node-templates.service.spec`
Expected: FAIL — service not found.

- [ ] **Step 8.3: Implement `NodeTemplatesService`**

Write `backend/src/node-templates/node-templates.service.ts`:
```ts
import { Injectable, NotFoundException } from '@nestjs/common'
import {
  CHANNEL_STATUSES,
  CreateNodeTemplateDto,
  DataAvailableExpressions,
  NodeTemplate,
  NodeTemplateBody,
  UpdateNodeTemplateDto
} from '@rainpath/shared'
import { PrismaService, buildSoftDeleteClient } from '../prisma/prisma.service'
import { GraphErrorItem, GraphValidationError } from '../validation/graph-validation.error'
import { formatZodError } from '../validation/format-zod-error'

@Injectable()
export class NodeTemplatesService {
  private readonly db: ReturnType<typeof buildSoftDeleteClient>

  constructor(private readonly prisma: PrismaService) {
    this.db = buildSoftDeleteClient(prisma)
  }

  async list(): Promise<NodeTemplate[]> {
    const rows = await this.db.nodeTemplate.findMany({
      orderBy: [{ kind: 'asc' }, { name: 'asc' }]
    })
    return rows.map(r => this.toResponse(r))
  }

  async get(id: string): Promise<NodeTemplate> {
    const row = await this.db.nodeTemplate.findUnique({ where: { id } })
    if (!row) throw new NotFoundException(`Template ${id} not found`)
    return this.toResponse(row)
  }

  async create(dto: CreateNodeTemplateDto): Promise<NodeTemplate> {
    const body = this.parseBody({ kind: (dto as any).kind, params: (dto as any).params })
    this.validateChannelRules(body)
    const row = await this.prisma.nodeTemplate.create({
      data: {
        name: (dto as any).name,
        description: (dto as any).description ?? null,
        kind: body.kind,
        params: JSON.stringify(body.params)
      }
    })
    return this.toResponse(row)
  }

  async update(id: string, dto: UpdateNodeTemplateDto): Promise<NodeTemplate> {
    const existing = await this.db.nodeTemplate.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Template ${id} not found`)

    const data: Record<string, unknown> = {}
    if (dto.name !== undefined) data.name = dto.name
    if (dto.description !== undefined) data.description = dto.description

    if (dto.params !== undefined) {
      const body = this.parseBody({ kind: existing.kind, params: dto.params })
      this.validateChannelRules(body)
      data.params = JSON.stringify(body.params)
    }

    const row = await this.prisma.nodeTemplate.update({ where: { id }, data })
    return this.toResponse(row)
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.db.nodeTemplate.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Template ${id} not found`)
    await this.prisma.nodeTemplate.update({
      where: { id },
      data: { deletedAt: new Date() }
    })
  }

  /** Discriminated-union parse: kind + params must be coherent. */
  private parseBody(input: { kind: unknown; params: unknown }) {
    const result = NodeTemplateBody.safeParse(input)
    if (!result.success) {
      throw new GraphValidationError(
        formatZodError(result.error).map(i => ({
          code: i.code,
          message: i.message
        }))
      )
    }
    return result.data
  }

  /**
   * Cross-channel rules that Zod alone cannot enforce (spec §5.5):
   * - statuses must belong to the channel
   * - postal untracked must be single
   * - data_available expression must be a known patient field
   * - multi outputs must not overlap on statuses
   */
  private validateChannelRules(body: ReturnType<NodeTemplatesService['parseBody']>) {
    const errors: GraphErrorItem[] = []

    if (body.kind === 'condition') {
      if (body.params.conditionType === 'data_available') {
        if (!DataAvailableExpressions.includes(body.params.expression as any)) {
          errors.push({
            code: 'unknown_data_available_expression',
            message: `expression must be one of ${DataAvailableExpressions.join(', ')}`
          })
        }
      }
    } else {
      let channelKey: keyof typeof CHANNEL_STATUSES
      if (body.kind === 'send_email') channelKey = 'email'
      else if (body.kind === 'send_sms') channelKey = 'sms'
      else if (body.kind === 'send_whatsapp') channelKey = 'whatsapp'
      else channelKey = body.params.tracked ? 'postal_tracked' : 'postal_untracked'

      const allowed = new Set<string>(CHANNEL_STATUSES[channelKey])

      if (body.kind === 'send_postal' && !body.params.tracked && body.params.output.mode !== 'single') {
        errors.push({ code: 'postal_untracked_must_be_single', message: 'postal_untracked must use mode=single' })
      }

      const output = body.params.output
      if (output.mode === 'simple') {
        for (const s of output.successCondition.statuses) {
          if (!allowed.has(s)) errors.push({ code: 'status_not_in_channel', message: `status ${s} not in ${channelKey}` })
        }
      } else if (output.mode === 'multi') {
        const seen = new Set<string>()
        for (const out of output.outputs) {
          for (const s of out.condition.statuses) {
            if (!allowed.has(s)) errors.push({ code: 'status_not_in_channel', message: `status ${s} not in ${channelKey}` })
            if (seen.has(s)) errors.push({ code: 'status_overlap_in_multi', message: `status ${s} appears in more than one output` })
            seen.add(s)
          }
        }
      }
    }

    if (errors.length > 0) throw new GraphValidationError(errors)
  }

  private toResponse(row: {
    id: string
    name: string
    description: string | null
    kind: string
    params: string
    createdAt: Date
    updatedAt: Date
  }): NodeTemplate {
    const params = JSON.parse(row.params)
    const parsed = NodeTemplate.safeParse({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      kind: row.kind,
      params,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    })
    if (!parsed.success) {
      throw new GraphValidationError(
        formatZodError(parsed.error).map(i => ({ code: i.code, message: `Stored template ${row.id} drift: ${i.message}` }))
      )
    }
    return parsed.data
  }
}
```

- [ ] **Step 8.4: Run spec, verify PASS**

Run: `pnpm --filter @rainpath/backend test -- node-templates.service.spec`
Expected: all specs pass.

- [ ] **Step 8.5: Commit**

```bash
git add backend/src/node-templates/node-templates.service.ts backend/src/node-templates/node-templates.service.spec.ts
git commit -m "feat(backend): NodeTemplatesService with discriminated-union validation and channel rules"
```

---

## Task 9: NodeTemplatesController + Module

**Files:**
- Create: `backend/src/node-templates/node-templates.controller.ts`
- Create: `backend/src/node-templates/node-templates.module.ts`

- [ ] **Step 9.1: Implement the controller**

Write `backend/src/node-templates/node-templates.controller.ts`:
```ts
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UsePipes } from '@nestjs/common'
import { CreateNodeTemplateDto, UpdateNodeTemplateDto } from '@rainpath/shared'
import { ZodValidationPipe } from '../validation/zod-validation.pipe'
import { NodeTemplatesService } from './node-templates.service'

@Controller('node-templates')
export class NodeTemplatesController {
  constructor(private readonly service: NodeTemplatesService) {}

  @Get()
  list() {
    return this.service.list()
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateNodeTemplateDto))
  create(@Body() body: CreateNodeTemplateDto) {
    return this.service.create(body)
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateNodeTemplateDto))
  update(@Param('id') id: string, @Body() body: UpdateNodeTemplateDto) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.service.softDelete(id)
  }
}
```

- [ ] **Step 9.2: Implement the module**

Write `backend/src/node-templates/node-templates.module.ts`:
```ts
import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { NodeTemplatesController } from './node-templates.controller'
import { NodeTemplatesService } from './node-templates.service'

@Module({
  imports: [PrismaModule],
  controllers: [NodeTemplatesController],
  providers: [NodeTemplatesService]
})
export class NodeTemplatesModule {}
```

- [ ] **Step 9.3: Commit**

```bash
git add backend/src/node-templates/node-templates.controller.ts backend/src/node-templates/node-templates.module.ts
git commit -m "feat(backend): NodeTemplatesController and module"
```

---

## Task 10: Register feature modules + remove stub `AppController`

**Files:**
- Modify: `backend/src/app.module.ts`
- Delete: `backend/src/app.controller.ts`
- Delete: `backend/src/app.controller.spec.ts`
- Delete: `backend/src/app.service.ts`

- [ ] **Step 10.1: Replace `AppModule` with feature modules only**

Replace `backend/src/app.module.ts` with:
```ts
import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { WorkflowsModule } from './workflows/workflows.module'
import { NodeTemplatesModule } from './node-templates/node-templates.module'

@Module({
  imports: [PrismaModule, WorkflowsModule, NodeTemplatesModule]
})
export class AppModule {}
```

- [ ] **Step 10.2: Delete the stub controller/service**

Run:
```bash
rm backend/src/app.controller.ts backend/src/app.controller.spec.ts backend/src/app.service.ts
```

- [ ] **Step 10.3: Verify build still passes**

Run: `pnpm --filter @rainpath/backend build`
Expected: `dist/main.js` rebuilt without errors.

- [ ] **Step 10.4: Commit**

```bash
git add backend/src/app.module.ts backend/src/app.controller.ts backend/src/app.controller.spec.ts backend/src/app.service.ts
git commit -m "feat(backend): register WorkflowsModule + NodeTemplatesModule; drop stub AppController"
```

---

## Task 11: E2E harness (config + bootstrap + DB reset)

**Files:**
- Create: `backend/test/jest-e2e.json`
- Create: `backend/test/setup-e2e.ts`
- Create: `backend/test/test-app.ts`

- [ ] **Step 11.1: Create the Jest e2e config**

Write `backend/test/jest-e2e.json`:
```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "setupFilesAfterEach": [],
  "globalSetup": "<rootDir>/setup-e2e.ts",
  "moduleNameMapper": {
    "^@rainpath/shared$": "<rootDir>/../../shared/dist/index.js"
  }
}
```

- [ ] **Step 11.2: Create the global setup that resets the test DB**

Write `backend/test/setup-e2e.ts`:
```ts
import { execSync } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

export default async function globalSetup() {
  const dbPath = join(__dirname, 'e2e.db')
  if (existsSync(dbPath)) unlinkSync(dbPath)
  process.env.DATABASE_URL = `file:${dbPath}`
  execSync('pnpm exec prisma db push --skip-generate', {
    cwd: join(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
  })
  // Build shared so the e2e moduleNameMapper resolves the JS bundle.
  execSync('pnpm --filter @rainpath/shared build', {
    cwd: join(__dirname, '..', '..'),
    stdio: 'inherit'
  })
}
```

- [ ] **Step 11.3: Create the test-app bootstrap (used by both e2e suites)**

Write `backend/test/test-app.ts`:
```ts
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import * as express from 'express'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma/prisma.service'
import { ZodExceptionFilter } from '../src/validation/zod-exception.filter'

export async function buildTestApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
  const app = moduleRef.createNestApplication({ bodyParser: false })
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))
  app.setGlobalPrefix('api')
  app.useGlobalFilters(new ZodExceptionFilter())
  await app.init()
  return { app, prisma: app.get(PrismaService) }
}

export async function resetTables(prisma: PrismaService) {
  await prisma.patientRun.deleteMany()
  await prisma.patientProfile.deleteMany()
  await prisma.workflow.deleteMany()
  await prisma.nodeTemplate.deleteMany()
}
```

- [ ] **Step 11.4: Add a root e2e script to backend package.json**

Modify `backend/package.json` `scripts.test:e2e` (already present):
```json
"test:e2e": "jest --config ./test/jest-e2e.json --runInBand"
```
(Replace the existing line. `--runInBand` ensures suites share one DB without races.)

- [ ] **Step 11.5: Commit**

```bash
git add backend/test/jest-e2e.json backend/test/setup-e2e.ts backend/test/test-app.ts backend/package.json
git commit -m "test(backend): add e2e harness (jest config + global setup + test-app)"
```

---

## Task 12: E2E specs — Workflows

**Files:**
- Create: `backend/test/workflows.e2e-spec.ts`

- [ ] **Step 12.1: Write the e2e spec**

Write `backend/test/workflows.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { Graph, START_Y } from '@rainpath/shared'
import { PrismaService } from '../src/prisma/prisma.service'
import { buildTestApp, resetTables } from './test-app'

describe('Workflows (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp())
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(async () => {
    await resetTables(prisma)
  })

  it('POST /api/workflows creates a default workflow', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/workflows')
      .send({ name: 'Default' })
      .expect(201)
    expect(res.body.graph.nodes.find((n: any) => n.data.kind === 'start').position).toEqual({ x: 0, y: START_Y })
    expect(res.body.warnings).toEqual([])
  })

  it('POST /api/workflows rejects empty name with 422', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/workflows')
      .send({ name: '' })
      .expect(422)
    expect(res.body.errors.length).toBeGreaterThanOrEqual(1)
  })

  it('POST /api/workflows accepts an imported graph', async () => {
    const graph: Graph = {
      nodes: [
        { id: 's', position: { x: 0, y: START_Y }, data: { kind: 'start' } },
        { id: 'e', position: { x: 5, y: START_Y }, data: { kind: 'end' } }
      ],
      edges: [{ id: 'e1', source: 's', target: 'e', daysAfter: 5 }]
    }
    const res = await request(app.getHttpServer())
      .post('/api/workflows')
      .send({ name: 'Imported', graph })
      .expect(201)
    expect(res.body.graph.edges[0].daysAfter).toBe(5)
  })

  it('POST /api/workflows rejects import with cycle (422)', async () => {
    const graph: Graph = {
      nodes: [
        { id: 's', position: { x: 0, y: START_Y }, data: { kind: 'start' } },
        { id: 'a', position: { x: 1, y: START_Y }, data: { kind: 'send_email', params: { subject: '', body: '', output: { mode: 'single' } } } },
        { id: 'b', position: { x: 2, y: START_Y }, data: { kind: 'send_email', params: { subject: '', body: '', output: { mode: 'single' } } } },
        { id: 'e', position: { x: 3, y: START_Y }, data: { kind: 'end' } }
      ],
      edges: [
        { id: 'e1', source: 's', target: 'a', daysAfter: 1 },
        { id: 'e2', source: 'a', target: 'b', daysAfter: 1 },
        { id: 'e3', source: 'b', target: 'a', daysAfter: 1 },
        { id: 'e4', source: 'b', target: 'e', daysAfter: 1 }
      ]
    }
    const res = await request(app.getHttpServer())
      .post('/api/workflows')
      .send({ name: 'Cyclic', graph })
      .expect(422)
    expect(res.body.errors.some((e: any) => e.code === 'cycle')).toBe(true)
  })

  it('GET /api/workflows omits graph in the list response', async () => {
    await request(app.getHttpServer()).post('/api/workflows').send({ name: 'A' })
    const res = await request(app.getHttpServer()).get('/api/workflows').expect(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0].graph).toBeUndefined()
    expect(res.body[0].name).toBe('A')
  })

  it('GET /api/workflows/:id 404s on unknown id', async () => {
    await request(app.getHttpServer()).get('/api/workflows/no-such-id').expect(404)
  })

  it('PATCH /api/workflows/:id updates name', async () => {
    const created = await request(app.getHttpServer()).post('/api/workflows').send({ name: 'Original' })
    const res = await request(app.getHttpServer())
      .patch(`/api/workflows/${created.body.id}`)
      .send({ name: 'Renamed' })
      .expect(200)
    expect(res.body.name).toBe('Renamed')
  })

  it('POST /api/workflows/:id/duplicate copies the graph', async () => {
    const created = await request(app.getHttpServer()).post('/api/workflows').send({ name: 'WF' })
    const dup = await request(app.getHttpServer())
      .post(`/api/workflows/${created.body.id}/duplicate`)
      .send({})
      .expect(201)
    expect(dup.body.name).toBe('WF (copie)')
    expect(dup.body.id).not.toBe(created.body.id)
    expect(dup.body.graph.nodes.length).toBe(created.body.graph.nodes.length)
  })

  it('DELETE /api/workflows/:id soft-deletes (returns 204; list no longer shows it)', async () => {
    const created = await request(app.getHttpServer()).post('/api/workflows').send({ name: 'Doomed' })
    await request(app.getHttpServer()).delete(`/api/workflows/${created.body.id}`).expect(204)
    const list = await request(app.getHttpServer()).get('/api/workflows').expect(200)
    expect(list.body.find((w: any) => w.id === created.body.id)).toBeUndefined()
  })
})
```

- [ ] **Step 12.2: Run e2e**

Run: `pnpm --filter @rainpath/backend test:e2e -- workflows`
Expected: all 9 specs pass.

- [ ] **Step 12.3: Commit**

```bash
git add backend/test/workflows.e2e-spec.ts
git commit -m "test(backend): e2e suite for /api/workflows (CRUD + duplicate + import + soft delete)"
```

---

## Task 13: E2E specs — Node templates

**Files:**
- Create: `backend/test/node-templates.e2e-spec.ts`

- [ ] **Step 13.1: Write the e2e spec**

Write `backend/test/node-templates.e2e-spec.ts`:
```ts
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { PrismaService } from '../src/prisma/prisma.service'
import { buildTestApp, resetTables } from './test-app'

describe('Node templates (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => { ({ app, prisma } = await buildTestApp()) })
  afterAll(async () => { await app.close() })
  beforeEach(async () => { await resetTables(prisma) })

  it('POST /api/node-templates creates an email template', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/node-templates')
      .send({
        name: 'Email — relance',
        kind: 'send_email',
        params: { subject: 'Sujet', body: '', output: { mode: 'single' } }
      })
      .expect(201)
    expect(res.body.kind).toBe('send_email')
  })

  it('POST /api/node-templates rejects mismatched kind/params (422)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/node-templates')
      .send({
        name: 'Bad',
        kind: 'send_sms',
        params: { subject: 'sms-has-no-subject' }
      })
      .expect(422)
    expect(res.body.errors.length).toBeGreaterThanOrEqual(1)
  })

  it('POST /api/node-templates rejects status outside channel (422)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/node-templates')
      .send({
        name: 'Bad email simple',
        kind: 'send_email',
        params: {
          subject: '',
          body: '',
          output: { mode: 'simple', successCondition: { statuses: ['ghost_status'] } }
        }
      })
      .expect(422)
    expect(res.body.errors.some((e: any) => e.code === 'status_not_in_channel')).toBe(true)
  })

  it('GET /api/node-templates returns templates ordered by kind then name', async () => {
    await request(app.getHttpServer()).post('/api/node-templates').send({
      name: 'Z', kind: 'send_sms', params: { body: 'x', output: { mode: 'single' } }
    })
    await request(app.getHttpServer()).post('/api/node-templates').send({
      name: 'B', kind: 'send_email', params: { subject: '', body: '', output: { mode: 'single' } }
    })
    await request(app.getHttpServer()).post('/api/node-templates').send({
      name: 'A', kind: 'send_email', params: { subject: '', body: '', output: { mode: 'single' } } 
    })
    const res = await request(app.getHttpServer()).get('/api/node-templates').expect(200)
    expect(res.body.map((t: any) => `${t.kind}:${t.name}`)).toEqual([
      'send_email:A', 'send_email:B', 'send_sms:Z'
    ])
  })

  it('PATCH /api/node-templates/:id updates name and validates new params', async () => {
    const created = await request(app.getHttpServer()).post('/api/node-templates').send({
      name: 'T', kind: 'send_email', params: { subject: '', body: '', output: { mode: 'single' } }
    })
    const res = await request(app.getHttpServer())
      .patch(`/api/node-templates/${created.body.id}`)
      .send({ name: 'T2', params: { subject: 'Updated', body: '', output: { mode: 'single' } } })
      .expect(200)
    expect(res.body.name).toBe('T2')
    expect(res.body.params.subject).toBe('Updated')
  })

  it('DELETE /api/node-templates/:id soft-deletes', async () => {
    const created = await request(app.getHttpServer()).post('/api/node-templates').send({
      name: 'T', kind: 'send_email', params: { subject: '', body: '', output: { mode: 'single' } }
    })
    await request(app.getHttpServer()).delete(`/api/node-templates/${created.body.id}`).expect(204)
    const list = await request(app.getHttpServer()).get('/api/node-templates').expect(200)
    expect(list.body.find((t: any) => t.id === created.body.id)).toBeUndefined()
  })
})
```

- [ ] **Step 13.2: Run e2e**

Run: `pnpm --filter @rainpath/backend test:e2e -- node-templates`
Expected: all 6 specs pass.

- [ ] **Step 13.3: Commit**

```bash
git add backend/test/node-templates.e2e-spec.ts
git commit -m "test(backend): e2e suite for /api/node-templates (CRUD + validation + soft delete)"
```

---

## Task 14: Smoke check + final commit

- [ ] **Step 14.1: Build and unit test the full backend**

Run:
```bash
pnpm --filter @rainpath/backend build
pnpm --filter @rainpath/backend test
```
Expected: build OK, all unit specs pass.

- [ ] **Step 14.2: Run full e2e suite**

Run: `pnpm --filter @rainpath/backend test:e2e`
Expected: workflows + node-templates suites pass (15 specs total).

- [ ] **Step 14.3: Manual smoke — seed + dev server**

Run in one terminal:
```bash
pnpm --filter @rainpath/backend exec prisma migrate dev --name 0000-init || true
pnpm --filter @rainpath/backend exec prisma db push
pnpm --filter @rainpath/backend prisma:seed
pnpm --filter @rainpath/backend dev
```

In a second terminal:
```bash
curl -s http://localhost:3000/api/workflows | head -c 500
curl -s http://localhost:3000/api/node-templates | head -c 500
curl -s -X POST http://localhost:3000/api/workflows -H 'Content-Type: application/json' -d '{"name":"Smoke"}' | head -c 500
```
Expected: arrays of seeded data and a 201 response on POST. Stop the dev server with Ctrl+C.

- [ ] **Step 14.4: Push**

Run:
```bash
git push
```

Expected: all Phase 1A commits on `origin/main`.

---

## Self-review notes (post-plan)

**Spec coverage check (Phase 1A scope per §8 "Phase 1 — Track 1A Backend")**:
- ✅ `PrismaModule` (singleton) + soft-delete extension — Phase 0 (reused in Task 5/8 via `buildSoftDeleteClient`)
- ✅ `WorkflowsModule` controller/service/DTO + Zod validation — Tasks 5/6/7
- ✅ `POST /workflows/:id/duplicate` — Tasks 5/6
- ✅ `NodeTemplatesModule` controller/service/DTO with discriminated-union params validation — Tasks 8/9
- ✅ Soft delete on all models (DELETE positions `deletedAt`) — Tasks 5 (cascade for runs), 8 (template)
- ✅ Zod validation via custom pipe (R15 fallback chosen up-front to avoid `nestjs-zod` × discriminated-union risk) — Task 1
- ✅ Structured 422 responses with `{errors, warnings}` — Tasks 2/3
- ✅ Seed: out of 1A scope (Phase 0 already seeds 8 templates + 1 example)
- ✅ E2E tests: workflows CRUD + duplicate + soft delete; templates CRUD; reject on invalid graph; import via POST with graph — Tasks 12/13
- ✅ Drift-detection on read (spec §5.3) — Task 4 (`decodeGraph`) used by every service read
- ✅ Body limit 1mb — Phase 0 (preserved in Task 3)
- ✅ Channel rules + postal untracked + data_available expression checks — embedded in Task 8 (`validateChannelRules`) and Task 5 (via `validateGraph`)

**Placeholder scan**: clean (no TBD, TODO, "implement later", "similar to Task N"). Every code step contains the actual code.

**Type consistency**:
- `WorkflowResponse.warnings` and 422 payload `warnings` use the same `GraphWarning` shape (defined once in Task 2).
- `validateGraph` import comes from `@rainpath/shared` (built in Phase 0).
- `NodeTemplateBody` and `NodeTemplate` schemas — defined Phase 0, used Task 8 — match.
- `CreateWorkflowDto`, `UpdateWorkflowDto`, `DuplicateWorkflowDto`, `CreateNodeTemplateDto`, `UpdateNodeTemplateDto` — all from Phase 0 `api-dtos.ts`, no rename.
- `buildSoftDeleteClient` is from Phase 0 `prisma.service.ts` and used consistently in services.

**Scope check**: Phase 1A produces a working backend serving `/api/workflows` (CRUD + duplicate) and `/api/node-templates` (CRUD) with structured validation, soft-delete cascade, drift detection, and 15 e2e specs proving the contract. Phase 2A (`PatientProfile`/`PatientRun` modules + `/patient-runs/:id/advance|reset`) is out of this plan and stays Phase 2A in the spec.

**Note on test discipline**: every service spec lists assertions for both the happy path and at least one failure mode that produces a `GraphValidationError`. E2E specs use Supertest against the real `AppModule` so the global filter, validation pipe, and prefix `/api` are exercised end-to-end.
