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
