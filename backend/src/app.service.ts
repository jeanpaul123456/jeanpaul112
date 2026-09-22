import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  RequestStatus as DatabaseRequestStatus,
  RequestPriority,
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
  priority: RequestPriority;
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

const databaseStatusByApiStatus: Record<RequestStatus, DatabaseRequestStatus> =
  {
    [RequestStatus.Submitted]: DatabaseRequestStatus.SUBMITTED,
    [RequestStatus.Assigned]: DatabaseRequestStatus.ASSIGNED,
    [RequestStatus.InProgress]: DatabaseRequestStatus.IN_PROGRESS,
    [RequestStatus.Completed]: DatabaseRequestStatus.COMPLETED,
    [RequestStatus.Rejected]: DatabaseRequestStatus.REJECTED,
  };

const apiStatusByDatabaseStatus: Record<DatabaseRequestStatus, RequestStatus> =
  {
    [DatabaseRequestStatus.SUBMITTED]: RequestStatus.Submitted,
    [DatabaseRequestStatus.ASSIGNED]: RequestStatus.Assigned,
    [DatabaseRequestStatus.IN_PROGRESS]: RequestStatus.InProgress,
    [DatabaseRequestStatus.COMPLETED]: RequestStatus.Completed,
    [DatabaseRequestStatus.REJECTED]: RequestStatus.Rejected,
  };

