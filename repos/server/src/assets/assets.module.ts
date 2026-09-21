import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PlacesModule } from '../places/places.module.js';
import { AssetsController } from './assets.controller.js';
import {
  ASSETS_REPOSITORY,
  MEDIA_QUEUE,
  OBJECT_STORAGE,
} from './assets.constants.js';
import { AssetsRepository } from './assets.repository.js';
import { AssetsService } from './assets.service.js';
import { MediaQueueService } from './media-queue.service.js';
import { ObjectStorageService } from './object-storage.service.js';

@Module({
  imports: [AuthModule, PlacesModule],
  controllers: [AssetsController],
  providers: [
    AssetsRepository,
    AssetsService,
    MediaQueueService,
    ObjectStorageService,
    { provide: ASSETS_REPOSITORY, useExisting: AssetsRepository },
    { provide: MEDIA_QUEUE, useExisting: MediaQueueService },
    { provide: OBJECT_STORAGE, useExisting: ObjectStorageService },
  ],
  exports: [AssetsRepository],
})
export class AssetsModule {}
