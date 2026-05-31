import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildTestApp, resetTables } from './test-app';

describe('Node templates (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetTables(prisma);
  });

  it('POST /api/node-templates creates an email template', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/node-templates')
      .send({
        name: 'Email — relance',
        kind: 'send_email',
        params: {
          subject: 'Sujet',
          body: '',
          output: {
            mode: 'simple',
            successCondition: { statuses: ['delivered'] },
          },
        },
      })
      .expect(201);
    expect(res.body.kind).toBe('send_email');
  });

  it('POST /api/node-templates rejects mismatched kind/params (422)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/node-templates')
      .send({
        name: 'Bad',
        kind: 'send_sms',
        params: { subject: 'sms-has-no-subject' },
      })
      .expect(422);
    expect(res.body.errors.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/node-templates rejects status outside channel (422)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/node-templates')
      .send({
        name: 'Bad email simple',
        kind: 'send_email',
        params: {
          subject: '',
          body: '',
          output: {
            mode: 'simple',
            successCondition: { statuses: ['ghost_status'] },
          },
        },
      })
      .expect(422);
    expect(
      res.body.errors.some((e: any) => e.code === 'status_not_in_channel'),
    ).toBe(true);
  });

  it('GET /api/node-templates returns templates ordered by kind then name', async () => {
    await request(app.getHttpServer())
      .post('/api/node-templates')
      .send({
        name: 'Z',
        kind: 'send_sms',
        params: {
          body: 'x',
          output: {
            mode: 'simple',
            successCondition: { statuses: ['delivered'] },
          },
        },
      });
    await request(app.getHttpServer())
      .post('/api/node-templates')
      .send({
        name: 'B',
        kind: 'send_email',
        params: {
          subject: '',
          body: '',
          output: {
            mode: 'simple',
            successCondition: { statuses: ['delivered'] },
          },
        },
      });
    await request(app.getHttpServer())
      .post('/api/node-templates')
      .send({
        name: 'A',
        kind: 'send_email',
        params: {
          subject: '',
          body: '',
          output: {
            mode: 'simple',
            successCondition: { statuses: ['delivered'] },
          },
        },
      });
    const res = await request(app.getHttpServer())
      .get('/api/node-templates')
      .expect(200);
    expect(res.body.map((t: any) => `${t.kind}:${t.name}`)).toEqual([
      'send_email:A',
      'send_email:B',
      'send_sms:Z',
    ]);
  });

  it('PATCH /api/node-templates/:id updates name and validates new params', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/node-templates')
      .send({
        name: 'T',
        kind: 'send_email',
        params: {
          subject: '',
          body: '',
          output: {
            mode: 'simple',
            successCondition: { statuses: ['delivered'] },
          },
        },
      });
    const res = await request(app.getHttpServer())
      .patch(`/api/node-templates/${created.body.id}`)
      .send({
        name: 'T2',
        params: {
          subject: 'Updated',
          body: '',
          output: {
            mode: 'simple',
            successCondition: { statuses: ['delivered'] },
          },
        },
      })
      .expect(200);
    expect(res.body.name).toBe('T2');
    expect(res.body.params.subject).toBe('Updated');
  });

  it('DELETE /api/node-templates/:id soft-deletes', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/node-templates')
      .send({
        name: 'T',
        kind: 'send_email',
        params: {
          subject: '',
          body: '',
          output: {
            mode: 'simple',
            successCondition: { statuses: ['delivered'] },
          },
        },
      });
    await request(app.getHttpServer())
      .delete(`/api/node-templates/${created.body.id}`)
      .expect(204);
    const list = await request(app.getHttpServer())
      .get('/api/node-templates')
      .expect(200);
    expect(
      list.body.find((t: any) => t.id === created.body.id),
    ).toBeUndefined();
  });
});
