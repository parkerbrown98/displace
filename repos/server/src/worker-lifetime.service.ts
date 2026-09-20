import {
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

@Injectable()
export class WorkerLifetimeService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private keepAliveTimer?: NodeJS.Timeout;

  onApplicationBootstrap(): void {
    this.keepAliveTimer ??= setInterval(() => undefined, 60_000);
  }

  onApplicationShutdown(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = undefined;
    }
  }
}
