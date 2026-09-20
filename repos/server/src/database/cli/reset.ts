import {
  bootstrapRuntimeRole,
  createMigrationPool,
} from './database-administration.js';
import { getDatabaseCliEnvironment, getDatabaseTarget } from './environment.js';

const environment = getDatabaseCliEnvironment();
if (environment.NODE_ENV === 'production') {
  throw new Error('Database reset is disabled in production.');
}
const databaseTarget = getDatabaseTarget(environment.DATABASE_MIGRATION_URL);
if (process.env.CONFIRM_DATABASE_RESET !== databaseTarget) {
  throw new Error(
    `Set CONFIRM_DATABASE_RESET=${databaseTarget} to reset this database.`,
  );
}

const pool = createMigrationPool(environment);
try {
  await pool.query('drop schema if exists drizzle cascade');
  await pool.query('drop schema public cascade');
  await pool.query('create schema public');
  await bootstrapRuntimeRole(pool, environment);
} finally {
  await pool.end();
}

await import('./migrate.js');
await import('./seed.js');
console.log('Development database reset completed.');
