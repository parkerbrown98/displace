import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from './database.constants.js';

@Injectable()
export class DatabaseLifecycleService implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
