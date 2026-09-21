import { Module } from '@nestjs/common';
import { AssetMaintenanceWorker } from './assets/asset-maintenance.worker.js';
import { AssetsRepository } from './assets/assets.repository.js';
import { MalwareScannerService } from './assets/malware-scanner.service.js';
import { MediaProcessorService } from './assets/media-processor.service.js';
import { MediaWorkerService } from './assets/media-worker.service.js';
import { ObjectStorageService } from './assets/object-storage.service.js';
import { AuthMailWorkerService } from './auth/auth-mail-worker.service.js';
import { ConfigurationModule } from './config/configuration.module.js';
import { DatabaseModule } from './database/database.module.js';
import { ForumsRepository } from './forums/forums.repository.js';
import { TopicViewCounterWorker } from './forums/topic-view-counter.worker.js';
import { SearchIndexWorker } from './search/search-index.worker.js';
import { SearchService } from './search/search.service.js';
import { WorkerLifetimeService } from './worker-lifetime.service.js';

@Module({
  imports: [ConfigurationModule, DatabaseModule],
  providers: [
    AssetMaintenanceWorker,
    AssetsRepository,
    AuthMailWorkerService,
    MalwareScannerService,
    MediaProcessorService,
    MediaWorkerService,
    ObjectStorageService,
    ForumsRepository,
    SearchIndexWorker,
    SearchService,
    TopicViewCounterWorker,
    WorkerLifetimeService,
  ],
})
export class WorkerModule {}
