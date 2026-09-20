import { Module } from '@nestjs/common';
import { ConfigurationModule } from './config/configuration.module.js';
import { DatabaseModule } from './database/database.module.js';
import { WorkerLifetimeService } from './worker-lifetime.service.js';

@Module({
  imports: [ConfigurationModule, DatabaseModule],
  providers: [WorkerLifetimeService],
})
export class WorkerModule {}
