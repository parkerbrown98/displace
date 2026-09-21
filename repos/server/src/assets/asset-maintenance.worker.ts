import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { AssetsRepository } from './assets.repository.js';
import { ObjectStorageService } from './object-storage.service.js';

@Injectable()
export class AssetMaintenanceWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(AssetMaintenanceWorker.name);
  private running?: Promise<void>;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly assets: AssetsRepository,
    private readonly storage: ObjectStorageService,
  ) {}

  onApplicationBootstrap(): void {
    this.run();
    this.timer = setInterval(() => this.run(), 60 * 60 * 1_000);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }

  private run(): void {
    if (this.running) return;
    this.running = this.cleanup()
      .catch((error: unknown) => {
        this.logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          'Upload intent cleanup failed',
        );
      })
      .finally(() => {
        this.running = undefined;
      });
  }

  private async cleanup(): Promise<void> {
    let intents = await this.assets.claimExpiredIntents(new Date());
    while (intents.length > 0) {
      for (const intent of intents) {
        await this.storage.deleteObject(intent.objectKey);
        await this.assets.markIntentCleaned(intent.id, new Date());
      }
      intents = await this.assets.claimExpiredIntents(new Date());
    }
  }
}
