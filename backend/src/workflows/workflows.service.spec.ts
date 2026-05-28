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
