import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import type { AppEnvironment } from '../config/environment.js';
import { DATABASE, PG_POOL } from './database.constants.js';
import { DatabaseLifecycleService } from './database-lifecycle.service.js';
import { PlaceMemberRepository } from './repositories/place-member.repository.js';
import * as schema from './schema/index.js';

const { Pool } = pg;

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnvironment, true>) =>
        new Pool({
          application_name: 'displace-api',
          connectionString: config.get('DATABASE_URL', { infer: true }),
          connectionTimeoutMillis: config.get(
            'DATABASE_CONNECTION_TIMEOUT_MS',
            {
              infer: true,
            },
          ),
          idleTimeoutMillis: config.get('DATABASE_IDLE_TIMEOUT_MS', {
            infer: true,
          }),
          max: config.get('DATABASE_POOL_MAX', { infer: true }),
          statement_timeout: config.get('DATABASE_STATEMENT_TIMEOUT_MS', {
            infer: true,
          }),
        }),
    },
    {
      provide: DATABASE,
      inject: [PG_POOL],
      useFactory: (pool: pg.Pool) => drizzle(pool, { schema }),
    },
    DatabaseLifecycleService,
    PlaceMemberRepository,
  ],
  exports: [DATABASE, PG_POOL, PlaceMemberRepository],
})
export class DatabaseModule {}
