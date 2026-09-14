import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import {
  RequestStatus as DatabaseRequestStatus,
} from './generated/prisma/client.js';
import { PrismaService } from './database/prisma.service.js';

export enum RequestStatus {
  Submitted = 'Submitted',
  Assigned = 'Assigned',
  InProgress = 'In Progress',
  Completed = 'Completed',
  Rejected = 'Rejected',
}

export interface RequestHistoryEntry {
  status: RequestStatus;
  occurredAt: string;
  note: string | null;
  changedBy: {
    id: string;
    displayName: string;
  } | null;
}

export interface ServiceRequest {
  requestId: string;
  ticketNumber: string;
  title: string;
  description: string;
  employee: {
    id: string;
    displayName: string;
    email: string;
  };
  department: {
    id: string;
    name: string;
    slug: string;
  };
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  history: RequestHistoryEntry[];
}

const allowedTransitions: Record<RequestStatus, RequestStatus[]> = {
  [RequestStatus.Submitted]: [RequestStatus.Assigned, RequestStatus.Rejected],
  [RequestStatus.Assigned]: [RequestStatus.InProgress, RequestStatus.Rejected],
  [RequestStatus.InProgress]: [RequestStatus.Completed, RequestStatus.Rejected],
  [RequestStatus.Completed]: [],
  [RequestStatus.Rejected]: [],
};

const databaseStatusByApiStatus: Record<RequestStatus, DatabaseRequestStatus> = {
  [RequestStatus.Submitted]: DatabaseRequestStatus.SUBMITTED,
  [RequestStatus.Assigned]: DatabaseRequestStatus.ASSIGNED,
  [RequestStatus.InProgress]: DatabaseRequestStatus.IN_PROGRESS,
  [RequestStatus.Completed]: DatabaseRequestStatus.COMPLETED,
  [RequestStatus.Rejected]: DatabaseRequestStatus.REJECTED,
};

