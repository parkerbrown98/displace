import {
  bootstrapRuntimeRole,
  createMigrationPool,
} from './database-administration.js';
import { getDatabaseCliEnvironment } from './environment.js';

const environment = getDatabaseCliEnvironment();
const pool = createMigrationPool(environment);

try {
  await bootstrapRuntimeRole(pool, environment);
  console.log('Database runtime role is ready.');
} finally {
  await pool.end();
}
