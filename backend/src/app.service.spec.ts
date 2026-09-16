import { AppService, RequestStatus } from './app.service.js';
import { PrismaService } from './database/prisma.service.js';
import { RequestStatus as DatabaseStatus } from './generated/prisma/client.js';

describe('Request lifecycle business rule', () => {
  function fixture(status: DatabaseStatus) {
    const transaction = {
      serviceRequest: {
        findFirst: vi.fn(async () => ({
          id: 'request-1',
          departmentId: 'IT',
          status,
        })),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      departmentMembership: {
        findUnique: vi.fn(async () => ({
          employeeId: 'staff',
          departmentId: 'IT',
        })),
      },
      requestStatusHistory: { create: vi.fn(async () => ({})) },
    };
    const database = {
      employee: { findUnique: vi.fn(async () => ({ id: 'staff' })) },
      $transaction: async (
        callback: (value: typeof transaction) => Promise<unknown>,
      ) => callback(transaction),
    };
    return {
      service: new AppService(database as unknown as PrismaService),
      transaction,
    };
  }
  it('rejects Submitted → Completed without writing a status or history entry', async () => {
    const { service, transaction } = fixture(DatabaseStatus.SUBMITTED);
    await expect(
      service.updateRequestStatus(
        'request-1',
        RequestStatus.Completed,
        'staff',
      ),
    ).rejects.toThrow('Cannot change request from Submitted to Completed');
    expect(transaction.serviceRequest.updateMany).not.toHaveBeenCalled();
    expect(transaction.requestStatusHistory.create).not.toHaveBeenCalled();
  });
  it('accepts In Progress → Completed and records the actor and resolution', async () => {
    const { service, transaction } = fixture(DatabaseStatus.IN_PROGRESS);
    await service.updateRequestStatus(
      'request-1',
      RequestStatus.Completed,
      'staff',
      'Replaced the charger.',
    );
    expect(transaction.serviceRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DatabaseStatus.COMPLETED,
          completedAt: expect.any(Date),
        }),
      }),
    );
    expect(transaction.requestStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        changedById: 'staff',
        note: 'Replaced the charger.',
        toStatus: DatabaseStatus.COMPLETED,
      }),
    });
  });
});
