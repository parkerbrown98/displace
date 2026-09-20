import { Module } from '@nestjs/common';
import { AuthMailWorkerService } from './auth/auth-mail-worker.service.js';
import { ConfigurationModule } from './config/configuration.module.js';
import { DatabaseModule } from './database/database.module.js';
import { WorkerLifetimeService } from './worker-lifetime.service.js';

@Module({
  imports: [ConfigurationModule, DatabaseModule],
  providers: [AuthMailWorkerService, WorkerLifetimeService],
})
export class WorkerModule {}
