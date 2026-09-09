import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { AppService, RequestStatus } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Patch('requests/:id/status')
  updateRequestStatus(
    @Param('id') requestId: string,
    @Body('status') requestedStatus: RequestStatus,
  ) {
    return this.appService.updateRequestStatus(requestId, requestedStatus);
  }
}
