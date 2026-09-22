import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { emptyJsonObject, uuidV7Default } from './common.js';
import { users } from './identity.js';
import { places } from './places.js';

export const chatChannelVisibility = pgEnum('chat_channel_visibility', [
  'members',
  'public',
]);

export const voiceRooms = pgTable(
  'voice_rooms',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    capacity: integer('capacity').notNull().default(25),
    listenPermission: text('listen_permission').notNull().default('voice.join'),
    speakPermission: text('speak_permission').notNull().default('voice.join'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('voice_rooms_place_id_id_unique').on(table.placeId, table.id),
    unique('voice_rooms_place_slug_unique').on(table.placeId, table.slug),
    index('voice_rooms_place_position_id_idx').on(
      table.placeId,
      table.position,
      table.id,
    ),
    check(
      'voice_rooms_slug_format_check',
      sql`${table.slug} = lower(${table.slug}) and ${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(${table.slug}) between 1 and 80`,
    ),
    check(
      'voice_rooms_name_length_check',
      sql`char_length(btrim(${table.name})) between 1 and 120`,
    ),
    check('voice_rooms_position_check', sql`${table.position} >= 0`),
    check(
      'voice_rooms_capacity_check',
      sql`${table.capacity} between 1 and 500`,
    ),
  ],
);

export const chatChannels = pgTable(
  'chat_channels',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    visibility: chatChannelVisibility('visibility').notNull().default('members'),
    readPermission: text('read_permission'),
    sendPermission: text('send_permission'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('chat_channels_place_id_id_unique').on(table.placeId, table.id),
    unique('chat_channels_place_slug_unique').on(table.placeId, table.slug),
    index('chat_channels_place_position_id_idx').on(
      table.placeId,
      table.position,
      table.id,
    ),
    check(
      'chat_channels_slug_format_check',
      sql`${table.slug} = lower(${table.slug}) and ${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(${table.slug}) between 1 and 80`,
    ),
    check(
      'chat_channels_name_length_check',
      sql`char_length(btrim(${table.name})) between 1 and 120`,
    ),
    check('chat_channels_position_check', sql`${table.position} >= 0`),
  ],
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id').notNull(),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    body: text('body').notNull(),
    clientCommandId: uuid('client_command_id').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedByUserId: uuid('deleted_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('chat_messages_place_id_id_unique').on(table.placeId, table.id),
    unique('chat_messages_author_command_unique').on(
      table.authorUserId,
      table.clientCommandId,
    ),
    foreignKey({
      name: 'chat_messages_channel_place_fkey',
      columns: [table.placeId, table.channelId],
      foreignColumns: [chatChannels.placeId, chatChannels.id],
    }).onDelete('cascade'),
    index('chat_messages_channel_created_at_id_idx').on(
      table.channelId,
      table.createdAt,
      table.id,
    ),
    index('chat_messages_place_channel_idx').on(table.placeId, table.channelId),
    index('chat_messages_author_user_id_idx').on(table.authorUserId),
    index('chat_messages_deleted_by_user_id_idx').on(table.deletedByUserId),
    check(
      'chat_messages_body_length_check',
      sql`char_length(btrim(${table.body})) between 1 and 4000`,
    ),
  ],
);

export const chatMessageRevisions = pgTable(
  'chat_message_revisions',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id').notNull(),
    editorUserId: uuid('editor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'chat_message_revisions_message_place_fkey',
      columns: [table.placeId, table.messageId],
      foreignColumns: [chatMessages.placeId, chatMessages.id],
    }).onDelete('cascade'),
    index('chat_message_revisions_message_created_at_id_idx').on(
      table.messageId,
      table.createdAt,
      table.id,
    ),
    index('chat_message_revisions_place_message_idx').on(
      table.placeId,
      table.messageId,
    ),
    index('chat_message_revisions_editor_user_id_idx').on(table.editorUserId),
    check(
      'chat_message_revisions_body_length_check',
      sql`char_length(btrim(${table.body})) between 1 and 4000`,
    ),
  ],
);

export const chatReadState = pgTable(
  'chat_read_state',
  {
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lastReadMessageId: uuid('last_read_message_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'chat_read_state_pkey',
      columns: [table.placeId, table.channelId, table.userId],
    }),
    foreignKey({
      name: 'chat_read_state_channel_place_fkey',
      columns: [table.placeId, table.channelId],
      foreignColumns: [chatChannels.placeId, chatChannels.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'chat_read_state_message_place_fkey',
      columns: [table.placeId, table.lastReadMessageId],
      foreignColumns: [chatMessages.placeId, chatMessages.id],
    }).onDelete('set null'),
    index('chat_read_state_user_id_updated_at_idx').on(
      table.userId,
      table.updatedAt,
    ),
    index('chat_read_state_place_message_idx').on(
      table.placeId,
      table.lastReadMessageId,
    ),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    placeId: uuid('place_id').references(() => places.id, {
      onDelete: 'cascade',
    }),
    type: text('type').notNull(),
    payload: jsonb('payload')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(emptyJsonObject),
    readAt: timestamp('read_at', { withTimezone: true }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('notifications_user_created_at_id_idx').on(
      table.userId,
      table.createdAt,
      table.id,
    ),
    index('notifications_user_unread_idx')
      .on(table.userId, table.createdAt, table.id)
      .where(sql`${table.readAt} is null and ${table.dismissedAt} is null`),
    index('notifications_place_id_idx').on(table.placeId),
    check(
      'notifications_type_length_check',
      sql`char_length(btrim(${table.type})) between 1 and 100`,
    ),
  ],
);