const apiStatusByDatabaseStatus: Record<DatabaseRequestStatus, RequestStatus> = {
  [DatabaseRequestStatus.SUBMITTED]: RequestStatus.Submitted,
  [DatabaseRequestStatus.ASSIGNED]: RequestStatus.Assigned,
  [DatabaseRequestStatus.IN_PROGRESS]: RequestStatus.InProgress,
  [DatabaseRequestStatus.COMPLETED]: RequestStatus.Completed,
  [DatabaseRequestStatus.REJECTED]: RequestStatus.Rejected,
};

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getRequest(requestIdentifier: string): Promise<ServiceRequest> {
    const request = await this.prisma.serviceRequest.findFirst({
      where: {
        OR: [{ id: requestIdentifier }, { ticketNumber: requestIdentifier }],
      },
      include: {
        creator: true,
        department: true,
        history: {
          orderBy: { occurredAt: 'asc' },
          include: { changedBy: true },
        },
      },
    });

    if (!request) {
      throw new NotFoundException(`Request ${requestIdentifier} was not found`);
    }

    return {
      requestId: request.id,
      ticketNumber: request.ticketNumber,
      title: request.title,
      description: request.description,
      employee: {
        id: request.creator.id,
        displayName: request.creator.displayName,
        email: request.creator.email,
      },
      department: {
        id: request.department.id,
        name: request.department.name,
        slug: request.department.slug,
      },
      status: apiStatusByDatabaseStatus[request.status],
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      history: request.history.map((entry) => ({
        status: apiStatusByDatabaseStatus[entry.toStatus],
        occurredAt: entry.occurredAt.toISOString(),
        note: entry.note,
        changedBy: entry.changedBy
          ? { id: entry.changedBy.id, displayName: entry.changedBy.displayName }
          : null,
      })),
    };
  }

  async createRequest(employeeId: string | undefined, body: { title?: string; description?: string; departmentSlug?: string }) {
    if (!employeeId) throw new UnauthorizedException('Choose an employee before submitting a request.');
    const title = body.title?.trim();
    const description = body.description?.trim();
    const departmentSlug = body.departmentSlug?.trim().toLowerCase();
    if (!title || !description || !departmentSlug) {
      throw new BadRequestException('title, description, and departmentSlug are required.');
    }
    const [employee, department, count] = await Promise.all([
      this.prisma.employee.findUnique({ where: { id: employeeId } }),
      this.prisma.department.findUnique({ where: { slug: departmentSlug } }),
      this.prisma.serviceRequest.count(),
    ]);
    if (!employee) throw new UnauthorizedException('Unknown employee.');
    if (!department) throw new BadRequestException('Unknown department.');
    const ticketNumber = `REQ-${1001 + count}`;
    const request = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.serviceRequest.create({
        data: { ticketNumber, title, description, creatorId: employee.id, departmentId: department.id },
      });
      await transaction.requestStatusHistory.create({ data: { requestId: created.id, changedById: employee.id, toStatus: DatabaseRequestStatus.SUBMITTED, note: 'Request submitted.' } });
      return created;
    });
    return { ticketNumber: request.ticketNumber, status: RequestStatus.Submitted };
  }

  async claimRequest(requestIdentifier: string, employeeId: string | undefined) {
    if (!employeeId) throw new UnauthorizedException('Employee identity is required.');
    const request = await this.prisma.serviceRequest.findFirst({ where: { OR: [{ id: requestIdentifier }, { ticketNumber: requestIdentifier }] } });
    if (!request) throw new NotFoundException(`Request ${requestIdentifier} was not found`);
    const membership = await this.prisma.departmentMembership.findUnique({ where: { employeeId_departmentId: { employeeId, departmentId: request.departmentId } } });
    if (!membership) throw new ForbiddenException('Only staff in the assigned department can claim this request.');
    if (request.status !== DatabaseRequestStatus.SUBMITTED) throw new BadRequestException('Only submitted requests can be claimed.');
    await this.prisma.$transaction(async (transaction) => {
      await transaction.serviceRequest.update({ where: { id: request.id }, data: { status: DatabaseRequestStatus.ASSIGNED } });
      await transaction.requestStatusHistory.create({ data: { requestId: request.id, changedById: employeeId, fromStatus: DatabaseRequestStatus.SUBMITTED, toStatus: DatabaseRequestStatus.ASSIGNED, note: 'Claimed by department staff.' } });
    });
    return { ticketNumber: request.ticketNumber, status: RequestStatus.Assigned };
  }

  async updateRequestStatus(requestIdentifier: string, requestedStatus: RequestStatus) {
    if (!Object.values(RequestStatus).includes(requestedStatus)) {
      throw new BadRequestException('Unknown request status');
    }

    await this.prisma.$transaction(async (transaction) => {
      const request = await transaction.serviceRequest.findFirst({
        where: {
          OR: [{ id: requestIdentifier }, { ticketNumber: requestIdentifier }],
        },
      });

      if (!request) {
        throw new NotFoundException(`Request ${requestIdentifier} was not found`);
      }

      const currentStatus = apiStatusByDatabaseStatus[request.status];
      if (!allowedTransitions[currentStatus].includes(requestedStatus)) {
        throw new BadRequestException(
          `Cannot change request from ${currentStatus} to ${requestedStatus}`,
        );
      }

      const nextStatus = databaseStatusByApiStatus[requestedStatus];
      const update = await transaction.serviceRequest.updateMany({
        where: { id: request.id, status: request.status },
        data: {
          status: nextStatus,
          completedAt:
            nextStatus === DatabaseRequestStatus.COMPLETED ? new Date() : null,
        },
      });

      if (update.count !== 1) {
        throw new BadRequestException(
          'Request status changed concurrently; retry the operation.',
        );
      }

      await transaction.requestStatusHistory.create({
        data: {
          requestId: request.id,
          fromStatus: request.status,
          toStatus: nextStatus,
        },
      });
    });

    return { requestId: requestIdentifier, status: requestedStatus };
  }
}
