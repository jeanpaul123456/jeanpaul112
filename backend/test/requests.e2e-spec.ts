import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

// A real, isolated SQLite database; never writes to the user's dev.db.
describe('Employee-to-department requests (SQLite)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let directory: string;
  let originalUrl: string | undefined;
  const cookies: Record<string, string> = {};
  const identities = ['it-staff', 'hr-staff', 'finance-staff', 'employee'];
  const departments = ['it', 'hr', 'finance'];
  const body = {
    title: 'Laptop problem',
    description: 'The screen stays black.\nStarted this morning.',
    departmentSlug: 'it',
  };

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'service-hub-test-'));
    originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = `file:${join(directory, 'test.db').replaceAll('\\', '/')}`;
    prisma = new PrismaService();
    const sql = await readFile(
      new URL('../prisma/schema.sql', import.meta.url),
      'utf8',
    );
    for (const statement of sql.split(';').filter((part) => part.trim())) {
      await prisma.$executeRawUnsafe(statement);
    }
    const idempotencyMigration = await readFile(
      new URL('../prisma/migrations/002-idempotency.sql', import.meta.url),
      'utf8',
    );
    for (const statement of idempotencyMigration.split(';').filter((part) => part.trim())) {
      await prisma.$executeRawUnsafe(statement);
    }
    const loginSql = await readFile(new URL('../prisma/migrations/003-employee-login.sql', import.meta.url), 'utf8');
    for (const statement of loginSql.split(';').filter(part => part.trim())) await prisma.$executeRawUnsafe(statement);
    const usernameSql = await readFile(new URL('../prisma/migrations/004-employee-username.sql', import.meta.url), 'utf8');
    for (const statement of usernameSql.split(';').filter(part => part.trim())) await prisma.$executeRawUnsafe(statement);
    for (const id of identities)
      await prisma.employee.create({
        data: { id, username: id, displayName: id, email: `${id}@example.com` },
      });
    for (const slug of departments) {
      await prisma.department.create({
        data: { id: slug, slug, name: slug.toUpperCase() },
      });
      await prisma.departmentMembership.create({
        data: { employeeId: `${slug}-staff`, departmentId: slug },
      });
    }
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = module.createNestApplication();
    await app.init();
    for (const id of identities) {
      const login = await request(app.getHttpServer()).post('/auth/login').send({ email: id + '@example.com', username: id }).expect(201);
      cookies[id] = login.headers['set-cookie'][0].split(';')[0];
    }
  });

  it('exposes readiness using the real database', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'ok' });
  });

  it('requires a session and ignores a forged employee header', async () => {
    await request(app.getHttpServer()).get('/directory').set('x-employee-id', 'it-staff').expect(401);
    const response = await request(app.getHttpServer()).get('/auth/me')
      .set('Cookie', cookies.employee).set('x-employee-id', 'it-staff').expect(200);
    expect(response.body.id).toBe('employee');
    expect(response.body.passwordHash).toBeUndefined();
    expect(response.body.credential).toBeUndefined();
    await request(app.getHttpServer()).get('/requests?department=it')
      .set('Cookie', cookies.employee).set('x-employee-id', 'it-staff').expect(403);
  });

  it('rejects incorrect credentials and cross-site login', async () => {
    for (const email of ['employee@example.com', 'missing@example.com']) {
      await request(app.getHttpServer()).post('/auth/login')
        .send({ email, username: 'wrong-password' }).expect(401)
        .expect(({ body }) => expect(body.message).toBe('Email or username is incorrect.'));
    }
    await request(app.getHttpServer()).post('/auth/login').set('Origin', 'https://untrusted.example')
      .send({ email: 'employee@example.com', username: 'employee' }).expect(403);
  });

  it('persists sessions across reconnect, revokes logout and rejects expiry', async () => {
    const signIn = () => request(app.getHttpServer()).post('/auth/login')
      .send({ email: 'employee@example.com', username: 'employee' }).expect(201);
    const login = await signIn();
    expect(login.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(login.headers['set-cookie'][0]).toContain('SameSite=Strict');
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    await prisma.$disconnect(); await prisma.$connect();
    await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie).expect(200);
    await request(app.getHttpServer()).post('/auth/logout').set('Cookie', cookie).send({}).expect(201);
    await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie).expect(401);
    const expiryLogin = await signIn();
    const expiryCookie = expiryLogin.headers['set-cookie'][0].split(';')[0];
    const { createHash } = await import('node:crypto');
    const tokenHash = createHash('sha256').update(expiryCookie.split('=')[1]).digest('hex');
    await prisma.loginSession.update({ where: { tokenHash }, data: { expiresAt: new Date(0) } });
    await request(app.getHttpServer()).get('/auth/me').set('Cookie', expiryCookie).expect(401);
  });

  it('limits repeated failed sign-ins', async () => {
    for (let i = 0; i < 20; i++) await request(app.getHttpServer()).post('/auth/login')
      .send({ email: 'throttled@example.com', username: 'wrong-password' }).expect(401);
    await request(app.getHttpServer()).post('/auth/login')
      .send({ email: 'throttled@example.com', username: 'wrong-password' }).expect(429);
  });

  it('accepts the configured public origin behind a proxy but rejects forged origins', async () => {
    const previous = process.env.APP_ORIGIN;
    process.env.APP_ORIGIN = 'https://hub.example.com';
    try {
      const login = () => request(app.getHttpServer()).post('/auth/login')
        .set('Host', 'internal-proxy:10000');
      await login().set('Origin', 'https://hub.example.com')
        .send({ email: 'employee@example.com', username: 'employee' }).expect(201);
      for (const origin of ['https://attacker.example', 'http://hub.example.com', 'null', 'https://hub.example.com.attacker.example']) {
        await login().set('Origin', origin).set('X-Forwarded-Host', 'hub.example.com')
          .send({ email: 'employee@example.com', username: 'employee' }).expect(403);
      }
    } finally {
      if (previous === undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = previous;
    }
  });

  it('uses Render public URL and supports the local Vite proxy only in development', async () => {
    const original = { app: process.env.APP_ORIGIN, render: process.env.RENDER_EXTERNAL_URL, node: process.env.NODE_ENV };
    delete process.env.APP_ORIGIN;
    try {
      process.env.RENDER_EXTERNAL_URL = 'https://example.onrender.com';
      await request(app.getHttpServer()).post('/auth/login').set('Host', 'internal:10000')
        .set('Origin', 'https://example.onrender.com')
        .send({ email: 'employee@example.com', username: 'employee' }).expect(201);
      delete process.env.RENDER_EXTERNAL_URL;
      process.env.NODE_ENV = 'development';
      await request(app.getHttpServer()).post('/auth/login').set('Host', '127.0.0.1:3000')
        .set('Origin', 'http://localhost:5173')
        .send({ email: 'employee@example.com', username: 'employee' }).expect(201);
      process.env.NODE_ENV = 'production';
      await request(app.getHttpServer()).post('/auth/login').set('Host', '127.0.0.1:3000')
        .set('Origin', 'http://localhost:5173').send({}).expect(403);
    } finally {
      for (const [key, value] of Object.entries({ APP_ORIGIN: original.app, RENDER_EXTERNAL_URL: original.render, NODE_ENV: original.node })) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });

  it('reviews using real employee and department records without creating a request', async () => {
    const count = await prisma.serviceRequest.count();
    vi.stubEnv('REQUEST_REVIEW_MODE', 'openai');
    vi.stubEnv('OPENAI_API_KEY', 'test-only');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: 'completed',
          output: [
            {
              type: 'message',
              content: [
                {
                  type: 'output_text',
                  text: JSON.stringify({
                    improvedTitle: 'Laptop problem',
                    improvedDescription: 'My laptop screen stays black.',
                    suggestedDepartmentSlug: 'it',
                    suggestedPriority: 'Medium',
                    explanation: 'Device issues belong to IT.',
                    concerns: ['Is work blocked?'],
                  }),
                },
              ],
            },
          ],
        }),
      })),
    );
    try {
      await request(app.getHttpServer())
        .post('/ai/review-request')
        .set('Cookie', cookies['unknown'] || 'hub_session=invalid')
        .send({ ...body, priority: 'Medium' })
        .expect(401);
      expect(fetch).not.toHaveBeenCalled();
      await request(app.getHttpServer())
        .post('/ai/review-request')
        .set('Cookie', cookies['employee'] || 'hub_session=invalid')
        .send({ ...body, priority: 'invalid' })
        .expect(400);
      expect(fetch).not.toHaveBeenCalled();
      const result = await request(app.getHttpServer())
        .post('/ai/review-request')
        .set('Cookie', cookies['employee'] || 'hub_session=invalid')
        .send({ ...body, priority: 'Medium' })
        .expect(201);
      expect(result.body.suggestedDepartmentSlug).toBe('it');
      expect(await prisma.serviceRequest.count()).toBe(count);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
  it('submits clear requests for staff acceptance but persists nothing when AI finds concerns', async () => {
    vi.stubEnv('REQUEST_REVIEW_MODE', 'openai');
    vi.stubEnv('OPENAI_API_KEY', 'test-only');
    let concerns: string[] = ['Please clarify what is broken.'];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: 'completed',
          output: [
            {
              type: 'message',
              content: [
                {
                  type: 'output_text',
                  text: JSON.stringify({
                    improvedTitle: body.title,
                    improvedDescription: body.description,
                    suggestedDepartmentSlug: 'it',
                    suggestedPriority: 'Medium',
                    explanation: 'IT handles device issues.',
                    concerns,
                  }),
                },
              ],
            },
          ],
        }),
      })),
    );
    try {
      const count = await prisma.serviceRequest.count();
      await request(app.getHttpServer())
        .post('/ai/submit-request')
        .set('Cookie', cookies['employee'] || 'hub_session=invalid')
        .send({ ...body, priority: 'Medium' })
        .expect(400);
      expect(await prisma.serviceRequest.count()).toBe(count);
      concerns = [];
      const idempotencyKey = 'test-submit-key-0001';
      const created = await request(app.getHttpServer())
        .post('/ai/submit-request')
        .set('Cookie', cookies['employee'] || 'hub_session=invalid')
        .set('Idempotency-Key', idempotencyKey)
        .send({ ...body, priority: 'Medium' })
        .expect(201);
      expect(created.body.status).toBe('Submitted');
      const reviewCalls = vi.mocked(fetch).mock.calls.length;
      const duplicate = await request(app.getHttpServer())
        .post('/ai/submit-request')
        .set('Cookie', cookies['employee'] || 'hub_session=invalid')
        .set('Idempotency-Key', idempotencyKey)
        .send({ ...body, priority: 'Medium' })
        .expect(201);
      expect(duplicate.body).toEqual(created.body);
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(reviewCalls);
      const mismatch = await request(app.getHttpServer())
        .post('/ai/submit-request')
        .set('Cookie', cookies['employee'] || 'hub_session=invalid')
        .set('Idempotency-Key', idempotencyKey)
        .send({ ...body, title: 'Different title', priority: 'Medium' })
        .expect(409);
      expect(mismatch.body.message).toContain('different request');
      const saved = await prisma.serviceRequest.findUnique({
        where: { ticketNumber: created.body.ticketNumber },
        include: { history: true },
      });
      expect(saved?.status).toBe('SUBMITTED');
      expect(saved?.history).toHaveLength(1);
      expect(saved?.history[0].toStatus).toBe('SUBMITTED');
      expect(await prisma.serviceRequest.count()).toBe(count + 1);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
    if (directory) {
      for (const suffix of ['', '-wal', '-shm', '-journal'])
        await unlink(join(directory, `test.db${suffix}`)).catch(() => {});
      // libSQL can retain a Windows file handle until the test worker exits.
      // In that case leave only this disposable database in the OS temp folder.
      await rmdir(directory).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOTEMPTY') throw error;
      });
    }
  });

  it.each(
    identities.flatMap((id) =>
      departments.map((department) => [id, department]),
    ),
  )('allows %s to send to %s', async (id, department) => {
    const created = await request(app.getHttpServer())
      .post('/requests')
      .set('Cookie', cookies[id] || 'hub_session=invalid')
      .send({ ...body, departmentSlug: department })
      .expect(201);
    const ticket = created.body.ticketNumber;
    const personal = await request(app.getHttpServer())
      .get('/requests')
      .set('Cookie', cookies[id] || 'hub_session=invalid')
      .expect(200);
    expect(personal.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ticketNumber: ticket,
          description: body.description,
          department: expect.objectContaining({ slug: department }),
          employee: expect.objectContaining({ id }),
          status: 'Submitted',
          priority: 'Medium',
        }),
      ]),
    );
    const inbox = await request(app.getHttpServer())
      .get(`/requests?department=${department}`)
      .set('Cookie', cookies[`${department}-staff`] || 'hub_session=invalid')
      .expect(200);
    expect(
      inbox.body.some(
        (item: { ticketNumber: string }) => item.ticketNumber === ticket,
      ),
    ).toBe(true);
    const otherDepartment = departments.find((item) => item !== department)!;
    const otherInbox = await request(app.getHttpServer())
      .get(`/requests?department=${otherDepartment}`)
      .set('Cookie', cookies[`${otherDepartment}-staff`] || 'hub_session=invalid')
      .expect(200);
    expect(
      otherInbox.body.some(
        (item: { ticketNumber: string }) => item.ticketNumber === ticket,
      ),
    ).toBe(false);
  });

  it.each([
    { ...body, description: '' },
    { ...body, description: '   ' },
    { ...body, description: 42 },
    { ...body, title: [] },
    { ...body, departmentSlug: 'unknown' },
    { ...body, departmentSlug: {} },
    { ...body, description: 'x'.repeat(5001) },
    { ...body, priority: 'Urgent' },
    { ...body, priority: null },
    { ...body, priority: 1 },
  ])('rejects invalid input without saving a request: %j', async (invalid) => {
    const before = await prisma.serviceRequest.count();
    await request(app.getHttpServer())
      .post('/requests')
      .set('Cookie', cookies['employee'] || 'hub_session=invalid')
      .send(invalid)
      .expect(400);
    expect(await prisma.serviceRequest.count()).toBe(before);
  });

  it('requires a known employee', async () => {
    await request(app.getHttpServer()).post('/requests').send(body).expect(401);
    await request(app.getHttpServer())
      .post('/requests')
      .set('Cookie', cookies['unknown'] || 'hub_session=invalid')
      .send(body)
      .expect(401);
    await request(app.getHttpServer()).get('/requests').expect(401);
  });

  it('replays direct submissions after reconnect without creating a second ticket', async () => {
    const key = 'direct-submit-key-001';
    const first = await request(app.getHttpServer())
      .post('/requests')
      .set('Cookie', cookies['employee'] || 'hub_session=invalid')
      .set('Idempotency-Key', key)
      .send(body)
      .expect(201);
    await prisma.$disconnect();
    await prisma.$connect();
    const retry = await request(app.getHttpServer())
      .post('/requests')
      .set('Cookie', cookies['employee'] || 'hub_session=invalid')
      .set('Idempotency-Key', key)
      .send(body)
      .expect(201);
    expect(retry.body).toEqual(first.body);
    await request(app.getHttpServer())
      .post('/requests')
      .set('Cookie', cookies['employee'] || 'hub_session=invalid')
      .set('Idempotency-Key', key)
      .send({ ...body, description: 'Changed payload' })
      .expect(409);
    const matches = await prisma.serviceRequest.findMany({
      where: { idempotencyKey: key },
      include: { history: true },
    });
    expect(matches).toHaveLength(1);
    expect(matches[0].history).toHaveLength(1);
  });

  it.each(['High', 'Medium', 'Low'])(
    'saves %s priority in personal and department views after reconnecting',
    async (priority) => {
      const created = await request(app.getHttpServer())
        .post('/requests')
        .set('Cookie', cookies['employee'] || 'hub_session=invalid')
        .send({ ...body, priority })
        .expect(201);
      await prisma.$disconnect();
      await prisma.$connect();
      const detail = await request(app.getHttpServer())
        .get(`/requests/${created.body.ticketNumber}`)
        .set('Cookie', cookies['employee'] || 'hub_session=invalid')
        .expect(200);
      expect(detail.body.priority).toBe(priority);
      for (const [url, id] of [
        ['/requests', 'employee'],
        ['/requests?department=it', 'it-staff'],
      ]) {
        const list = await request(app.getHttpServer())
          .get(url)
          .set('Cookie', cookies[id] || 'hub_session=invalid')
          .expect(200);
        expect(list.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              ticketNumber: created.body.ticketNumber,
              priority,
            }),
          ]),
        );
      }
    },
  );

  it('records a staff update and requires a rejection reason without changing state on invalid input', async () => {
    const created = await request(app.getHttpServer())
      .post('/requests')
      .set('Cookie', cookies['employee'] || 'hub_session=invalid')
      .send(body)
      .expect(201);
    const path = `/requests/${created.body.ticketNumber}`;
    for (const note of ['', '  ', 123, 'x'.repeat(2001)]) {
      await request(app.getHttpServer())
        .patch(`${path}/status`).set('Content-Type', 'application/json')
        .set('Cookie', cookies['it-staff'] || 'hub_session=invalid')
        .send({ status: 'Rejected', note })
        .expect(400);
    }
    const unchanged = await request(app.getHttpServer())
      .get(path)
      .set('Cookie', cookies['employee'] || 'hub_session=invalid')
      .expect(200);
    expect(unchanged.body.status).toBe('Submitted');
    expect(unchanged.body.history).toHaveLength(1);
    const note = 'Please send the asset number so we can identify your laptop.';
    await request(app.getHttpServer())
      .patch(`${path}/status`).set('Content-Type', 'application/json')
      .set('Cookie', cookies['it-staff'] || 'hub_session=invalid')
      .send({ status: 'Rejected', note })
      .expect(200);
    const updated = await request(app.getHttpServer())
      .get(path)
      .set('Cookie', cookies['employee'] || 'hub_session=invalid')
      .expect(200);
    expect(updated.body.status).toBe('Rejected');
    expect(updated.body.history[1]).toMatchObject({
      status: 'Rejected',
      note,
      changedBy: { id: 'it-staff' },
    });
    await request(app.getHttpServer())
      .patch(`${path}/status`).set('Content-Type', 'application/json')
      .set('Cookie', cookies['it-staff'] || 'hub_session=invalid')
      .send({ status: 'Assigned' })
      .expect(400);
  });

  it('restricts other employees and staff to permitted requests', async () => {
    const created = await request(app.getHttpServer())
      .post('/requests')
      .set('Cookie', cookies['employee'] || 'hub_session=invalid')
      .send(body)
      .expect(201);
    const path = `/requests/${created.body.ticketNumber}`;
    await request(app.getHttpServer())
      .get(path)
      .set('Cookie', cookies['hr-staff'] || 'hub_session=invalid')
      .expect(403);
    await request(app.getHttpServer())
      .get('/requests?department=it')
      .set('Cookie', cookies['employee'] || 'hub_session=invalid')
      .expect(403);
    await request(app.getHttpServer())
      .patch(`${path}/status`).set('Content-Type', 'application/json')
      .set('Cookie', cookies['employee'] || 'hub_session=invalid')
      .send({ status: 'Assigned' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`${path}/claim`)
      .send({})
      .set('Cookie', cookies['hr-staff'] || 'hub_session=invalid')
      .expect(403);
    await request(app.getHttpServer())
      .patch(`${path}/status`).set('Content-Type', 'application/json')
      .set('Cookie', cookies['hr-staff'] || 'hub_session=invalid')
      .send({ status: 'Assigned' })
      .expect(403);
    const own = await request(app.getHttpServer())
      .get('/requests')
      .set('Cookie', cookies['hr-staff'] || 'hub_session=invalid')
      .expect(200);
    expect(
      own.body.every(
        (item: { employee: { id: string } }) => item.employee.id === 'hr-staff',
      ),
    ).toBe(true);
  });

  it('lets receiving staff process the request and preserves its description after reconnecting', async () => {
    const created = await request(app.getHttpServer())
      .post('/requests')
      .set('Cookie', cookies['employee'] || 'hub_session=invalid')
      .send(body)
      .expect(201);
    const path = `/requests/${created.body.ticketNumber}`;
    await request(app.getHttpServer())
      .patch(`${path}/status`).set('Content-Type', 'application/json')
      .set('Cookie', cookies['it-staff'] || 'hub_session=invalid')
      .send({ status: 'Completed' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`${path}/claim`)
      .set('Cookie', cookies['it-staff'] || 'hub_session=invalid')
      .send({})
      .expect(201);
    for (const status of ['In Progress', 'Completed']) {
      await request(app.getHttpServer())
        .patch(`${path}/status`).set('Content-Type', 'application/json')
        .set('Cookie', cookies['it-staff'] || 'hub_session=invalid')
        .send({
          status,
          note:
            status === 'Completed'
              ? 'Replaced the faulty charger and tested startup.'
              : 'Checking the charger.',
        })
        .expect(200);
    }
    await prisma.$disconnect();
    await prisma.$connect();
    const saved = await request(app.getHttpServer())
      .get(path)
      .set('Cookie', cookies['employee'] || 'hub_session=invalid')
      .expect(200);
    expect(saved.body.description).toBe(body.description);
    expect(saved.body.status).toBe('Completed');
    const notifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('Cookie', cookies['employee'] || 'hub_session=invalid')
      .expect(200);
    expect(notifications.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ticketNumber: created.body.ticketNumber,
          readAt: null,
        }),
      ]),
    );
    const notificationPath = `/notifications/${created.body.ticketNumber}/read`;
    await request(app.getHttpServer()).get('/notifications').expect(401);
    await request(app.getHttpServer())
      .patch(notificationPath).set('Content-Type', 'application/json')
      .set('Cookie', cookies['hr-staff'] || 'hub_session=invalid')
      .expect(404);
    const otherNotifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('Cookie', cookies['hr-staff'] || 'hub_session=invalid')
      .expect(200);
    expect(
      otherNotifications.body.some(
        (entry: { ticketNumber: string }) =>
          entry.ticketNumber === created.body.ticketNumber,
      ),
    ).toBe(false);
    await request(app.getHttpServer())
      .patch(notificationPath).set('Content-Type', 'application/json')
      .set('Cookie', cookies['employee'] || 'hub_session=invalid')
      .expect(200);
    await prisma.$disconnect();
    await prisma.$connect();
    const readNotifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('Cookie', cookies['employee'] || 'hub_session=invalid')
      .expect(200);
    expect(
      readNotifications.body.find(
        (entry: { ticketNumber: string }) =>
          entry.ticketNumber === created.body.ticketNumber,
      ).readAt,
    ).toEqual(expect.any(String));
    const unchangedRequest = await request(app.getHttpServer())
      .get(path)
      .set('Cookie', cookies['employee'] || 'hub_session=invalid')
      .expect(200);
    expect(unchangedRequest.body.updatedAt).toBe(saved.body.updatedAt);
    expect(saved.body.history).toHaveLength(4);
    expect(saved.body.history[3].changedBy.id).toBe('it-staff');
    expect(saved.body.history[3].note).toBe(
      'Replaced the faulty charger and tested startup.',
    );
    await request(app.getHttpServer())
      .patch(`${path}/status`).set('Content-Type', 'application/json')
      .set('Cookie', cookies['it-staff'] || 'hub_session=invalid')
      .send({ status: 'In Progress' })
      .expect(400);
  });
});
