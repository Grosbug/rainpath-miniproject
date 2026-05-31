import { Test } from '@nestjs/testing';
import { execSync } from 'node:child_process';
import { unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Graph, START_Y } from '@rainpath/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkflowsService } from './workflows.service';

const TEST_DB = join(__dirname, '..', '..', 'test', 'workflows-svc.db');

function resetDb() {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  process.env.DATABASE_URL = `file:${TEST_DB}`;
  execSync('pnpm exec prisma db push --skip-generate', {
    cwd: join(__dirname, '..', '..'),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });
}

describe('WorkflowsService', () => {
  let service: WorkflowsService;
  let prisma: PrismaService;

  beforeAll(() => {
    resetDb();
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [WorkflowsService],
    }).compile();
    service = moduleRef.get(WorkflowsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.patientRun.deleteMany();
    await prisma.workflow.deleteMany();
  });

  it('create() returns a default start + end graph (no edges) when no graph provided', async () => {
    const wf = await service.create({ name: 'New' });
    expect(
      wf.graph.nodes.find((n) => n.data.kind === 'start')?.position,
    ).toEqual({ x: 0, y: START_Y });
    expect(wf.graph.nodes.some((n) => n.data.kind === 'end')).toBe(true);
    expect(wf.graph.edges).toEqual([]);
    expect(wf.warnings).toEqual([]);
    // Default start+end is structurally OK but not wired yet — `no_path_start_to_end` flags
    // that gap as a hard error so the UI can block patient-run creation until it's fixed.
    expect(
      wf.validationErrors.some((e) => e.code === 'no_path_start_to_end'),
    ).toBe(true);
  });

  it('create() accepts an imported graph and validates it', async () => {
    const graph: Graph = {
      nodes: [
        { id: 's', position: { x: 0, y: START_Y }, data: { kind: 'start' } },
        { id: 'e', position: { x: 5, y: START_Y }, data: { kind: 'end' } },
      ],
      edges: [{ id: 'e1', source: 's', target: 'e', daysAfter: 5 }],
    };
    const wf = await service.create({ name: 'Imported', graph });
    expect(wf.graph.edges[0]?.daysAfter).toBe(5);
  });

  it('create() accepts an invalid imported graph but surfaces validationErrors in the response', async () => {
    // The service now persists invalid workflows so users aren't trapped mid-edit;
    // the validation surface moves to the response so the UI can block runs.
    const graph: Graph = { nodes: [], edges: [] };
    const wf = await service.create({ name: 'Bad', graph });
    expect(wf.validationErrors.length).toBeGreaterThan(0);
    expect(wf.validationErrors.some((e) => e.code === 'no_start')).toBe(true);
  });

  it('list() returns paginated envelope with id/name/description/updatedAt/isValid only (no graph)', async () => {
    await service.create({ name: 'A' });
    const list = await service.list({ limit: 50, offset: 0 });
    expect(list.total).toBe(1);
    expect(list.limit).toBe(50);
    expect(list.offset).toBe(0);
    expect(list.items[0]).toMatchObject({ name: 'A' });
    expect((list.items[0] as any).graph).toBeUndefined();
    expect(typeof list.items[0]?.isValid).toBe('boolean');
  });

  it('list() honors limit/offset and reports total independently', async () => {
    for (let i = 0; i < 5; i++) await service.create({ name: `WF-${i}` });
    const page = await service.list({ limit: 2, offset: 0 });
    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(5);
    const page2 = await service.list({ limit: 2, offset: 4 });
    expect(page2.items).toHaveLength(1);
    expect(page2.total).toBe(5);
  });

  it('list() filters by search substring on name and description', async () => {
    await service.create({ name: 'Relance simple' });
    await service.create({ name: 'Suivi long' });
    const r = await service.list({ limit: 50, offset: 0, search: 'relance' });
    expect(r.items).toHaveLength(1);
    expect(r.items[0]?.name).toBe('Relance simple');
  });

  it('list() exposes the cached isValid flag (true for a wired graph, false for the default empty one)', async () => {
    // Default graph = start + end with no edges → no_path_start_to_end ⇒ isValid:false.
    const empty = await service.create({ name: 'Empty' });
    // Imported wired graph ⇒ isValid:true.
    const wired = await service.create({
      name: 'Wired',
      graph: {
        nodes: [
          { id: 's', position: { x: 0, y: START_Y }, data: { kind: 'start' } },
          { id: 'e', position: { x: 5, y: START_Y }, data: { kind: 'end' } },
        ],
        edges: [{ id: 'e1', source: 's', target: 'e', daysAfter: 5 }],
      },
    });
    const list = await service.list({ limit: 50, offset: 0 });
    const byId = new Map(list.items.map((i) => [i.id, i]));
    expect(byId.get(empty.id)?.isValid).toBe(false);
    expect(byId.get(wired.id)?.isValid).toBe(true);
  });

  it('get() returns the full workflow', async () => {
    const created = await service.create({ name: 'A' });
    const fetched = await service.get(created.id);
    expect(fetched.id).toBe(created.id);
    expect(fetched.graph.nodes.length).toBeGreaterThan(0);
  });

  it('get() throws 404 for unknown id', async () => {
    await expect(service.get('does-not-exist')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('update() patches name and validates new graph', async () => {
    const wf = await service.create({ name: 'Original' });
    const renamed = await service.update(wf.id, { name: 'Renamed' });
    expect(renamed.name).toBe('Renamed');
  });

  it('update() rejects a graph that introduces a cycle', async () => {
    const wf = await service.create({ name: 'WF' });
    const cyclicGraph: Graph = {
      nodes: [
        { id: 's', position: { x: 0, y: START_Y }, data: { kind: 'start' } },
        {
          id: 'a',
          position: { x: 1, y: START_Y },
          data: {
            kind: 'send_email',
            params: {
              subject: '',
              body: '',
              output: {
                mode: 'simple',
                successCondition: { statuses: ['delivered'] },
              },
            },
          },
        },
        {
          id: 'b',
          position: { x: 2, y: START_Y },
          data: {
            kind: 'send_email',
            params: {
              subject: '',
              body: '',
              output: {
                mode: 'simple',
                successCondition: { statuses: ['delivered'] },
              },
            },
          },
        },
        { id: 'e', position: { x: 3, y: START_Y }, data: { kind: 'end' } },
      ],
      edges: [
        { id: 'e1', source: 's', target: 'a', daysAfter: 1 },
        { id: 'e2', source: 'a', target: 'b', daysAfter: 1 },
        { id: 'e3', source: 'b', target: 'a', daysAfter: 1 },
        { id: 'e4', source: 'b', target: 'e', daysAfter: 1 },
      ],
    };
    const updated = await service.update(wf.id, { graph: cyclicGraph });
    expect(updated.validationErrors.some((e) => e.code === 'cycle')).toBe(true);
  });

  it('duplicate() copies graph and appends "(copie)" by default', async () => {
    const wf = await service.create({ name: 'WF' });
    const dup = await service.duplicate(wf.id, {});
    expect(dup.id).not.toBe(wf.id);
    expect(dup.name).toBe('WF (copie)');
    expect(dup.graph.nodes.length).toBe(wf.graph.nodes.length);
  });

  it('duplicate() honors a provided name', async () => {
    const wf = await service.create({ name: 'WF' });
    const dup = await service.duplicate(wf.id, { name: 'Clone' });
    expect(dup.name).toBe('Clone');
  });

  it('softDelete() sets deletedAt and hides the workflow from list/get', async () => {
    const wf = await service.create({ name: 'WF' });
    await service.softDelete(wf.id);
    const list = await service.list({ limit: 50, offset: 0 });
    expect(list.items.find((w) => w.id === wf.id)).toBeUndefined();
    expect(list.total).toBe(0);
    await expect(service.get(wf.id)).rejects.toMatchObject({ status: 404 });
  });

  it('softDelete() cascades to PatientRun rows (no orphan visible)', async () => {
    const wf = await service.create({ name: 'WF' });
    const patient = await prisma.patientProfile.create({
      data: { firstName: 'P', lastName: 'Test', gender: 'male' },
    });
    await prisma.patientRun.create({
      data: {
        workflowId: wf.id,
        patientId: patient.id,
        title: '',
        currentNodeId: null,
        history: '[]',
      },
    });
    await service.softDelete(wf.id);
    const runs = await prisma.patientRun.findMany({
      where: { workflowId: wf.id },
    });
    expect(runs.every((r) => r.deletedAt !== null)).toBe(true);
  });
});
