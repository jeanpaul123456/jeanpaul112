import { AiController } from './ai.controller.js';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { TrackingModule } from './tracking/tracking.module.js';

@Module({
  imports: [DatabaseModule, TrackingModule],
  controllers: [AppController, AiController],
  providers: [AppService],
})
export class AppModule {}
