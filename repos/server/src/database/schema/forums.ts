import { sql } from 'drizzle-orm';
import {
  boolean,
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
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { uuidV7Default } from './common.js';
import { users } from './identity.js';
import { places } from './places.js';

export type RichTextDocument = {
  content?: RichTextNode[];
  type: 'doc';
  version: 1;
};

export type RichTextNode = {
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  marks?: Array<{ attrs?: Record<string, unknown>; type: string }>;
  text?: string;
  type: string;
};

export const forumVisibility = pgEnum('forum_visibility', [
  'public',
  'members',
]);
export const topicStatus = pgEnum('topic_status', ['open', 'locked']);

export const forumGroups = pgTable(
  'forum_groups',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('forum_groups_place_id_id_unique').on(table.placeId, table.id),
    uniqueIndex('forum_groups_place_id_name_unique').on(
      table.placeId,
      sql`lower(${table.name})`,
    ),
    index('forum_groups_place_id_position_id_idx').on(
      table.placeId,
      table.position,
      table.id,
    ),
    check(
      'forum_groups_name_length_check',
      sql`char_length(btrim(${table.name})) between 1 and 120`,
    ),
    check('forum_groups_position_check', sql`${table.position} >= 0`),
  ],
);

export const forums = pgTable(
  'forums',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    position: integer('position').notNull().default(0),
    visibility: forumVisibility('visibility').notNull().default('public'),
    readPermission: text('read_permission'),
    writePermission: text('write_permission'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('forums_place_id_id_unique').on(table.placeId, table.id),
    foreignKey({
      name: 'forums_group_place_fkey',
      columns: [table.placeId, table.groupId],
      foreignColumns: [forumGroups.placeId, forumGroups.id],
    }).onDelete('cascade'),
    uniqueIndex('forums_group_id_name_unique').on(
      table.groupId,
      sql`lower(${table.name})`,
    ),
    index('forums_place_id_group_id_position_id_idx').on(
      table.placeId,
      table.groupId,
      table.position,
      table.id,
    ),
    index('forums_group_id_idx').on(table.groupId),
    check(
      'forums_name_length_check',
      sql`char_length(btrim(${table.name})) between 1 and 120`,
    ),
    check('forums_position_check', sql`${table.position} >= 0`),
  ],
);

