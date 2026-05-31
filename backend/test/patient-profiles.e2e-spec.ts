import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildTestApp, resetTables } from './test-app';

const ALICE = {
  firstName: 'Alice',
  lastName: 'Durand',
  gender: 'female' as const,
};
const BOB = { firstName: 'Bob', lastName: 'Smith', gender: 'male' as const };

describe('PatientProfiles (e2e)', () => {
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

  it('POST /api/patient-profiles creates a profile', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/patient-profiles')
      .send({ ...ALICE, email: 'a@b.co' })
      .expect(201);
    expect(res.body.name).toBe('Alice Durand');
    expect(res.body.email).toBe('a@b.co');
    expect(res.body.phone).toBeNull();
    expect(res.body.address).toBeNull();
  });

  it('POST /api/patient-profiles accepts a structured address', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/patient-profiles')
      .send({
        ...ALICE,
        address: {
          street: '1 rue de la Paix',
          postalCode: '75001',
          city: 'Paris',
          country: 'France',
        },
      })
      .expect(201);
    expect(res.body.address).toEqual({
      street: '1 rue de la Paix',
      postalCode: '75001',
      city: 'Paris',
      country: 'France',
    });
  });

  it('POST /api/patient-profiles rejects an invalid postal code (422)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/patient-profiles')
      .send({
        ...ALICE,
        address: { street: 'X', postalCode: 'abc', city: 'Y' },
      })
      .expect(422);
    expect(res.body.errors.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/patient-profiles rejects an empty firstName (422)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/patient-profiles')
      .send({ ...ALICE, firstName: '' })
      .expect(422);
    expect(res.body.errors.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/patient-profiles lists active profiles', async () => {
    await request(app.getHttpServer())
      .post('/api/patient-profiles')
      .send(ALICE);
    await request(app.getHttpServer()).post('/api/patient-profiles').send(BOB);
    const res = await request(app.getHttpServer())
      .get('/api/patient-profiles')
      .expect(200);
    expect(res.body.map((p: any) => p.name).sort()).toEqual([
      'Alice Durand',
      'Bob Smith',
    ]);
  });

  it('PATCH /api/patient-profiles/:id accepts null to clear a field', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/patient-profiles')
      .send({ ...ALICE, email: 'a@b.co' });
    const res = await request(app.getHttpServer())
      .patch(`/api/patient-profiles/${created.body.id}`)
      .send({ email: null })
      .expect(200);
    expect(res.body.email).toBeNull();
  });

  it('DELETE /api/patient-profiles/:id soft-deletes', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/patient-profiles')
      .send(ALICE);
    await request(app.getHttpServer())
      .delete(`/api/patient-profiles/${created.body.id}`)
      .expect(204);
    const list = await request(app.getHttpServer())
      .get('/api/patient-profiles')
      .expect(200);
    expect(
      list.body.find((p: any) => p.id === created.body.id),
    ).toBeUndefined();
  });
});
