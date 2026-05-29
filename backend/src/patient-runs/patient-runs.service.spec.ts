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
      kind: 'send_email', params: { subject: '', body: '', output: { mode: 'simple', successCondition: { statuses: ['delivered'] } } }
    }},
    { id: 'e', position: { x: 10, y: START_Y }, data: { kind: 'end' } }
  ],
  edges: [
    { id: 'e1', source: 's', target: 'a', daysAfter: 5 },
    { id: 'e2', source: 'a', target: 'e', daysAfter: 5, sourceHandle: 'success' }
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
    const patient = await prisma.patientProfile.create({ data: { firstName: 'Alice', lastName: 'Durand', gender: 'female' } })
    return { wf, patient }
  }

  it('create() seeds currentNodeId to start and history with one entry', async () => {
    const { wf, patient } = await seedWorkflowAndPatient()
    const run = await service.create(wf.id, { patientId: patient.id, title: 'Parcours test' })
    expect(run.title).toBe('Parcours test')
    expect(run.currentNodeId).toBe('s')
    expect(run.history).toHaveLength(1)
    expect(run.history[0]?.nodeId).toBe('s')
  })

  it('listForWorkflow() returns runs (incl. soft-deleted patients in the join)', async () => {
    const { wf, patient } = await seedWorkflowAndPatient()
    await service.create(wf.id, { patientId: patient.id, title: 'Liste WF' })
    await prisma.patientProfile.update({ where: { id: patient.id }, data: { deletedAt: new Date() } })
    const list = await service.listForWorkflow(wf.id)
    expect(list).toHaveLength(1)
    expect(list[0]?.patient.name).toBe('Alice Durand')
    expect(list[0]?.patient.deletedAt).not.toBeNull()
  })

  it('get() returns the full run with parsed graph and patient', async () => {
    const { wf, patient } = await seedWorkflowAndPatient()
    const created = await service.create(wf.id, { patientId: patient.id, title: 'Détail' })
    const full = await service.get(created.id)
    expect(full.title).toBe('Détail')
    expect(full.workflow.id).toBe(wf.id)
    expect(full.workflow.graph.nodes.length).toBe(3)
    expect(full.patient.name).toBe('Alice Durand')
  })

  it('advance() with simple-mode email routes via success on a matching outcome', async () => {
    const { wf, patient } = await seedWorkflowAndPatient()
    const created = await service.create(wf.id, { patientId: patient.id, title: 'Avance' })
    await service.advance(created.id, {})
    const afterEmail = await service.advance(created.id, { outcome: 'delivered' })
    expect(afterEmail.currentNodeId).toBe('e')
    expect(afterEmail.history.length).toBe(3)
  })

  it('advance() on an end node throws 400', async () => {
    const { wf, patient } = await seedWorkflowAndPatient()
    const created = await service.create(wf.id, { patientId: patient.id, title: 'Fin' })
    await service.advance(created.id, {})
    await service.advance(created.id, { outcome: 'delivered' })
    await expect(service.advance(created.id, {})).rejects.toMatchObject({ status: 400 })
  })

  it('parallel branches: enter each child at the same day then merge', async () => {
    const parallelGraph = {
      nodes: [
        { id: 's', position: { x: 0, y: START_Y }, data: { kind: 'start' } },
        { id: 'a', position: { x: 7, y: START_Y }, data: {
          kind: 'send_email', params: { subject: 'A', body: '', output: { mode: 'simple', successCondition: { statuses: ['delivered'] } } }
        }},
        { id: 'b', position: { x: 7, y: START_Y + 200 }, data: {
          kind: 'send_email', params: { subject: 'B', body: '', output: { mode: 'simple', successCondition: { statuses: ['delivered'] } } }
        }},
        { id: 'e', position: { x: 14, y: START_Y }, data: { kind: 'end' } }
      ],
      edges: [
        { id: 'e1', source: 's', target: 'a', daysAfter: 7 },
        { id: 'e2', source: 's', target: 'b', daysAfter: 7 },
        { id: 'e3', source: 'a', target: 'e', daysAfter: 7, sourceHandle: 'success' },
        { id: 'e4', source: 'b', target: 'e', daysAfter: 7, sourceHandle: 'success' }
      ]
    }
    const wf = await prisma.workflow.create({ data: { name: 'Parallel', graph: JSON.stringify(parallelGraph) } })
    const patient = await prisma.patientProfile.create({ data: { firstName: 'A', lastName: 'B', gender: 'female' } })
    const run = await service.create(wf.id, { patientId: patient.id, title: 'Parallèle' })
    expect(run.activeFrontiers).toEqual(expect.arrayContaining(['a', 'b']))

    let state = await service.focus(run.id, { nodeId: 'a' })
    state = await service.advance(state.id, { nodeId: 'a' })
    expect(state.history.map(h => h.nodeId)).toContain('a')
    expect(state.activeFrontiers).toContain('b')

    state = await service.advance(state.id, { nodeId: 'a', outcome: 'delivered' })
    expect(state.focusedNodeId).toBe('b')

    state = await service.focus(state.id, { nodeId: 'b' })
    state = await service.advance(state.id, { nodeId: 'b' })
    state = await service.advance(state.id, { nodeId: 'b', outcome: 'delivered' })
    expect(state.history.map(h => h.nodeId)).toContain('b')
    expect(state.activeFrontiers).toContain('e')
  })

  it('update() changes title and startDate', async () => {
    const { wf, patient } = await seedWorkflowAndPatient()
    const created = await service.create(wf.id, { patientId: patient.id, title: 'Avant' })
    const updated = await service.update(created.id, {
      title: 'Après',
      startDate: '2026-01-15T00:00:00.000Z'
    })
    expect(updated.title).toBe('Après')
    expect(updated.startDate).toBe('2026-01-15T00:00:00.000Z')
    const full = await service.get(created.id)
    expect(full.title).toBe('Après')
  })

  it('reset() rewinds currentNodeId to start and seeds history with one entry', async () => {
    const { wf, patient } = await seedWorkflowAndPatient()
    const created = await service.create(wf.id, { patientId: patient.id, title: 'Reset' })
    await service.advance(created.id, {})
    await service.advance(created.id, { outcome: 'delivered' })
    const reset = await service.reset(created.id)
    expect(reset.currentNodeId).toBe('s')
    expect(reset.history).toHaveLength(1)
  })
})