@Injectable()
export class AppService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  getDirectory() {
    return Promise.all([
      this.prisma.employee.findMany({
        select: {
          id: true,
          displayName: true,
          memberships: { select: { department: true } },
        },
        orderBy: { displayName: 'asc' },
      }),
      this.prisma.department.findMany({ orderBy: { name: 'asc' } }),
    ]).then(([employees, departments]) => ({ employees, departments }));
  }

  private async requireEmployee(employeeId: string | undefined) {
    if (!employeeId)
      throw new UnauthorizedException('Choose an employee first.');
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) throw new UnauthorizedException('Unknown employee.');
    return employee;
  }

  private async requireStaff(
    employeeId: string,
    departmentId: string,
    database: Pick<PrismaService, 'departmentMembership'> = this.prisma,
  ) {
    const membership = await database.departmentMembership.findUnique({
      where: { employeeId_departmentId: { employeeId, departmentId } },
    });
    if (!membership)
      throw new ForbiddenException(
        'Only staff in the assigned department can manage these requests.',
      );
  }

  async listRequests(employeeId: string | undefined, departmentSlug?: string) {
    const employee = await this.requireEmployee(employeeId);
    let where: { creatorId?: string; departmentId?: string } = {
      creatorId: employee.id,
    };
    if (departmentSlug) {
      const department = await this.prisma.department.findUnique({
        where: { slug: departmentSlug },
      });
      if (!department) throw new NotFoundException('Department not found.');
      await this.requireStaff(employee.id, department.id);
      where = { departmentId: department.id };
    }
    const records = await this.prisma.serviceRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return Promise.all(
      records.map((record) => this.getRequest(record.id, employee.id)),
    );
  }

  getHello(): string {
    return 'Hello World!';
  }

  async getNotifications(employeeId: string | undefined) {
    const employee = await this.requireEmployee(employeeId);
    const requests = await this.prisma.serviceRequest.findMany({
      where: {
        creatorId: employee.id,
        status: DatabaseRequestStatus.COMPLETED,
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        ticketNumber: true,
        title: true,
        completedAt: true,
        updatedAt: true,
        completionReadAt: true,
        department: { select: { name: true } },
      },
    });
    return requests.map((request) => ({
      ticketNumber: request.ticketNumber,
      title: request.title,
      message: `${request.department.name} completed your request.`,
      completedAt: (request.completedAt ?? request.updatedAt).toISOString(),
      readAt: request.completionReadAt?.toISOString() ?? null,
    }));
  }

  async readNotification(ticketNumber: string, employeeId: string | undefined) {
    const employee = await this.requireEmployee(employeeId);
    const notification = await this.prisma.serviceRequest.findFirst({
      where: {
        ticketNumber,
        creatorId: employee.id,
        status: DatabaseRequestStatus.COMPLETED,
      },
    });
    if (!notification) throw new NotFoundException('Notification not found.');
    const result = await this.prisma.serviceRequest.updateMany({
      where: {
        ticketNumber,
        creatorId: employee.id,
        status: DatabaseRequestStatus.COMPLETED,
      },
      data: {
        completionReadAt: notification.completionReadAt ?? new Date(),
        updatedAt: notification.updatedAt,
      },
    });
    if (!result.count) throw new NotFoundException('Notification not found.');
    return { ticketNumber, read: true };
  }

  async getRequest(
    requestIdentifier: string,
    employeeId: string | undefined,
  ): Promise<ServiceRequest> {
    const employee = await this.requireEmployee(employeeId);
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

    if (request.creatorId !== employee.id)
      await this.requireStaff(employee.id, request.departmentId);

    return {
      requestId: request.id,
      ticketNumber: request.ticketNumber,
      title: request.title,
      description: request.description,
      priority: request.priority,
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

  async createRequest(
    employeeId: string | undefined,
    body: {
      title?: string;
      description?: string;
      departmentSlug?: string;
      priority?: unknown;
    },
  ) {
    const employee = await this.requireEmployee(employeeId);
    const priority =
      body?.priority === undefined ? RequestPriority.Medium : body.priority;
    if (
      typeof priority !== 'string' ||
      !Object.values(RequestPriority).includes(priority as RequestPriority)
    ) {
      throw new BadRequestException('Priority must be High, Medium, or Low.');
    }
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const description =
      typeof body?.description === 'string' ? body.description.trim() : '';
    const departmentSlug =
      typeof body?.departmentSlug === 'string'
        ? body.departmentSlug.trim().toLowerCase()
        : '';
    if (!title || !description || !departmentSlug) {
      throw new BadRequestException(
        'title, description, and departmentSlug are required.',
      );
    }
    if (title.length > 160 || description.length > 5000)
      throw new BadRequestException(
        'Use at most 160 characters for the title and 5,000 for the description.',
      );
    const department = await this.prisma.department.findUnique({
      where: { slug: departmentSlug },
    });
    if (!department) throw new BadRequestException('Unknown department.');
    const request = await this.prisma.$transaction(async (transaction) => {
      const counter = await transaction.requestCounter.upsert({
        where: { id: 'requests' },
        create: { id: 'requests', value: 1001 },
        update: { value: { increment: 1 } },
      });
      const ticketNumber = `REQ-${counter.value}`;
      const created = await transaction.serviceRequest.create({
        data: {
          ticketNumber,
          title,
          description,
          priority: priority as RequestPriority,
          creatorId: employee.id,
          departmentId: department.id,
          status: DatabaseRequestStatus.SUBMITTED,
        },
      });
      await transaction.requestStatusHistory.create({
        data: {
          requestId: created.id,
          changedById: employee.id,
          toStatus: DatabaseRequestStatus.SUBMITTED,
          note: 'Request submitted.',
        },
      });
      return created;
    });
    return {
      ticketNumber: request.ticketNumber,
      status: RequestStatus.Submitted,
    };
  }

  async claimRequest(
    requestIdentifier: string,
    employeeId: string | undefined,
  ) {
    const request = await this.getRequest(requestIdentifier, employeeId);
    await this.updateRequestStatus(
      requestIdentifier,
      RequestStatus.Assigned,
      employeeId,
    );
    return {
      ticketNumber: request.ticketNumber,
      status: RequestStatus.Assigned,
    };
  }

  async updateRequestStatus(
    requestIdentifier: string,
    requestedStatus: RequestStatus,
    employeeId: string | undefined,
    requestedNote?: unknown,
  ) {
    const employee = await this.requireEmployee(employeeId);
    if (!Object.values(RequestStatus).includes(requestedStatus)) {
      throw new BadRequestException('Unknown request status');
    }
    if (requestedNote !== undefined && typeof requestedNote !== 'string')
      throw new BadRequestException('The update note must be text.');
    const note = typeof requestedNote === 'string' ? requestedNote.trim() : '';
    if (note.length > 2000)
      throw new BadRequestException(
        'Use at most 2,000 characters for the update note.',
      );
    if (requestedStatus === RequestStatus.Rejected && !note)
      throw new BadRequestException(
        'Explain why the request is being rejected so the employee knows what to do next.',
      );

    await this.prisma.$transaction(async (transaction) => {
      const request = await transaction.serviceRequest.findFirst({
        where: {
          OR: [{ id: requestIdentifier }, { ticketNumber: requestIdentifier }],
        },
      });

      if (!request) {
        throw new NotFoundException(
          `Request ${requestIdentifier} was not found`,
        );
      }

      await this.requireStaff(employee.id, request.departmentId, transaction);

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
          changedById: employee.id,
          note: note || null,
        },
      });
    });

    return { requestId: requestIdentifier, status: requestedStatus };
  }
}
