import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { emptyJsonObject, uuidV7Default } from './common.js';
import { users } from './identity.js';
import { places } from './places.js';

export const reportTargetType = pgEnum('report_target_type', [
  'place',
  'member',
  'topic',
  'post',
  'chat_message',
]);
export const reportStatus = pgEnum('report_status', [
  'open',
  'in_review',
  'resolved',
  'dismissed',
]);
export const memberSanctionType = pgEnum('member_sanction_type', [
  'warning',
  'timeout',
]);

export const moderationReports = pgTable(
  'moderation_reports',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    reporterUserId: uuid('reporter_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    targetType: reportTargetType('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    reasonCode: text('reason_code').notNull(),
    details: text('details').notNull().default(''),
    evidence: jsonb('evidence')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(emptyJsonObject),
    status: reportStatus('status').notNull().default('open'),
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    resolvedByUserId: uuid('resolved_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    resolution: text('resolution'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('moderation_reports_place_status_created_at_id_idx').on(
      table.placeId,
      table.status,
      table.createdAt,
      table.id,
    ),
    index('moderation_reports_assignee_status_created_at_id_idx').on(
      table.assignedToUserId,
      table.status,
      table.createdAt,
      table.id,
    ),
    index('moderation_reports_target_idx').on(
      table.placeId,
      table.targetType,
      table.targetId,
      table.createdAt,
    ),
    index('moderation_reports_reporter_user_id_idx').on(table.reporterUserId),
    index('moderation_reports_resolved_by_user_id_idx').on(
      table.resolvedByUserId,
    ),
    check(
      'moderation_reports_reason_code_check',
      sql`${table.reasonCode} ~ '^[a-z][a-z0-9_]{1,49}$'`,
    ),
    check(
      'moderation_reports_details_length_check',
      sql`char_length(${table.details}) <= 4000`,
    ),
    check(
      'moderation_reports_resolution_check',
      sql`(
        ${table.status} in ('resolved', 'dismissed')
        and ${table.resolvedAt} is not null
        and ${table.resolvedByUserId} is not null
        and char_length(btrim(${table.resolution})) between 1 and 4000
      ) or (
        ${table.status} in ('open', 'in_review')
        and ${table.resolvedAt} is null
        and ${table.resolvedByUserId} is null
        and ${table.resolution} is null
      )`,
    ),
  ],
);

export const moderatorNotes = pgTable(
  'moderator_notes',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    reportId: uuid('report_id')
      .notNull()
      .references(() => moderationReports.id, { onDelete: 'cascade' }),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('moderator_notes_report_id_created_at_id_idx').on(
      table.reportId,
      table.createdAt,
      table.id,
    ),
    index('moderator_notes_place_id_idx').on(table.placeId),
    index('moderator_notes_author_user_id_idx').on(table.authorUserId),
    check(
      'moderator_notes_body_length_check',
      sql`char_length(btrim(${table.body})) between 1 and 4000`,
    ),
  ],
);

export const moderationActions = pgTable(
  'moderation_actions',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    placeId: uuid('place_id').references(() => places.id, {
      onDelete: 'restrict',
    }),
    reportId: uuid('report_id').references(() => moderationReports.id, {
      onDelete: 'set null',
    }),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    action: text('action').notNull(),
    reasonCode: text('reason_code').notNull(),
    reason: text('reason').notNull(),
    before: jsonb('before')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(emptyJsonObject),
    after: jsonb('after')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(emptyJsonObject),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('moderation_actions_place_id_created_at_id_idx').on(
      table.placeId,
      table.createdAt,
      table.id,
    ),
    index('moderation_actions_report_id_idx').on(table.reportId),
    index('moderation_actions_actor_user_id_idx').on(table.actorUserId),
    index('moderation_actions_target_idx').on(
      table.targetType,
      table.targetId,
      table.createdAt,
      table.id,
    ),
    check(
      'moderation_actions_action_check',
      sql`${table.action} ~ '^[a-z][a-z0-9_]*(?:[.][a-z][a-z0-9_]*)+$'`,
    ),
    check(
      'moderation_actions_reason_code_check',
      sql`${table.reasonCode} ~ '^[a-z][a-z0-9_]{1,49}$'`,
    ),
    check(
      'moderation_actions_reason_length_check',
      sql`char_length(btrim(${table.reason})) between 1 and 4000`,
    ),
  ],
);

export const memberSanctions = pgTable(
  'member_sanctions',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: memberSanctionType('type').notNull(),
    reasonCode: text('reason_code').notNull(),
    reason: text('reason').notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedByUserId: uuid('revoked_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('member_sanctions_place_user_created_at_id_idx').on(
      table.placeId,
      table.userId,
      table.createdAt,
      table.id,
    ),
    index('member_sanctions_active_timeout_idx')
      .on(table.placeId, table.userId, table.expiresAt)
      .where(sql`${table.type} = 'timeout' and ${table.revokedAt} is null`),
    index('member_sanctions_created_by_user_id_idx').on(
      table.createdByUserId,
    ),
    index('member_sanctions_revoked_by_user_id_idx').on(
      table.revokedByUserId,
    ),
    check(
      'member_sanctions_reason_code_check',
      sql`${table.reasonCode} ~ '^[a-z][a-z0-9_]{1,49}$'`,
    ),
    check(
      'member_sanctions_reason_length_check',
      sql`char_length(btrim(${table.reason})) between 1 and 4000`,
    ),
    check(
      'member_sanctions_expiry_check',
      sql`(${table.type} = 'warning' and ${table.expiresAt} is null) or (${table.type} = 'timeout' and ${table.expiresAt} > ${table.createdAt})`,
    ),
    check(
      'member_sanctions_revocation_check',
      sql`(${table.revokedAt} is null and ${table.revokedByUserId} is null) or (${table.revokedAt} is not null and ${table.revokedByUserId} is not null)`,
    ),
  ],
);

export const moderationSignals = pgTable(
  'moderation_signals',
  {
    reportId: uuid('report_id')
      .notNull()
      .references(() => moderationReports.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    valueHash: text('value_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'moderation_signals_pkey',
      columns: [table.reportId, table.type, table.valueHash],
    }),
    index('moderation_signals_hash_expires_at_idx').on(
      table.type,
      table.valueHash,
      table.expiresAt,
    ),
    index('moderation_signals_expires_at_idx').on(table.expiresAt),
    check(
      'moderation_signals_type_check',
      sql`${table.type} ~ '^[a-z][a-z0-9_]{1,49}$'`,
    ),
    check(
      'moderation_signals_hash_check',
      sql`char_length(${table.valueHash}) between 32 and 128`,
    ),
    check(
      'moderation_signals_expiry_check',
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);