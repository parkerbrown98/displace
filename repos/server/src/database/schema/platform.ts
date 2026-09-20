import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  inet,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { emptyJsonObject, uuidV7Default } from './common.js';
import { users } from './identity.js';
import { places } from './places.js';

export const registrationMode = pgEnum('registration_mode', [
  'open',
  'invite_only',
  'closed',
]);
export const outboxStatus = pgEnum('outbox_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);
export const idempotencyStatus = pgEnum('idempotency_status', [
  'processing',
  'completed',
  'failed',
]);

export const instanceSettings = pgTable(
  'instance_settings',
  {
    id: integer('id').primaryKey().default(1),
    registrationMode: registrationMode('registration_mode')
      .notNull()
      .default('open'),
    singlePlaceMode: boolean('single_place_mode').notNull().default(false),
    settings: jsonb('settings')
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
  (table) => [check('instance_settings_singleton_check', sql`${table.id} = 1`)],
);

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(emptyJsonObject),
    status: outboxStatus('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    availableAt: timestamp('available_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('outbox_events_dispatch_idx')
      .on(table.availableAt, table.createdAt, table.id)
      .where(sql`${table.status} in ('pending', 'failed')`),
    index('outbox_events_aggregate_idx').on(
      table.aggregateType,
      table.aggregateId,
      table.createdAt,
      table.id,
    ),
    check('outbox_events_attempts_check', sql`${table.attempts} >= 0`),
    check(
      'outbox_events_type_check',
      sql`char_length(btrim(${table.eventType})) between 1 and 200`,
    ),
  ],
);

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    scope: text('scope').notNull(),
    key: text('key').notNull(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    placeId: uuid('place_id').references(() => places.id, {
      onDelete: 'cascade',
    }),
    requestHash: text('request_hash').notNull(),
    status: idempotencyStatus('status').notNull().default('processing'),
    responseStatus: integer('response_status'),
    responseBody: jsonb('response_body').$type<unknown>(),
    responseHeaders: jsonb('response_headers').$type<Record<string, string>>(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('idempotency_keys_scope_key_unique').on(table.scope, table.key),
    index('idempotency_keys_user_id_idx').on(table.userId),
    index('idempotency_keys_place_id_idx').on(table.placeId),
    index('idempotency_keys_expires_at_idx').on(table.expiresAt),
    check(
      'idempotency_keys_key_length_check',
      sql`char_length(${table.key}) between 8 and 128`,
    ),
    check(
      'idempotency_keys_scope_check',
      sql`char_length(btrim(${table.scope})) between 1 and 200`,
    ),
    check(
      'idempotency_keys_response_check',
      sql`(${table.status} = 'completed' and ${table.responseStatus} is not null) or (${table.status} <> 'completed')`,
    ),
    check(
      'idempotency_keys_expiry_check',
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    placeId: uuid('place_id').references(() => places.id, {
      onDelete: 'restrict',
    }),
    actorUserId: uuid('actor_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: uuid('target_id'),
    requestId: text('request_id'),
    ipAddress: inet('ip_address'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(emptyJsonObject),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('audit_log_place_id_created_at_id_idx').on(
      table.placeId,
      table.createdAt,
      table.id,
    ),
    index('audit_log_actor_user_id_created_at_id_idx').on(
      table.actorUserId,
      table.createdAt,
      table.id,
    ),
    index('audit_log_target_idx').on(
      table.targetType,
      table.targetId,
      table.createdAt,
      table.id,
    ),
    check(
      'audit_log_action_check',
      sql`char_length(btrim(${table.action})) between 1 and 200`,
    ),
  ],
);
