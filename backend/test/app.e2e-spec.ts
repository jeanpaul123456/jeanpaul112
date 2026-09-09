import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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
      .send({ status: 'Assigned' })
      .expect(200)
      .expect({ requestId: '1', status: 'Assigned' });
  });

  it('rejects an invalid Week 1 status transition', () => {
    return request(app.getHttpServer())
      .patch('/requests/1/status')
      .send({ status: 'Completed' })
      .expect(400);
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
