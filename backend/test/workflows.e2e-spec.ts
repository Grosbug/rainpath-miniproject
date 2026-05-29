import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { Graph, START_Y } from '@rainpath/shared'
import { PrismaService } from '../src/prisma/prisma.service'
import { buildTestApp, resetTables } from './test-app'

describe('Workflows (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    ;({ app, prisma } = await buildTestApp())
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

  it('POST /api/workflows accepts an import with a cycle but surfaces the validationError', async () => {
    const graph: Graph = {
      nodes: [
        { id: 's', position: { x: 0, y: START_Y }, data: { kind: 'start' } },
        { id: 'a', position: { x: 1, y: START_Y }, data: { kind: 'send_email', params: { subject: '', body: '', output: { mode: 'simple', successCondition: { statuses: ['delivered'] } } } } },
        { id: 'b', position: { x: 2, y: START_Y }, data: { kind: 'send_email', params: { subject: '', body: '', output: { mode: 'simple', successCondition: { statuses: ['delivered'] } } } } },
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
      .expect(201)
    expect(res.body.validationErrors.some((e: any) => e.code === 'cycle')).toBe(true)
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
