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
    const p = await service.create({ firstName: 'Alice', lastName: 'Durand', gender: 'female', email: 'a@b.co' })
    expect(p).toMatchObject({
      firstName: 'Alice', lastName: 'Durand', name: 'Alice Durand', gender: 'female',
      email: 'a@b.co', phone: null, whatsapp: null, address: null
    })
  })

  it('list() omits soft-deleted profiles', async () => {
    const a = await service.create({ firstName: 'Alice', lastName: 'Durand', gender: 'female' })
    await service.create({ firstName: 'Bob', lastName: 'Martin', gender: 'male' })
    await service.softDelete(a.id)
    const list = await service.list()
    expect(list.map(p => p.firstName).sort()).toEqual(['Bob'])
  })

  it('get() throws 404 on unknown id', async () => {
    await expect(service.get('nope')).rejects.toMatchObject({ status: 404 })
  })

  it('update() accepts nulls to clear fields', async () => {
    const p = await service.create({ firstName: 'Alice', lastName: 'Durand', gender: 'female', email: 'a@b.co', phone: '+33...' })
    const updated = await service.update(p.id, { email: null, phone: null })
    expect(updated.email).toBeNull()
    expect(updated.phone).toBeNull()
    expect(updated.firstName).toBe('Alice')
  })

  it('softDelete() does NOT cascade to runs (spec §6.3)', async () => {
    const p = await service.create({ firstName: 'Alice', lastName: 'Durand', gender: 'female' })
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
