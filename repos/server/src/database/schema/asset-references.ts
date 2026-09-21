import {
  foreignKey,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { assets } from './assets.js';
import { posts } from './forums.js';
import { users } from './identity.js';
import { places } from './places.js';

export const userImageKind = pgEnum('user_image_kind', ['avatar', 'banner']);
export const placeImageKind = pgEnum('place_image_kind', ['icon', 'banner']);

export const userProfileAssets = pgTable(
  'user_profile_assets',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: userImageKind('kind').notNull(),
    placeId: uuid('place_id').notNull(),
    assetId: uuid('asset_id').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.kind] }),
    foreignKey({
      name: 'user_profile_assets_asset_place_fkey',
      columns: [table.placeId, table.assetId],
      foreignColumns: [assets.placeId, assets.id],
    }).onDelete('cascade'),
    index('user_profile_assets_place_asset_idx').on(
      table.placeId,
      table.assetId,
    ),
  ],
);

export const placeProfileAssets = pgTable(
  'place_profile_assets',
  {
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    kind: placeImageKind('kind').notNull(),
    assetId: uuid('asset_id').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.placeId, table.kind] }),
    foreignKey({
      name: 'place_profile_assets_asset_place_fkey',
      columns: [table.placeId, table.assetId],
      foreignColumns: [assets.placeId, assets.id],
    }).onDelete('cascade'),
    index('place_profile_assets_place_asset_idx').on(
      table.placeId,
      table.assetId,
    ),
  ],
);

export const postAssets = pgTable(
  'post_assets',
  {
    placeId: uuid('place_id').notNull(),
    postId: uuid('post_id').notNull(),
    assetId: uuid('asset_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.assetId] }),
    foreignKey({
      name: 'post_assets_post_place_fkey',
      columns: [table.placeId, table.postId],
      foreignColumns: [posts.placeId, posts.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'post_assets_asset_place_fkey',
      columns: [table.placeId, table.assetId],
      foreignColumns: [assets.placeId, assets.id],
    }).onDelete('restrict'),
    index('post_assets_place_post_idx').on(table.placeId, table.postId),
    index('post_assets_place_asset_idx').on(table.placeId, table.assetId),
  ],
);
