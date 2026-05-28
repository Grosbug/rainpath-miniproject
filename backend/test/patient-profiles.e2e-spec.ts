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
