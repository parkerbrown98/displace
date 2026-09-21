import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { emptyJsonObject, uuidV7Default } from './common.js';
import { users } from './identity.js';
import { places } from './places.js';

export const uploadIntentStatus = pgEnum('upload_intent_status', [
  'pending',
  'completed',
  'expired',
]);
export const assetStatus = pgEnum('asset_status', [
  'quarantined',
  'processing',
  'ready',
  'rejected',
]);
export const assetScanStatus = pgEnum('asset_scan_status', [
  'pending',
  'clean',
  'infected',
  'skipped',
  'failed',
]);

export const uploadIntents = pgTable(
  'upload_intents',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    objectKey: text('object_key').notNull(),
    originalFileName: text('original_file_name').notNull(),
    expectedMimeType: text('expected_mime_type').notNull(),
    expectedSizeBytes: integer('expected_size_bytes').notNull(),
    status: uploadIntentStatus('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cleanedAt: timestamp('cleaned_at', { withTimezone: true }),
  },
  (table) => [
    unique('upload_intents_place_id_id_unique').on(table.placeId, table.id),
    uniqueIndex('upload_intents_object_key_unique').on(table.objectKey),
    index('upload_intents_place_user_status_expires_idx').on(
      table.placeId,
      table.userId,
      table.status,
      table.expiresAt,
    ),
    index('upload_intents_user_id_idx').on(table.userId),
    index('upload_intents_expiry_idx')
      .on(table.expiresAt, table.id)
      .where(
        sql`${table.status} in ('pending', 'expired') and ${table.cleanedAt} is null`,
      ),
    check(
      'upload_intents_file_name_check',
      sql`char_length(btrim(${table.originalFileName})) between 1 and 255`,
    ),
    check('upload_intents_size_check', sql`${table.expectedSizeBytes} > 0`),
    check(
      'upload_intents_expiry_check',
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);

export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    uploadedByUserId: uuid('uploaded_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    uploadIntentId: uuid('upload_intent_id').notNull(),
    objectKey: text('object_key').notNull(),
    originalFileName: text('original_file_name').notNull(),
    declaredMimeType: text('declared_mime_type').notNull(),
    detectedMimeType: text('detected_mime_type'),
    sizeBytes: integer('size_bytes').notNull(),
    status: assetStatus('status').notNull().default('quarantined'),
    scanStatus: assetScanStatus('scan_status').notNull().default('pending'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(emptyJsonObject),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    readyAt: timestamp('ready_at', { withTimezone: true }),
  },
  (table) => [
    unique('assets_place_id_id_unique').on(table.placeId, table.id),
    foreignKey({
      name: 'assets_upload_intent_place_fkey',
      columns: [table.placeId, table.uploadIntentId],
      foreignColumns: [uploadIntents.placeId, uploadIntents.id],
    }).onDelete('restrict'),
    uniqueIndex('assets_upload_intent_id_unique').on(table.uploadIntentId),
    index('assets_place_upload_intent_id_idx').on(
      table.placeId,
      table.uploadIntentId,
    ),
    uniqueIndex('assets_object_key_unique').on(table.objectKey),
    index('assets_place_created_at_id_idx').on(
      table.placeId,
      table.createdAt,
      table.id,
    ),
    index('assets_uploaded_by_user_id_idx').on(table.uploadedByUserId),
    check('assets_size_check', sql`${table.sizeBytes} > 0`),
    check(
      'assets_ready_at_check',
      sql`(${table.status} = 'ready' and ${table.readyAt} is not null) or (${table.status} <> 'ready')`,
    ),
  ],
);

export const assetVariants = pgTable(
  'asset_variants',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    placeId: uuid('place_id').notNull(),
    assetId: uuid('asset_id').notNull(),
    kind: text('kind').notNull(),
    objectKey: text('object_key').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'asset_variants_asset_place_fkey',
      columns: [table.placeId, table.assetId],
      foreignColumns: [assets.placeId, assets.id],
    }).onDelete('cascade'),
    uniqueIndex('asset_variants_asset_id_kind_unique').on(
      table.assetId,
      table.kind,
    ),
    index('asset_variants_place_asset_id_idx').on(table.placeId, table.assetId),
    uniqueIndex('asset_variants_object_key_unique').on(table.objectKey),
    index('asset_variants_place_id_idx').on(table.placeId),
    check('asset_variants_size_check', sql`${table.sizeBytes} > 0`),
    check(
      'asset_variants_dimensions_check',
      sql`${table.width} > 0 and ${table.height} > 0`,
    ),
  ],
);
