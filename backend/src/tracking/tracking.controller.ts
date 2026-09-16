import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { TrackingService } from './tracking.service.js';

@Controller('api/tracking')
export class TrackingController {
  constructor(
    @Inject(TrackingService) private readonly trackingService: TrackingService,
  ) {}

  @Get(':orderId')
  getTracking(@Param('orderId') orderId: string) {
    const tracking = this.trackingService.getTracking(orderId);

    if (!tracking) {
      throw new NotFoundException(
        `We have no tracking information for order "${orderId}".`,
      );
    }

    return tracking;
  }
}
