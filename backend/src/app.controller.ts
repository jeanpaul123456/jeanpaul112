import { Body, Controller, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { AppService, RequestStatus } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('requests/:id')
  getRequest(@Param('id') requestId: string) {
    return this.appService.getRequest(requestId);
  }

  @Patch('requests/:id/status')
  updateRequestStatus(
    @Param('id') requestId: string,
    @Body('status') requestedStatus: RequestStatus,
  ) {
    return this.appService.updateRequestStatus(requestId, requestedStatus);
  }

  @Post('requests')
  createRequest(
    @Headers('x-employee-id') employeeId: string | undefined,
    @Body() body: { title?: string; description?: string; departmentSlug?: string },
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
