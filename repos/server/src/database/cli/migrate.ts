import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import {
  assertPostgres18,
  createMigrationPool,
  grantRuntimePrivileges,
} from './database-administration.js';
import { getDatabaseCliEnvironment } from './environment.js';

export async function migrateDatabase(): Promise<void> {
  const environment = getDatabaseCliEnvironment();
  const pool = createMigrationPool(environment);

  try {
    await assertPostgres18(pool);
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
    await grantRuntimePrivileges(pool, environment);
  } finally {
    await pool.end();
  }
}

await migrateDatabase();
console.log('Database migrations are current.');
