import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { z } from 'zod';
import { createInitialAdmin } from '../operations/create-initial-admin.js';
import * as schema from '../schema/index.js';
import { getDatabaseCliEnvironment } from './environment.js';

const inputSchema = z.object({
  INITIAL_ADMIN_DISPLAY_NAME: z.string().trim().min(1).max(100),
  INITIAL_ADMIN_EMAIL: z.email().transform((value) => value.toLowerCase()),
  INITIAL_ADMIN_HANDLE: z
    .string()
    .regex(/^[a-z0-9_]{3,32}$/)
    .transform((value) => value.toLowerCase()),
  INITIAL_ADMIN_PASSWORD: z.string().min(12).max(256),
});

const environment = getDatabaseCliEnvironment();
const input = inputSchema.parse(process.env);
const pool = new pg.Pool({
  application_name: 'displace-initial-admin',
  connectionString: environment.DATABASE_URL,
  max: 1,
});

try {
  const database = drizzle(pool, { schema });
  await createInitialAdmin(database, {
    displayName: input.INITIAL_ADMIN_DISPLAY_NAME,
    email: input.INITIAL_ADMIN_EMAIL,
    handle: input.INITIAL_ADMIN_HANDLE,
    password: input.INITIAL_ADMIN_PASSWORD,
  });
} finally {
  await pool.end();
}

console.log('Initial administrator is ready.');
