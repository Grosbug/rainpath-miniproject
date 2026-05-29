import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { START_Y } from '@rainpath/shared'
import { PrismaService } from '../src/prisma/prisma.service'
import { buildTestApp, resetTables } from './test-app'

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

describe('PatientRuns (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => { ({ app, prisma } = await buildTestApp()) })
  afterAll(async () => { await app.close() })
  beforeEach(async () => { await resetTables(prisma) })

  async function seed() {
    const wfRes = await request(app.getHttpServer())
      .post('/api/workflows')
      .send({ name: 'Simple', graph: SIMPLE_GRAPH })
    const patientRes = await request(app.getHttpServer())
      .post('/api/patient-profiles')
      .send({ firstName: 'Alice', lastName: 'Durand', gender: 'female', email: 'alice@example.com' })
    return { workflowId: wfRes.body.id as string, patientId: patientRes.body.id as string }
  }

  it('POST /api/workflows/:id/patient-runs creates a run at the start node', async () => {
    const { workflowId, patientId } = await seed()
    const res = await request(app.getHttpServer())
      .post(`/api/workflows/${workflowId}/patient-runs`)
      .send({ patientId })
      .expect(201)
    expect(res.body.currentNodeId).toBe('s')
    expect(res.body.history).toHaveLength(1)
    expect(res.body.workflow.graph.nodes.length).toBe(3)
  })

  it('GET /api/workflows/:id/patient-runs returns runs incl. soft-deleted-patient marker', async () => {
    const { workflowId, patientId } = await seed()
    await request(app.getHttpServer())
      .post(`/api/workflows/${workflowId}/patient-runs`)
      .send({ patientId })
    await request(app.getHttpServer()).delete(`/api/patient-profiles/${patientId}`)
    const list = await request(app.getHttpServer())
      .get(`/api/workflows/${workflowId}/patient-runs`)
      .expect(200)
    expect(list.body).toHaveLength(1)
    expect(list.body[0].patient.name).toBe('Alice Durand')
    expect(list.body[0].patient.deletedAt).not.toBeNull()
  })

  it('full journey: create → advance s→a → advance a→e → reset → advance s→a', async () => {
    const { workflowId, patientId } = await seed()
    const created = await request(app.getHttpServer())
      .post(`/api/workflows/${workflowId}/patient-runs`)
      .send({ patientId })
    const runId = created.body.id

    let r = await request(app.getHttpServer())
      .post(`/api/patient-runs/${runId}/advance`)
      .send({})
      .expect(201)
    expect(r.body.currentNodeId).toBe('a')

    r = await request(app.getHttpServer())
      .post(`/api/patient-runs/${runId}/advance`)
      .send({ outcome: 'delivered' })
      .expect(201)
    expect(r.body.currentNodeId).toBe('e')

    await request(app.getHttpServer())
      .post(`/api/patient-runs/${runId}/advance`)
      .send({})
      .expect(400)

    r = await request(app.getHttpServer())
      .post(`/api/patient-runs/${runId}/reset`)
      .expect(201)
    expect(r.body.currentNodeId).toBe('s')
    expect(r.body.history).toHaveLength(1)

    r = await request(app.getHttpServer())
      .post(`/api/patient-runs/${runId}/advance`)
      .send({})
      .expect(201)
    expect(r.body.currentNodeId).toBe('a')
  })

  it('GET /api/patient-runs/:id returns the full run', async () => {
    const { workflowId, patientId } = await seed()
    const created = await request(app.getHttpServer())
      .post(`/api/workflows/${workflowId}/patient-runs`)
      .send({ patientId })
    const full = await request(app.getHttpServer())
      .get(`/api/patient-runs/${created.body.id}`)
      .expect(200)
    expect(full.body.workflow.name).toBe('Simple')
    expect(full.body.patient.name).toBe('Alice Durand')
    expect(full.body.patient.email).toBe('alice@example.com')
  })

  it('POST /api/workflows/:id/patient-runs rejects unknown workflowId (404)', async () => {
    const patientRes = await request(app.getHttpServer())
      .post('/api/patient-profiles')
      .send({ firstName: 'Alice', lastName: 'Test', gender: 'female' })
    await request(app.getHttpServer())
      .post('/api/workflows/no-such-wf/patient-runs')
      .send({ patientId: patientRes.body.id })
      .expect(404)
  })
})
