import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  inet,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { emptyJsonObject, uuidV7Default } from './common.js';

export const userStatus = pgEnum('user_status', [
  'active',
  'suspended',
  'deleted',
]);
export const authTokenType = pgEnum('auth_token_type', [
  'email_verification',
  'password_reset',
]);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    handle: text('handle').notNull(),
    displayName: text('display_name').notNull(),
    passwordHash: text('password_hash'),
    status: userStatus('status').notNull().default('active'),
    isInstanceAdmin: boolean('is_instance_admin').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('users_handle_unique').on(sql`lower(${table.handle})`),
    index('users_status_created_at_id_idx').on(
      table.status,
      table.createdAt,
      table.id,
    ),
    check(
      'users_handle_format_check',
      sql`${table.handle} = lower(${table.handle}) and ${table.handle} ~ '^[a-z0-9_]{3,32}$'`,
    ),
    check(
      'users_display_name_length_check',
      sql`char_length(btrim(${table.displayName})) between 1 and 100`,
    ),
  ],
);

export const userEmails = pgTable(
  'user_emails',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('user_emails_email_unique').on(sql`lower(${table.email})`),
    uniqueIndex('user_emails_one_primary_per_user_unique')
      .on(table.userId)
      .where(sql`${table.isPrimary}`),
    index('user_emails_user_id_idx').on(table.userId),
    check(
      'user_emails_normalized_check',
      sql`${table.email} = lower(btrim(${table.email})) and char_length(${table.email}) between 3 and 320`,
    ),
  ],
);

export const externalIdentities = pgTable(
  'external_identities',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    subject: text('subject').notNull(),
    claims: jsonb('claims')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(emptyJsonObject),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('external_identities_provider_subject_unique').on(
      table.provider,
      table.subject,
    ),
    index('external_identities_user_id_idx').on(table.userId),
    check(
      'external_identities_provider_check',
      sql`char_length(btrim(${table.provider})) between 1 and 100`,
    ),
    check(
      'external_identities_subject_check',
      sql`char_length(btrim(${table.subject})) between 1 and 512`,
    ),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenFamilyId: uuid('token_family_id').notNull().default(uuidV7Default),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('sessions_refresh_token_hash_unique').on(
      table.refreshTokenHash,
    ),
    index('sessions_user_id_expires_at_id_idx').on(
      table.userId,
      table.expiresAt,
      table.id,
    ),
    index('sessions_token_family_id_idx').on(table.tokenFamilyId),
    check(
      'sessions_expiry_check',
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      'sessions_revoked_at_check',
      sql`${table.revokedAt} is null or ${table.revokedAt} >= ${table.createdAt}`,
    ),
  ],
);

export const authTokens = pgTable(
  'auth_tokens',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: authTokenType('type').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('auth_tokens_token_hash_unique').on(table.tokenHash),
    index('auth_tokens_user_id_type_expires_at_idx').on(
      table.userId,
      table.type,
      table.expiresAt,
    ),
    check(
      'auth_tokens_expiry_check',
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      'auth_tokens_consumed_at_check',
      sql`${table.consumedAt} is null or ${table.consumedAt} >= ${table.createdAt}`,
    ),
  ],
);
