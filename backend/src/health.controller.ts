import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './database/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  @Get()
  live() {
    return { status: 'ok', release: process.env.RENDER_GIT_COMMIT ?? process.env.RELEASE_SHA ?? 'development' };
  }

  @Get('ready')
  async ready() {
    try {
      // Query a product table to detect missing schema as well as connectivity.
      await this.db.department.count();
      return { ...this.live(), database: 'ok', reviewMode: process.env.REQUEST_REVIEW_MODE ?? 'local' };
    } catch {
      throw new ServiceUnavailableException('Database is unavailable.');
    }
  }
}