export const forumTags = pgTable(
  'forum_tags',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    color: text('color'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('forum_tags_place_id_id_unique').on(table.placeId, table.id),
    uniqueIndex('forum_tags_place_id_slug_unique').on(
      table.placeId,
      table.slug,
    ),
    index('forum_tags_place_id_name_id_idx').on(
      table.placeId,
      table.name,
      table.id,
    ),
    check(
      'forum_tags_slug_format_check',
      sql`${table.slug} = lower(${table.slug}) and ${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(${table.slug}) between 1 and 50`,
    ),
    check(
      'forum_tags_name_length_check',
      sql`char_length(btrim(${table.name})) between 1 and 50`,
    ),
    check(
      'forum_tags_color_check',
      sql`${table.color} is null or ${table.color} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
  ],
);

export const topics = pgTable(
  'topics',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    forumId: uuid('forum_id').notNull(),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    status: topicStatus('status').notNull().default('open'),
    isPinned: boolean('is_pinned').notNull().default(false),
    replyCount: integer('reply_count').notNull().default(0),
    viewCount: integer('view_count').notNull().default(0),
    latestPostAt: timestamp('latest_post_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('topics_place_id_id_unique').on(table.placeId, table.id),
    foreignKey({
      name: 'topics_forum_place_fkey',
      columns: [table.placeId, table.forumId],
      foreignColumns: [forums.placeId, forums.id],
    }).onDelete('cascade'),
    index('topics_place_id_forum_id_idx').on(table.placeId, table.forumId),
    index('topics_forum_latest_post_at_id_idx').on(
      table.forumId,
      table.latestPostAt,
      table.id,
    ),
    index('topics_place_latest_post_at_id_idx').on(
      table.placeId,
      table.latestPostAt,
      table.id,
    ),
    index('topics_place_latest_feed_idx')
      .on(table.placeId, table.isPinned, table.latestPostAt, table.id)
      .where(sql`${table.deletedAt} is null`),
    index('topics_forum_latest_feed_idx')
      .on(table.forumId, table.isPinned, table.latestPostAt, table.id)
      .where(sql`${table.deletedAt} is null`),
    index('topics_place_popular_feed_idx')
      .on(table.placeId, table.replyCount, table.latestPostAt, table.id)
      .where(sql`${table.deletedAt} is null`),
    index('topics_place_created_at_id_idx').on(
      table.placeId,
      table.createdAt,
      table.id,
    ),
    index('topics_author_user_id_idx').on(table.authorUserId),
    check(
      'topics_title_length_check',
      sql`char_length(btrim(${table.title})) between 1 and 300`,
    ),
    check('topics_reply_count_check', sql`${table.replyCount} >= 0`),
    check('topics_view_count_check', sql`${table.viewCount} >= 0`),
  ],
);

export const topicTags = pgTable(
  'topic_tags',
  {
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id').notNull(),
    tagId: uuid('tag_id').notNull(),
  },
  (table) => [
    primaryKey({
      name: 'topic_tags_pkey',
      columns: [table.placeId, table.topicId, table.tagId],
    }),
    foreignKey({
      name: 'topic_tags_topic_place_fkey',
      columns: [table.placeId, table.topicId],
      foreignColumns: [topics.placeId, topics.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'topic_tags_tag_place_fkey',
      columns: [table.placeId, table.tagId],
      foreignColumns: [forumTags.placeId, forumTags.id],
    }).onDelete('cascade'),
    index('topic_tags_place_id_tag_id_topic_id_idx').on(
      table.placeId,
      table.tagId,
      table.topicId,
    ),
  ],
);

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id').notNull(),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    document: jsonb('document').$type<RichTextDocument>().notNull(),
    sanitizedHtml: text('sanitized_html').notNull(),
    plainText: text('plain_text').notNull(),
    version: integer('version').notNull().default(1),
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
    unique('posts_place_id_id_unique').on(table.placeId, table.id),
    unique('posts_place_id_topic_id_id_unique').on(
      table.placeId,
      table.topicId,
      table.id,
    ),
    foreignKey({
      name: 'posts_topic_place_fkey',
      columns: [table.placeId, table.topicId],
      foreignColumns: [topics.placeId, topics.id],
    }).onDelete('cascade'),
    index('posts_place_id_topic_id_idx').on(table.placeId, table.topicId),
    index('posts_topic_id_created_at_id_idx').on(
      table.topicId,
      table.createdAt,
      table.id,
    ),
    index('posts_author_user_id_idx').on(table.authorUserId),
    index('posts_deleted_by_user_id_idx').on(table.deletedByUserId),
    check('posts_version_check', sql`${table.version} > 0`),
    check(
      'posts_plain_text_length_check',
      sql`char_length(${table.plainText}) between 1 and 50000`,
    ),
  ],
);

export const postRevisions = pgTable(
  'post_revisions',
  {
    id: uuid('id').primaryKey().default(uuidV7Default),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    postId: uuid('post_id').notNull(),
    editorUserId: uuid('editor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    document: jsonb('document').$type<RichTextDocument>().notNull(),
    sanitizedHtml: text('sanitized_html').notNull(),
    plainText: text('plain_text').notNull(),
    version: integer('version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'post_revisions_post_place_fkey',
      columns: [table.placeId, table.postId],
      foreignColumns: [posts.placeId, posts.id],
    }).onDelete('cascade'),
    uniqueIndex('post_revisions_post_id_version_unique').on(
      table.postId,
      table.version,
    ),
    index('post_revisions_place_id_post_id_created_at_id_idx').on(
      table.placeId,
      table.postId,
      table.createdAt,
      table.id,
    ),
    index('post_revisions_editor_user_id_idx').on(table.editorUserId),
    check('post_revisions_version_check', sql`${table.version} > 0`),
  ],
);

export const postMentions = pgTable(
  'post_mentions',
  {
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    postId: uuid('post_id').notNull(),
    mentionedUserId: uuid('mentioned_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'post_mentions_pkey',
      columns: [table.placeId, table.postId, table.mentionedUserId],
    }),
    foreignKey({
      name: 'post_mentions_post_place_fkey',
      columns: [table.placeId, table.postId],
      foreignColumns: [posts.placeId, posts.id],
    }).onDelete('cascade'),
    index('post_mentions_mentioned_user_id_created_at_idx').on(
      table.mentionedUserId,
      table.createdAt,
    ),
  ],
);

export const postReactions = pgTable(
  'post_reactions',
  {
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    postId: uuid('post_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reaction: text('reaction').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'post_reactions_pkey',
      columns: [table.placeId, table.postId, table.userId, table.reaction],
    }),
    foreignKey({
      name: 'post_reactions_post_place_fkey',
      columns: [table.placeId, table.postId],
      foreignColumns: [posts.placeId, posts.id],
    }).onDelete('cascade'),
    index('post_reactions_post_id_reaction_idx').on(
      table.postId,
      table.reaction,
    ),
    index('post_reactions_user_id_idx').on(table.userId),
    check(
      'post_reactions_reaction_check',
      sql`${table.reaction} ~ '^[a-z0-9_+-]{1,40}$'`,
    ),
  ],
);

export const topicFollows = pgTable(
  'topic_follows',
  {
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'topic_follows_pkey',
      columns: [table.placeId, table.topicId, table.userId],
    }),
    foreignKey({
      name: 'topic_follows_topic_place_fkey',
      columns: [table.placeId, table.topicId],
      foreignColumns: [topics.placeId, topics.id],
    }).onDelete('cascade'),
    index('topic_follows_user_id_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
    index('topic_follows_user_id_topic_id_idx').on(table.userId, table.topicId),
  ],
);

export const topicViewFlushes = pgTable(
  'topic_view_flushes',
  {
    id: uuid('id').primaryKey(),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    count: integer('count').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('topic_view_flushes_topic_id_processed_at_idx').on(
      table.topicId,
      table.processedAt,
    ),
    check('topic_view_flushes_count_check', sql`${table.count} > 0`),
  ],
);

export const savedTopics = pgTable(
  'saved_topics',
  {
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'saved_topics_pkey',
      columns: [table.placeId, table.topicId, table.userId],
    }),
    foreignKey({
      name: 'saved_topics_topic_place_fkey',
      columns: [table.placeId, table.topicId],
      foreignColumns: [topics.placeId, topics.id],
    }).onDelete('cascade'),
    index('saved_topics_user_id_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export const savedPosts = pgTable(
  'saved_posts',
  {
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    postId: uuid('post_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'saved_posts_pkey',
      columns: [table.placeId, table.postId, table.userId],
    }),
    foreignKey({
      name: 'saved_posts_post_place_fkey',
      columns: [table.placeId, table.postId],
      foreignColumns: [posts.placeId, posts.id],
    }).onDelete('cascade'),
    index('saved_posts_user_id_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export const topicReadState = pgTable(
  'topic_read_state',
  {
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lastReadPostId: uuid('last_read_post_id'),
    readAt: timestamp('read_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'topic_read_state_pkey',
      columns: [table.placeId, table.topicId, table.userId],
    }),
    foreignKey({
      name: 'topic_read_state_topic_place_fkey',
      columns: [table.placeId, table.topicId],
      foreignColumns: [topics.placeId, topics.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'topic_read_state_last_read_post_fkey',
      columns: [table.placeId, table.topicId, table.lastReadPostId],
      foreignColumns: [posts.placeId, posts.topicId, posts.id],
    }).onDelete('cascade'),
    index('topic_read_state_user_id_read_at_idx').on(
      table.userId,
      table.readAt,
    ),
    index('topic_read_state_place_topic_last_read_post_idx').on(
      table.placeId,
      table.topicId,
      table.lastReadPostId,
    ),
  ],
);