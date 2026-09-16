import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AppService, RequestStatus } from './app.service.js';

@Controller()
export class AppController {
  constructor(@Inject(AppService) private readonly appService: AppService) {}

  @Get('directory')
  getDirectory() {
    return this.appService.getDirectory();
  }

  @Get('notifications')
  getNotifications(@Headers('x-employee-id') employeeId: string | undefined) {
    return this.appService.getNotifications(employeeId);
  }

  @Patch('notifications/:ticketNumber/read')
  readNotification(
    @Param('ticketNumber') ticketNumber: string,
    @Headers('x-employee-id') employeeId: string | undefined,
  ) {
    return this.appService.readNotification(ticketNumber, employeeId);
  }

  @Get('requests')
  listRequests(
    @Headers('x-employee-id') employeeId: string | undefined,
    @Query('department') department?: string,
  ) {
    return this.appService.listRequests(employeeId, department);
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('requests/:id')
  getRequest(
    @Param('id') requestId: string,
    @Headers('x-employee-id') employeeId: string | undefined,
  ) {
    return this.appService.getRequest(requestId, employeeId);
  }

  @Patch('requests/:id/status')
  updateRequestStatus(
    @Param('id') requestId: string,
    @Body('status') requestedStatus: RequestStatus,
    @Headers('x-employee-id') employeeId: string | undefined,
    @Body('note') note?: unknown,
  ) {
    return this.appService.updateRequestStatus(
      requestId,
      requestedStatus,
      employeeId,
      note,
    );
  }

  @Post('requests')
  createRequest(
    @Headers('x-employee-id') employeeId: string | undefined,
    @Body()
    body: {
      title?: string;
      description?: string;
      departmentSlug?: string;
      priority?: unknown;
    },
  ) {
    return this.appService.createRequest(employeeId, body);
  }

  @Post('requests/:id/claim')
  claimRequest(
    @Param('id') requestId: string,
    @Headers('x-employee-id') employeeId: string | undefined,
  ) {
    return this.appService.claimRequest(requestId, employeeId);
  }
}
