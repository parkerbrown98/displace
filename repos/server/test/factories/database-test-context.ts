import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import type { StartedRedisContainer } from '@testcontainers/redis';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Redis } from 'ioredis';
import pg from 'pg';
import {
  bootstrapRuntimeRole,
  createMigrationPool,
  grantRuntimePrivileges,
} from '../../src/database/cli/database-administration.js';
import type { DatabaseCliEnvironment } from '../../src/database/cli/environment.js';
import type { Database } from '../../src/database/database.types.js';
import * as schema from '../../src/database/schema/index.js';

export interface DatabaseTestContext {
  database: Database;
  environment: DatabaseCliEnvironment;
  pool: pg.Pool;
  redis: Redis;
  stop(): Promise<void>;
}

export async function startDatabaseTestContext(): Promise<DatabaseTestContext> {
  let postgresContainer: StartedPostgreSqlContainer | undefined;
  let redisContainer: StartedRedisContainer | undefined;
  try {
    postgresContainer = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('displace_test')
      .withUsername('displace_migration')
      .withPassword('migration_test_password')
      .start();
    redisContainer = await new RedisContainer('redis:8-alpine')
      .withPassword('redis_test_password')
      .start();
    return await configureContext(postgresContainer, redisContainer);
  } catch (error) {
    await Promise.allSettled([
      postgresContainer?.stop(),
      redisContainer?.stop(),
    ]);
    throw error;
  }
}

async function configureContext(
  postgresContainer: StartedPostgreSqlContainer,
  redisContainer: StartedRedisContainer,
): Promise<DatabaseTestContext> {
  const ownerUrl = postgresContainer.getConnectionUri();
  const runtimeUrl = new URL(ownerUrl);
  runtimeUrl.username = 'displace_test_app';
  runtimeUrl.password = 'runtime_test_password';
  const environment: DatabaseCliEnvironment = {
    NODE_ENV: 'test',
    DATABASE_MIGRATION_URL: ownerUrl,
    DATABASE_URL: runtimeUrl.toString(),
  };
  const migrationPool = createMigrationPool(environment);
  try {
    await bootstrapRuntimeRole(migrationPool, environment);
    await migrate(drizzle(migrationPool), { migrationsFolder: './drizzle' });
    await grantRuntimePrivileges(migrationPool, environment);
  } finally {
    await migrationPool.end();
  }

  let pool: pg.Pool | undefined;
  let redis: Redis | undefined;
  try {
    pool = new pg.Pool({
      application_name: 'displace-integration-test',
      connectionString: environment.DATABASE_URL,
      max: 2,
    });
    redis = new Redis(redisContainer.getConnectionUrl(), {
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: null,
    });
    await redis.connect();
    const activePool = pool;
    const activeRedis = redis;

    return {
      database: drizzle(activePool, { schema }),
      environment,
      pool: activePool,
      redis: activeRedis,
      async stop() {
        activeRedis.disconnect();
        await Promise.all([
          activePool.end(),
          postgresContainer.stop(),
          redisContainer.stop(),
        ]);
      },
    };
  } catch (error) {
    redis?.disconnect();
    await pool?.end().catch(() => undefined);
    throw error;
  }
}
