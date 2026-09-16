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
    for (const id of identities)
      await prisma.employee.create({
        data: { id, displayName: id, email: `${id}@example.com` },
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
      .set('x-employee-id', id)
      .send({ ...body, departmentSlug: department })
      .expect(201);
    const ticket = created.body.ticketNumber;
    const personal = await request(app.getHttpServer())
      .get('/requests')
      .set('x-employee-id', id)
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
      .set('x-employee-id', `${department}-staff`)
      .expect(200);
    expect(
      inbox.body.some(
        (item: { ticketNumber: string }) => item.ticketNumber === ticket,
      ),
    ).toBe(true);
    const otherDepartment = departments.find((item) => item !== department)!;
    const otherInbox = await request(app.getHttpServer())
      .get(`/requests?department=${otherDepartment}`)
      .set('x-employee-id', `${otherDepartment}-staff`)
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
      .set('x-employee-id', 'employee')
      .send(invalid)
      .expect(400);
    expect(await prisma.serviceRequest.count()).toBe(before);
  });

  it('requires a known employee', async () => {
    await request(app.getHttpServer()).post('/requests').send(body).expect(401);
    await request(app.getHttpServer())
      .post('/requests')
      .set('x-employee-id', 'unknown')
      .send(body)
      .expect(401);
    await request(app.getHttpServer()).get('/requests').expect(401);
  });

  it.each(['High', 'Medium', 'Low'])(
    'saves %s priority in personal and department views after reconnecting',
    async (priority) => {
      const created = await request(app.getHttpServer())
        .post('/requests')
        .set('x-employee-id', 'employee')
        .send({ ...body, priority })
        .expect(201);
      await prisma.$disconnect();
      await prisma.$connect();
      const detail = await request(app.getHttpServer())
        .get(`/requests/${created.body.ticketNumber}`)
        .set('x-employee-id', 'employee')
        .expect(200);
      expect(detail.body.priority).toBe(priority);
      for (const [url, id] of [
        ['/requests', 'employee'],
        ['/requests?department=it', 'it-staff'],
      ]) {
        const list = await request(app.getHttpServer())
          .get(url)
          .set('x-employee-id', id)
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
      .set('x-employee-id', 'employee')
      .send(body)
      .expect(201);
    const path = `/requests/${created.body.ticketNumber}`;
    for (const note of ['', '  ', 123, 'x'.repeat(2001)]) {
      await request(app.getHttpServer())
        .patch(`${path}/status`)
        .set('x-employee-id', 'it-staff')
        .send({ status: 'Rejected', note })
        .expect(400);
    }
    const unchanged = await request(app.getHttpServer())
      .get(path)
      .set('x-employee-id', 'employee')
      .expect(200);
    expect(unchanged.body.status).toBe('Submitted');
    expect(unchanged.body.history).toHaveLength(1);
    const note = 'Please send the asset number so we can identify your laptop.';
    await request(app.getHttpServer())
      .patch(`${path}/status`)
      .set('x-employee-id', 'it-staff')
      .send({ status: 'Rejected', note })
      .expect(200);
    const updated = await request(app.getHttpServer())
      .get(path)
      .set('x-employee-id', 'employee')
      .expect(200);
    expect(updated.body.status).toBe('Rejected');
    expect(updated.body.history[1]).toMatchObject({
      status: 'Rejected',
      note,
      changedBy: { id: 'it-staff' },
    });
    await request(app.getHttpServer())
      .patch(`${path}/status`)
      .set('x-employee-id', 'it-staff')
      .send({ status: 'Assigned' })
      .expect(400);
  });

  it('restricts other employees and staff to permitted requests', async () => {
    const created = await request(app.getHttpServer())
      .post('/requests')
      .set('x-employee-id', 'employee')
      .send(body)
      .expect(201);
    const path = `/requests/${created.body.ticketNumber}`;
    await request(app.getHttpServer())
      .get(path)
      .set('x-employee-id', 'hr-staff')
      .expect(403);
    await request(app.getHttpServer())
      .get('/requests?department=it')
      .set('x-employee-id', 'employee')
      .expect(403);
    await request(app.getHttpServer())
      .patch(`${path}/status`)
      .set('x-employee-id', 'employee')
      .send({ status: 'Assigned' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`${path}/claim`)
      .set('x-employee-id', 'hr-staff')
      .expect(403);
    await request(app.getHttpServer())
      .patch(`${path}/status`)
      .set('x-employee-id', 'hr-staff')
      .send({ status: 'Assigned' })
      .expect(403);
    const own = await request(app.getHttpServer())
      .get('/requests')
      .set('x-employee-id', 'hr-staff')
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
      .set('x-employee-id', 'employee')
      .send(body)
      .expect(201);
    const path = `/requests/${created.body.ticketNumber}`;
    await request(app.getHttpServer())
      .patch(`${path}/status`)
      .set('x-employee-id', 'it-staff')
      .send({ status: 'Completed' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`${path}/claim`)
      .set('x-employee-id', 'it-staff')
      .expect(201);
    for (const status of ['In Progress', 'Completed']) {
      await request(app.getHttpServer())
        .patch(`${path}/status`)
        .set('x-employee-id', 'it-staff')
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
      .set('x-employee-id', 'employee')
      .expect(200);
    expect(saved.body.description).toBe(body.description);
    expect(saved.body.status).toBe('Completed');
    const notifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('x-employee-id', 'employee')
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
      .patch(notificationPath)
      .set('x-employee-id', 'hr-staff')
      .expect(404);
    const otherNotifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('x-employee-id', 'hr-staff')
      .expect(200);
    expect(
      otherNotifications.body.some(
        (entry: { ticketNumber: string }) =>
          entry.ticketNumber === created.body.ticketNumber,
      ),
    ).toBe(false);
    await request(app.getHttpServer())
      .patch(notificationPath)
      .set('x-employee-id', 'employee')
      .expect(200);
    await prisma.$disconnect();
    await prisma.$connect();
    const readNotifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('x-employee-id', 'employee')
      .expect(200);
    expect(
      readNotifications.body.find(
        (entry: { ticketNumber: string }) =>
          entry.ticketNumber === created.body.ticketNumber,
      ).readAt,
    ).toEqual(expect.any(String));
    const unchangedRequest = await request(app.getHttpServer())
      .get(path)
      .set('x-employee-id', 'employee')
      .expect(200);
    expect(unchangedRequest.body.updatedAt).toBe(saved.body.updatedAt);
    expect(saved.body.history).toHaveLength(4);
    expect(saved.body.history[3].changedBy.id).toBe('it-staff');
    expect(saved.body.history[3].note).toBe(
      'Replaced the faulty charger and tested startup.',
    );
    await request(app.getHttpServer())
      .patch(`${path}/status`)
      .set('x-employee-id', 'it-staff')
      .send({ status: 'In Progress' })
      .expect(400);
  });
});
