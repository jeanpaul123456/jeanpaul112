import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/database/prisma.service.js';
import { RequestStatus } from './../src/generated/prisma/client.js';

function createTestDatabase() {
  const requests = new Map([
    [
      '1',
      {
        id: '1',
        ticketNumber: 'REQ-1001',
        title: 'Laptop does not start',
        description:
          'The laptop screen remains black when I press the power button.',
        creatorId: 'employee-1',
        departmentId: 'IT',
        status: RequestStatus.SUBMITTED as RequestStatus,
        createdAt: new Date('2026-09-01T09:00:00.000Z'),
        updatedAt: new Date('2026-09-01T09:00:00.000Z'),
        completedAt: null as Date | null,
        creator: {
          id: 'employee-1',
          displayName: 'Jean-Paul Chouaifaty',
          email: 'jeanpaul.chouaifaty@gmail.com',
        },
        department: {
          id: 'IT',
          name: 'Information Technology',
          slug: 'it',
        },
        history: [
          {
            toStatus: RequestStatus.SUBMITTED as RequestStatus,
            occurredAt: new Date('2026-09-01T09:00:00.000Z'),
            note: null,
            changedBy: null,
          },
        ],
      },
    ],
  ]);

  const database = {
    employee: { findUnique: async () => ({ id: 'employee-1' }) },
    departmentMembership: {
      findUnique: async () => ({
        employeeId: 'employee-1',
        departmentId: 'IT',
      }),
    },
    serviceRequest: {
      findFirst: async ({
        where,
      }: {
        where: { OR: Array<{ id?: string; ticketNumber?: string }> };
      }) => {
        const identifier = where.OR[0].id ?? where.OR[1].ticketNumber;
        return (
          [...requests.values()].find(
            (request) =>
              request.id === identifier || request.ticketNumber === identifier,
          ) ?? null
        );
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; status: RequestStatus };
        data: { status: RequestStatus; completedAt: Date | null };
      }) => {
        const record = requests.get(where.id);
        if (!record || record.status !== where.status) return { count: 0 };

        record.status = data.status;
        record.completedAt = data.completedAt;
        record.updatedAt = new Date();
        return { count: 1 };
      },
    },
    requestStatusHistory: {
      create: async ({
        data,
      }: {
        data: {
          requestId: string;
          fromStatus: RequestStatus;
          toStatus: RequestStatus;
        };
      }) => {
        const record = requests.get(data.requestId);
        if (!record) throw new Error('Request not found');

        record.history.push({
          toStatus: data.toStatus,
          occurredAt: new Date(),
          note: null,
          changedBy: null,
        });
      },
    },
    $transaction: async (
      callback: (transaction: PrismaService) => Promise<unknown>,
    ) => callback(database as unknown as PrismaService),
  };

  return database as unknown as PrismaService;
}

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createTestDatabase())
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('accepts a valid Week 1 status transition', () => {
    return request(app.getHttpServer())
      .patch('/requests/1/status')
      .set('x-employee-id', 'employee-1')
      .send({ status: 'Assigned' })
      .expect(200)
      .expect({ requestId: '1', status: 'Assigned' });
  });

  it('accepts the complete valid request lifecycle', async () => {
    await request(app.getHttpServer())
      .patch('/requests/1/status')
      .set('x-employee-id', 'employee-1')
      .send({ status: 'Assigned' })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/requests/1/status')
      .set('x-employee-id', 'employee-1')
      .send({ status: 'In Progress' })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/requests/1/status')
      .set('x-employee-id', 'employee-1')
      .send({ status: 'Completed' })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/requests/1')
      .set('x-employee-id', 'employee-1')
      .expect(200);

    expect(response.body).toMatchObject({
      requestId: '1',
      ticketNumber: 'REQ-1001',
      employee: { id: 'employee-1', displayName: 'Jean-Paul Chouaifaty' },
      department: { id: 'IT', name: 'Information Technology' },
      status: 'Completed',
    });
    expect(response.body.history).toHaveLength(4);
  });

  it('rejects an invalid Week 1 status transition without changing the request', async () => {
    await request(app.getHttpServer())
      .patch('/requests/1/status')
      .set('x-employee-id', 'employee-1')
      .send({ status: 'Completed' })
      .expect(400);

    await request(app.getHttpServer())
      .get('/requests/1')
      .set('x-employee-id', 'employee-1')
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('Submitted');
        expect(response.body.history).toHaveLength(1);
      });
  });

  it('rejects moving a completed request back to in progress', async () => {
    await request(app.getHttpServer())
      .patch('/requests/1/status')
      .set('x-employee-id', 'employee-1')
      .send({ status: 'Assigned' })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/requests/1/status')
      .set('x-employee-id', 'employee-1')
      .send({ status: 'In Progress' })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/requests/1/status')
      .set('x-employee-id', 'employee-1')
      .send({ status: 'Completed' })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/requests/1/status')
      .set('x-employee-id', 'employee-1')
      .send({ status: 'In Progress' })
      .expect(400);

    await request(app.getHttpServer())
      .get('/requests/1')
      .set('x-employee-id', 'employee-1')
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('Completed');
        expect(response.body.history).toHaveLength(4);
      });
  });

  it('returns tracking information for a known order', () => {
    return request(app.getHttpServer())
      .get('/api/tracking/ord-1001')
      .expect(200)
      .expect({
        orderId: 'ORD-1001',
        customerName: 'Nadia Haddad',
        currentStatus: 'OUT_FOR_DELIVERY',
        lastUpdated: '2026-08-31T10:42:00',
        history: [
          { status: 'CREATED', occurredAt: '2026-08-29T09:05:00' },
          { status: 'IN_TRANSIT', occurredAt: '2026-08-30T14:20:00' },
          { status: 'OUT_FOR_DELIVERY', occurredAt: '2026-08-31T10:42:00' },
        ],
      });
  });

  it('returns 404 for an unknown tracking order', () => {
    return request(app.getHttpServer())
      .get('/api/tracking/ORD-9999')
      .expect(404);
  });

  afterEach(async () => {
    await app.close();
  });
});
