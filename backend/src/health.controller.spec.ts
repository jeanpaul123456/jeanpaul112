import { HealthController } from './health.controller.js';
import { PrismaService } from './database/prisma.service.js';

it('readiness fails safely when the database fails, then recovers', async () => {
  const count = vi.fn().mockRejectedValueOnce(new Error('private connection details')).mockResolvedValueOnce(3);
  const controller = new HealthController({ department: { count } } as unknown as PrismaService);
  expect(controller.live().status).toBe('ok');
  await expect(controller.ready()).rejects.toThrow('Database is unavailable.');
  await expect(controller.ready()).resolves.toMatchObject({ status: 'ok', database: 'ok' });
});
