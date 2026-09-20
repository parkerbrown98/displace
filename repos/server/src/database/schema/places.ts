import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { uuidV7Default } from './common.js';
import { users } from './identity.js';

export const placeVisibility = pgEnum('place_visibility', [
  'public',
  'unlisted',
  'private',
]);
export const placeJoinPolicy = pgEnum('place_join_policy', [
  'open',
  'approval',
  'invite_only',
]);
export const placeMemberStatus = pgEnum('place_member_status', [
  'pending',
  'active',
  'left',
]);

export const places = pgTable(
  'places',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    visibility: placeVisibility('visibility').notNull().default('public'),
    joinPolicy: placeJoinPolicy('join_policy').notNull().default('open'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('places_slug_unique').on(sql`lower(${table.slug})`),
    index('places_owner_user_id_idx').on(table.ownerUserId),
    index('places_visibility_created_at_id_idx').on(
      table.visibility,
      table.createdAt,
      table.id,
    ),
    check(
      'places_slug_format_check',
      sql`${table.slug} = lower(${table.slug}) and ${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(${table.slug}) between 3 and 80`,
    ),
    check(
      'places_name_length_check',
      sql`char_length(btrim(${table.name})) between 1 and 120`,
    ),
  ],
);

export const placeMembers = pgTable(
  'place_members',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: placeMemberStatus('status').notNull().default('pending'),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('place_members_place_id_id_unique').on(table.placeId, table.id),
    uniqueIndex('place_members_place_id_user_id_unique').on(
      table.placeId,
      table.userId,
    ),
    index('place_members_user_id_idx').on(table.userId),
    index('place_members_place_id_status_created_at_id_idx').on(
      table.placeId,
      table.status,
      table.createdAt,
      table.id,
    ),
    check(
      'place_members_joined_at_check',
      sql`(${table.status} = 'active' and ${table.joinedAt} is not null) or (${table.status} <> 'active')`,
    ),
  ],
);

export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    isSystem: boolean('is_system').notNull().default(false),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('roles_place_id_id_unique').on(table.placeId, table.id),
    uniqueIndex('roles_place_id_name_unique').on(
      table.placeId,
      sql`lower(${table.name})`,
    ),
    index('roles_place_id_position_id_idx').on(
      table.placeId,
      table.position,
      table.id,
    ),
    check(
      'roles_name_length_check',
      sql`char_length(btrim(${table.name})) between 1 and 80`,
    ),
    check('roles_position_check', sql`${table.position} >= 0`),
  ],
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permission: text('permission').notNull(),
  },
  (table) => [
    primaryKey({
      name: 'role_permissions_pkey',
      columns: [table.roleId, table.permission],
    }),
    check(
      'role_permissions_permission_format_check',
      sql`${table.permission} ~ '^[a-z][a-z0-9_]*(?:[.][a-z][a-z0-9_]*)+$'`,
    ),
  ],
);

export const memberRoles = pgTable(
  'member_roles',
  {
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id').notNull(),
    roleId: uuid('role_id').notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'member_roles_pkey',
      columns: [table.placeId, table.memberId, table.roleId],
    }),
    foreignKey({
      name: 'member_roles_member_place_fkey',
      columns: [table.placeId, table.memberId],
      foreignColumns: [placeMembers.placeId, placeMembers.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'member_roles_role_place_fkey',
      columns: [table.placeId, table.roleId],
      foreignColumns: [roles.placeId, roles.id],
    }).onDelete('cascade'),
    index('member_roles_place_id_role_id_idx').on(table.placeId, table.roleId),
  ],
);

export const invites = pgTable(
  'invites',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id'),
    invitedByUserId: uuid('invited_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    acceptedByUserId: uuid('accepted_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    email: text('email'),
    tokenHash: text('token_hash').notNull(),
    maxUses: integer('max_uses').notNull().default(1),
    useCount: integer('use_count').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('invites_token_hash_unique').on(table.tokenHash),
    foreignKey({
      name: 'invites_role_place_fkey',
      columns: [table.placeId, table.roleId],
      foreignColumns: [roles.placeId, roles.id],
    }).onDelete('restrict'),
    index('invites_place_id_expires_at_id_idx').on(
      table.placeId,
      table.expiresAt,
      table.id,
    ),
    index('invites_place_id_role_id_idx').on(table.placeId, table.roleId),
    index('invites_invited_by_user_id_idx').on(table.invitedByUserId),
    index('invites_accepted_by_user_id_idx').on(table.acceptedByUserId),
    check(
      'invites_email_normalized_check',
      sql`${table.email} is null or (${table.email} = lower(btrim(${table.email})) and char_length(${table.email}) between 3 and 320)`,
    ),
    check('invites_max_uses_check', sql`${table.maxUses} > 0`),
    check(
      'invites_use_count_check',
      sql`${table.useCount} >= 0 and ${table.useCount} <= ${table.maxUses}`,
    ),
    check('invites_expiry_check', sql`${table.expiresAt} > ${table.createdAt}`),
  ],
);

export const bans = pgTable(
  'bans',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    revokedByUserId: uuid('revoked_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    reason: text('reason').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('bans_place_id_user_id_created_at_id_idx').on(
      table.placeId,
      table.userId,
      table.createdAt,
      table.id,
    ),
    index('bans_user_id_idx').on(table.userId),
    index('bans_created_by_user_id_idx').on(table.createdByUserId),
    index('bans_revoked_by_user_id_idx').on(table.revokedByUserId),
    check(
      'bans_reason_length_check',
      sql`char_length(btrim(${table.reason})) between 1 and 2000`,
    ),
    check(
      'bans_expiry_check',
      sql`${table.expiresAt} is null or ${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      'bans_revocation_check',
      sql`(${table.revokedAt} is null and ${table.revokedByUserId} is null) or (${table.revokedAt} is not null and ${table.revokedByUserId} is not null)`,
    ),
  ],
);
