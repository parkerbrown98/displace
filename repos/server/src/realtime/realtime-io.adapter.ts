import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';
import type { AppEnvironment } from '../config/environment.js';

export class RealtimeIoAdapter extends IoAdapter {
  private readonly clients: Redis[] = [];

  constructor(
    application: INestApplicationContext,
    private readonly config: ConfigService<AppEnvironment, true>,
  ) {
    super(application);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, {
      path: options?.path ?? '/socket.io',
      serveClient: options?.serveClient ?? false,
      cors: {
        credentials: true,
        origin: this.config.get('CORS_ORIGINS', { infer: true }),
      },
    } as ServerOptions);
    const publisher = new Redis(this.config.get('REDIS_URL', { infer: true }));
    const subscriber = publisher.duplicate();
    this.clients.push(publisher, subscriber);
    server.adapter(createAdapter(publisher, subscriber));
    return server;
  }

  override async close(server: Server): Promise<void> {
    await super.close(server);
    await Promise.all(this.clients.splice(0).map((client) => client.quit()));
  }
}