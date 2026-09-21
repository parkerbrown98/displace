import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import {
  bootstrapRuntimeRole,
  createMigrationPool,
  grantRuntimePrivileges,
} from '../../src/database/cli/database-administration.js';
import { createInitialAdmin } from '../../src/database/operations/create-initial-admin.js';
import { PlaceMemberRepository } from '../../src/database/repositories/place-member.repository.js';
import { placeScope } from '../../src/database/repositories/place-scope.js';
import { userEmails, users } from '../../src/database/schema/index.js';
import {
  startDatabaseTestContext,
  type DatabaseTestContext,
} from '../factories/database-test-context.js';
import { withRollback } from '../factories/transaction-fixture.js';

describe('database foundation', () => {
  let context: DatabaseTestContext;

  beforeAll(async () => {
    context = await startDatabaseTestContext();
  });

  afterAll(async () => {
    await context?.stop();
  });

  it('applies the migration idempotently on PostgreSQL 18', async () => {
    const migrationPool = createMigrationPool(context.environment);
    try {
      await migrate(drizzle(migrationPool), { migrationsFolder: './drizzle' });
      await grantRuntimePrivileges(migrationPool, context.environment);
    } finally {
      await migrationPool.end();
    }

    const result = await context.pool.query<{
      is_postgres_18: boolean;
      table_count: string;
      timestamp_type: string;
    }>(`
      select
        current_setting('server_version_num')::integer >= 180000 as is_postgres_18,
        (select count(*) from information_schema.tables where table_schema = 'public') as table_count,
        (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'created_at') as timestamp_type
    `);

    expect(result.rows[0]).toEqual({
      is_postgres_18: true,
      table_count: '30',
      timestamp_type: 'timestamp with time zone',
    });
  });

  it('uses UUIDv7 defaults and enforces schema constraints', async () => {
    await withRollback(context.pool, async (fixture) => {
      const user = await fixture.createUser();
      expect(user.id[14]).toBe('7');

      await expect(
        fixture.database.insert(userEmails).values({
          email: 'NOT-NORMALIZED@example.test',
          userId: user.id,
        }),
      ).rejects.toThrow();
    });
  });

  it('requires place scope for membership access', async () => {
    let rolledBackUserId = '';
    await withRollback(context.pool, async (fixture) => {
      const firstOwner = await fixture.createUser();
      const secondOwner = await fixture.createUser();
      const firstPlace = await fixture.createPlace(firstOwner.id);
      const secondPlace = await fixture.createPlace(secondOwner.id);
      await fixture.createActiveMember(firstPlace.id, firstOwner.id);
      await fixture.createActiveMember(secondPlace.id, secondOwner.id);
      rolledBackUserId = firstOwner.id;

      const repository = new PlaceMemberRepository(fixture.database);
      await expect(
        repository.findActiveByUser(placeScope(firstPlace.id), firstOwner.id),
      ).resolves.toMatchObject({ userId: firstOwner.id });
      await expect(
        repository.findActiveByUser(placeScope(firstPlace.id), secondOwner.id),
      ).resolves.toBeUndefined();
      await expect(
        repository.listActive(placeScope(firstPlace.id), { limit: 25 }),
      ).resolves.toHaveLength(1);
    });

    const result = await context.pool.query(
      'select 1 from users where id = $1',
      [rolledBackUserId],
    );
    expect(result.rowCount).toBe(0);
  });

  it('indexes every foreign key and limits runtime privileges', async () => {
    const missingIndexes = await context.pool.query(`
      select constraint_name
      from information_schema.table_constraints constraints
      join pg_constraint pg_constraint
        on pg_constraint.conname = constraints.constraint_name
      where constraints.constraint_schema = 'public'
        and constraints.constraint_type = 'FOREIGN KEY'
        and not exists (
          select 1
          from pg_index
          where pg_index.indrelid = pg_constraint.conrelid
            and pg_constraint.conkey <@ pg_index.indkey::smallint[]
        )
    `);
    expect(missingIndexes.rows).toEqual([]);

    const privileges = await context.pool.query<{
      can_create: boolean;
      can_delete_audit: boolean;
      can_insert_users: boolean;
      can_update_audit: boolean;
    }>(`
      select
        has_schema_privilege(current_user, 'public', 'create') as can_create,
        has_table_privilege(current_user, 'users', 'insert') as can_insert_users,
        has_table_privilege(current_user, 'audit_log', 'update') as can_update_audit,
        has_table_privilege(current_user, 'audit_log', 'delete') as can_delete_audit
    `);
    expect(privileges.rows[0]).toEqual({
      can_create: false,
      can_delete_audit: false,
      can_insert_users: true,
      can_update_audit: false,
    });
  });

  it('rejects a pre-existing elevated runtime role', async () => {
    const migrationPool = createMigrationPool(context.environment);
    const unsafeRole = 'displace_unsafe_test_app';
    const unsafeRuntimeUrl = new URL(context.environment.DATABASE_URL);
    unsafeRuntimeUrl.username = unsafeRole;
    const unsafeEnvironment = {
      ...context.environment,
      DATABASE_URL: unsafeRuntimeUrl.toString(),
    };

    try {
      await migrationPool.query(
        `create role ${unsafeRole} login createdb password 'unsafe-test-password'`,
      );
      await expect(
        bootstrapRuntimeRole(migrationPool, unsafeEnvironment),
      ).rejects.toThrow(/has elevated attributes, memberships, or ownership/);
    } finally {
      await migrationPool.query(`drop role if exists ${unsafeRole}`);
      await migrationPool.end();
    }
  });

  it('rejects a runtime role that owns non-table database objects', async () => {
    const migrationPool = createMigrationPool(context.environment);
    const unsafeRole = 'displace_owning_test_app';
    const unsafeRuntimeUrl = new URL(context.environment.DATABASE_URL);
    unsafeRuntimeUrl.username = unsafeRole;
    const unsafeEnvironment = {
      ...context.environment,
      DATABASE_URL: unsafeRuntimeUrl.toString(),
    };

    try {
      await migrationPool.query(
        `create role ${unsafeRole} login password 'unsafe-test-password'`,
      );
      await migrationPool.query(
        'create collation public.unsafe_owned_test_collation from "C"',
      );
      await migrationPool.query(
        `alter collation public.unsafe_owned_test_collation owner to ${unsafeRole}`,
      );
      await expect(
        bootstrapRuntimeRole(migrationPool, unsafeEnvironment),
      ).rejects.toThrow(/has elevated attributes, memberships, or ownership/);
    } finally {
      await migrationPool.query(
        'drop collation if exists public.unsafe_owned_test_collation',
      );
      await migrationPool.query(`drop role if exists ${unsafeRole}`);
      await migrationPool.end();
    }
  });

  it('normalizes poisoned defaults for future tables and sequences', async () => {
    const migrationPool = createMigrationPool(context.environment);
    const runtimeRole = 'displace_test_app';
    try {
      await migrationPool.query(
        `alter default privileges grant all on tables to ${runtimeRole}`,
      );
      await migrationPool.query(
        `alter default privileges in schema public grant all on tables to ${runtimeRole}`,
      );
      await migrationPool.query(
        `alter default privileges grant all on sequences to ${runtimeRole}`,
      );
      await migrationPool.query(
        `alter default privileges in schema public grant all on sequences to ${runtimeRole}`,
      );
      await migrationPool.query(
        'alter default privileges grant select on tables to public',
      );
      await migrationPool.query(
        'alter default privileges in schema public grant select on tables to public',
      );

      await grantRuntimePrivileges(migrationPool, context.environment);
      await migrationPool.query(
        'create table public.future_acl_test_table (id integer)',
      );
      await migrationPool.query('create sequence public.future_acl_test_seq');

      const privileges = await migrationPool.query<{
        publicCanSelect: boolean;
        runtimeCanInsert: boolean;
        runtimeCanTruncate: boolean;
        runtimeCanUseSequence: boolean;
      }>(`
        select
          has_table_privilege('public', 'future_acl_test_table', 'select') as "publicCanSelect",
          has_table_privilege('${runtimeRole}', 'future_acl_test_table', 'insert') as "runtimeCanInsert",
          has_table_privilege('${runtimeRole}', 'future_acl_test_table', 'truncate') as "runtimeCanTruncate",
          has_sequence_privilege('${runtimeRole}', 'future_acl_test_seq', 'usage') as "runtimeCanUseSequence"
      `);
      expect(privileges.rows[0]).toEqual({
        publicCanSelect: false,
        runtimeCanInsert: true,
        runtimeCanTruncate: false,
        runtimeCanUseSequence: true,
      });
    } finally {
      await migrationPool.query(
        'drop table if exists public.future_acl_test_table',
      );
      await migrationPool.query(
        'drop sequence if exists public.future_acl_test_seq',
      );
      await migrationPool.end();
    }
  });

  it('denies runtime execution of existing and future public routines', async () => {
    const migrationPool = createMigrationPool(context.environment);
    try {
      await migrationPool.query(
        'alter default privileges in schema public grant execute on routines to public',
      );
      await migrationPool.query(`
        create function public.unsafe_existing_test_function()
        returns text
        language sql
        security definer
        as 'select current_user::text'
      `);

      await grantRuntimePrivileges(migrationPool, context.environment);
      await expect(
        context.pool.query('select public.unsafe_existing_test_function()'),
      ).rejects.toThrow(/permission denied/);

      await migrationPool.query(`
        create function public.unsafe_future_test_function()
        returns text
        language sql
        security definer
        as 'select current_user::text'
      `);
      await expect(
        context.pool.query('select public.unsafe_future_test_function()'),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await migrationPool.query(
        'drop function if exists public.unsafe_existing_test_function()',
      );
      await migrationPool.query(
        'drop function if exists public.unsafe_future_test_function()',
      );
      await migrationPool.end();
    }
  });

  it('connects to disposable Redis with authentication', async () => {
    await expect(context.redis.ping()).resolves.toBe('PONG');
  });

  it('creates or promotes one initial administrator idempotently', async () => {
    const input = {
      displayName: 'Initial Admin',
      email: 'admin@integration.test',
      handle: 'initial_admin',
      password: 'integration-password-123',
    };
    const firstId = await createInitialAdmin(context.database, input);
    await context.database
      .update(userEmails)
      .set({ isPrimary: false, verifiedAt: null })
      .where(eq(userEmails.userId, firstId));
    const secondId = await createInitialAdmin(context.database, input);
    expect(secondId).toBe(firstId);

    const records = await context.database
      .select({
        email: userEmails.email,
        isPrimary: userEmails.isPrimary,
        isInstanceAdmin: users.isInstanceAdmin,
        passwordHash: users.passwordHash,
        verifiedAt: userEmails.verifiedAt,
      })
      .from(users)
      .innerJoin(userEmails, eq(userEmails.userId, users.id))
      .where(eq(users.id, firstId));
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      email: input.email,
      isPrimary: true,
      isInstanceAdmin: true,
    });
    expect(records[0]?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(records[0]?.verifiedAt).toBeInstanceOf(Date);
  });

  it('does not promote a suspended account to initial administrator', async () => {
    const [user] = await context.database
      .insert(users)
      .values({
        displayName: 'Suspended Admin',
        handle: 'suspended_admin',
        status: 'suspended',
      })
      .returning({ id: users.id });
    if (!user) {
      throw new Error('Suspended test user creation returned no user.');
    }
    await context.database.insert(userEmails).values({
      email: 'suspended@integration.test',
      userId: user.id,
    });

    await expect(
      createInitialAdmin(context.database, {
        displayName: 'Suspended Admin',
        email: 'suspended@integration.test',
        handle: 'suspended_admin',
        password: 'integration-password-123',
      }),
    ).rejects.toThrow(/Cannot promote a suspended user/);
  });
});
