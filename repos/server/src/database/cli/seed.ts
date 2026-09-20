import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { instanceSettings } from '../schema/index.js';
import { getDatabaseCliEnvironment } from './environment.js';

export async function seedDatabase(): Promise<void> {
  const environment = getDatabaseCliEnvironment();
  if (environment.NODE_ENV === 'production') {
    throw new Error('Development seed data cannot run in production.');
  }

  const pool = new pg.Pool({
    application_name: 'displace-database-seed',
    connectionString: environment.DATABASE_URL,
    max: 1,
  });
  try {
    const database = drizzle(pool);
    await database
      .insert(instanceSettings)
      .values({ id: 1 })
      .onConflictDoNothing();
  } finally {
    await pool.end();
  }
}

await seedDatabase();
console.log('Deterministic development seed applied.');
