import pg from 'pg';
import type { DatabaseCliEnvironment } from './environment.js';

const { Pool } = pg;

export function createMigrationPool(environment: DatabaseCliEnvironment) {
  return new Pool({
    application_name: 'displace-database-cli',
    connectionString: environment.DATABASE_MIGRATION_URL,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
    max: 1,
    statement_timeout: 30_000,
  });
}

export async function assertPostgres18(pool: pg.Pool): Promise<void> {
  const result = await pool.query<{ server_version_num: string }>(
    "select current_setting('server_version_num') as server_version_num",
  );
  if (Number(result.rows[0]?.server_version_num) < 180_000) {
    throw new Error('Displace requires PostgreSQL 18 or newer.');
  }
}

async function quoteIdentifier(
  pool: pg.Pool,
  identifier: string,
): Promise<string> {
  const result = await pool.query<{ identifier: string }>(
    "select format('%I', $1::text) as identifier",
    [identifier],
  );
  const quoted = result.rows[0]?.identifier;
  if (!quoted) {
    throw new Error('Could not quote a database identifier.');
  }
  return quoted;
}

interface RuntimeRoleState {
  hasMemberships: boolean;
  hasOwnership: boolean;
  rolbypassrls: boolean;
  rolcreatedb: boolean;
  rolcreaterole: boolean;
  rolreplication: boolean;
  rolsuper: boolean;
}

async function assertExistingRuntimeRoleIsSafe(
  pool: pg.Pool,
  runtimeRole: string,
): Promise<void> {
  const result = await pool.query<RuntimeRoleState>(
    `select
      roles.rolsuper,
      roles.rolcreatedb,
      roles.rolcreaterole,
      roles.rolreplication,
      roles.rolbypassrls,
      exists(select 1 from pg_auth_members where member = roles.oid) as "hasMemberships",
      exists(
        select 1
        from pg_shdepend dependencies
        where dependencies.refclassid = 'pg_authid'::regclass
          and dependencies.refobjid = roles.oid
          and dependencies.deptype = 'o'
      ) as "hasOwnership"
    from pg_roles roles
    where roles.rolname = $1`,
    [runtimeRole],
  );
  const state = result.rows[0];
  if (state && Object.values(state).some(Boolean)) {
    throw new Error(
      `Existing runtime database role ${runtimeRole} has elevated attributes, memberships, or ownership. Remove them before bootstrapping.`,
    );
  }
}

export async function bootstrapRuntimeRole(
  pool: pg.Pool,
  environment: DatabaseCliEnvironment,
): Promise<void> {
  await assertPostgres18(pool);
  const runtimeUrl = new URL(environment.DATABASE_URL);
  const runtimeRole = decodeURIComponent(runtimeUrl.username);
  const runtimePassword = decodeURIComponent(runtimeUrl.password);
  if (!runtimePassword) {
    throw new Error('The runtime database role must have a password.');
  }

  const role = await quoteIdentifier(pool, runtimeRole);
  const roleExists = await pool.query(
    'select 1 from pg_roles where rolname = $1',
    [runtimeRole],
  );
  const passwordLiteral = await pool.query<{ literal: string }>(
    "select format('%L', $1::text) as literal",
    [runtimePassword],
  );
  const password = passwordLiteral.rows[0]?.literal;
  if (!password) {
    throw new Error('Could not quote the runtime database password.');
  }

  if (roleExists.rowCount === 0) {
    await pool.query(
      `create role ${role} login nosuperuser nocreatedb nocreaterole noreplication nobypassrls password ${password}`,
    );
  } else {
    await assertExistingRuntimeRoleIsSafe(pool, runtimeRole);
    await pool.query(`alter role ${role} login password ${password}`);
  }

  const databaseName = decodeURIComponent(runtimeUrl.pathname.slice(1));
  const database = await quoteIdentifier(pool, databaseName);
  await pool.query(`revoke connect on database ${database} from public`);
  await pool.query(`revoke all on database ${database} from ${role}`);
  await pool.query(`grant connect on database ${database} to ${role}`);
  await pool.query('revoke all on schema public from public');
  await pool.query(`revoke all on schema public from ${role}`);
  await pool.query(`grant usage on schema public to ${role}`);
}

export async function grantRuntimePrivileges(
  pool: pg.Pool,
  environment: DatabaseCliEnvironment,
): Promise<void> {
  const runtimeRole = decodeURIComponent(
    new URL(environment.DATABASE_URL).username,
  );
  const role = await quoteIdentifier(pool, runtimeRole);

  await pool.query('revoke all on all tables in schema public from public');
  await pool.query('revoke all on all sequences in schema public from public');
  await pool.query('revoke all on all routines in schema public from public');
  await pool.query(`revoke all on all tables in schema public from ${role}`);
  await pool.query(`revoke all on all sequences in schema public from ${role}`);
  await pool.query(`revoke all on all routines in schema public from ${role}`);
  await pool.query(
    `grant select, insert, update, delete on all tables in schema public to ${role}`,
  );
  await pool.query(
    `grant usage, select, update on all sequences in schema public to ${role}`,
  );
  await pool.query('alter default privileges revoke all on tables from public');
  await pool.query(
    'alter default privileges in schema public revoke all on tables from public',
  );
  await pool.query(
    'alter default privileges revoke all on sequences from public',
  );
  await pool.query(
    'alter default privileges in schema public revoke all on sequences from public',
  );
  await pool.query(
    `alter default privileges revoke all on tables from ${role}`,
  );
  await pool.query(
    `alter default privileges in schema public revoke all on tables from ${role}`,
  );
  await pool.query(
    `alter default privileges revoke all on sequences from ${role}`,
  );
  await pool.query(
    `alter default privileges in schema public revoke all on sequences from ${role}`,
  );
  await pool.query(
    `alter default privileges in schema public grant select, insert, update, delete on tables to ${role}`,
  );
  await pool.query(
    `alter default privileges in schema public grant usage, select, update on sequences to ${role}`,
  );
  await pool.query(
    'alter default privileges revoke execute on functions from public',
  );
  await pool.query(
    'alter default privileges in schema public revoke execute on functions from public',
  );
  await pool.query(
    `alter default privileges revoke all on functions from ${role}`,
  );
  await pool.query(
    `alter default privileges in schema public revoke all on functions from ${role}`,
  );
  await pool.query(`revoke update, delete on audit_log from ${role}`);
}
