import { Module } from '@nestjs/common';
import { AuthMailWorkerService } from './auth/auth-mail-worker.service.js';
import { ConfigurationModule } from './config/configuration.module.js';
import { DatabaseModule } from './database/database.module.js';
import { ForumsRepository } from './forums/forums.repository.js';
import { TopicViewCounterWorker } from './forums/topic-view-counter.worker.js';
import { WorkerLifetimeService } from './worker-lifetime.service.js';

@Module({
  imports: [ConfigurationModule, DatabaseModule],
  providers: [
    AuthMailWorkerService,
    ForumsRepository,
    TopicViewCounterWorker,
    WorkerLifetimeService,
  ],
})
export class WorkerModule {}
