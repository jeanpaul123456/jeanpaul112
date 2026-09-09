import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

export enum RequestStatus {
  Submitted = 'Submitted',
  Assigned = 'Assigned',
  InProgress = 'In Progress',
  Completed = 'Completed',
  Rejected = 'Rejected',
}

const allowedTransitions: Record<RequestStatus, RequestStatus[]> = {
  [RequestStatus.Submitted]: [RequestStatus.Assigned, RequestStatus.Rejected],
  [RequestStatus.Assigned]: [RequestStatus.InProgress, RequestStatus.Rejected],
  [RequestStatus.InProgress]: [RequestStatus.Completed, RequestStatus.Rejected],
  [RequestStatus.Completed]: [],
  [RequestStatus.Rejected]: [],
};

@Injectable()
export class AppService {
  private readonly requests = new Map<string, RequestStatus>([
    ['1', RequestStatus.Submitted],
  ]);

  getHello(): string {
    return 'Hello World!';
  }

  updateRequestStatus(requestId: string, requestedStatus: RequestStatus) {
    const currentStatus = this.requests.get(requestId);

    if (!currentStatus) {
      throw new NotFoundException(`Request ${requestId} was not found`);
    }

    if (!Object.values(RequestStatus).includes(requestedStatus)) {
      throw new BadRequestException('Unknown request status');
    }

    if (!allowedTransitions[currentStatus].includes(requestedStatus)) {
      throw new BadRequestException(
        `Cannot change request from ${currentStatus} to ${requestedStatus}`,
      );
    }

    this.requests.set(requestId, requestedStatus);

    return { requestId, status: requestedStatus };
  }
}
