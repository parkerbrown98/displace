import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type {
  Database,
  DatabaseTransaction,
} from '../database/database.types.js';
import {
  auditLog,
  assets,
  forumGroups,
  forums,
  forumTags,
  idempotencyKeys,
  outboxEvents,
  postMentions,
  postAssets,
  postReactions,
  postRevisions,
  posts,
  placeMembers,
  places,
  savedPosts,
  savedTopics,
  topicFollows,
  topicReadState,
  topics,
  topicTags,
  topicViewFlushes,
  users,
  type RichTextDocument,
} from '../database/schema/index.js';
import type {
  CreateForumDto,
  CreateForumGroupDto,
  CreateForumTagDto,
  UpdateForumDto,
  UpdateForumGroupDto,
} from './forums.dto.js';

export interface ForumContentInput {
  assetIds: string[];
  document: RichTextDocument;
  html: string;
  mentions: string[];
  text: string;
}

export interface TopicCursor {
  id: string;
  isPinned?: boolean;
  latestPostAt: Date;
  replyCount?: number;
}

export interface PostCursor {
  createdAt: Date;
  id: string;
}

export interface SavedItemCursor {
  id: string;
  savedAt: Date;
}

export interface IdempotentCreate {
  key: string;
  requestHash: string;
}

export interface TopicPreviewImage {
  alt: string;
  assetId: string;
}

function firstImage(node: RichTextDocument | Record<string, unknown>): TopicPreviewImage | null {
  const attrs = 'attrs' in node ? node.attrs : undefined;
  if (node.type === 'image' && attrs && typeof attrs === 'object') {
    const imageAttrs = attrs as Record<string, unknown>;
    const assetId = imageAttrs.assetId;
    const alt = imageAttrs.alt;
    if (typeof assetId === 'string') {
      return { alt: typeof alt === 'string' ? alt : '', assetId };
    }
  }
  const content = 'content' in node ? node.content : undefined;
  if (!Array.isArray(content)) return null;
  for (const child of content) {
    const image = firstImage(child);
    if (image) return image;
  }
  return null;
}

@Injectable()
export class ForumsRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async replayTopicCreation(
    placeId: string,
    forumId: string,
    userId: string,
    idempotency: IdempotentCreate,
    now: Date,
  ) {
    return this.replayIdempotency<Record<string, unknown>>({
      ...idempotency,
      now,
      placeId,
      scope: this.topicCreationScope(placeId, forumId, userId),
      userId,
    });
  }

  async replayReply(
    placeId: string,
    topicId: string,
    userId: string,
    idempotency: IdempotentCreate,
    now: Date,
  ) {
    return this.replayIdempotency<Record<string, unknown>>({
      ...idempotency,
      now,
      placeId,
      scope: this.replyScope(placeId, topicId, userId),
      userId,
    });
  }

  async navigation(placeId: string) {
    const [groups, forumRecords, tags] = await Promise.all([
      this.database
        .select()
        .from(forumGroups)
        .where(eq(forumGroups.placeId, placeId))
        .orderBy(asc(forumGroups.position), asc(forumGroups.id)),
      this.database
        .select()
        .from(forums)
        .where(and(eq(forums.placeId, placeId), isNull(forums.archivedAt)))
        .orderBy(asc(forums.position), asc(forums.id)),
      this.database
        .select()
        .from(forumTags)
        .where(eq(forumTags.placeId, placeId))
        .orderBy(asc(forumTags.name), asc(forumTags.id)),
    ]);
    return { forums: forumRecords, groups, tags };
  }

  async findForum(placeId: string, forumId: string) {
    const [record] = await this.database
      .select()
      .from(forums)
      .where(
        and(
          eq(forums.placeId, placeId),
          eq(forums.id, forumId),
          isNull(forums.archivedAt),
        ),
      )
      .limit(1);
    return record;
  }

  async createGroup(
    placeId: string,
    actorUserId: string,
    input: CreateForumGroupDto,
  ) {
    return this.database.transaction(async (transaction) => {
      const [record] = await transaction
        .insert(forumGroups)
        .values({
          description: input.description,
          name: input.name,
          placeId,
          position: input.position,
        })
        .returning();
      if (!record) throw new Error('Forum group creation returned no record.');
      await this.audit(
        transaction,
        placeId,
        actorUserId,
        'forum_group.created',
        record.id,
      );
      return record;
    });
  }

  async updateGroup(
    placeId: string,
    groupId: string,
    actorUserId: string,
    input: UpdateForumGroupDto,
    now: Date,
  ) {
    return this.database.transaction(async (transaction) => {
      const [record] = await transaction
        .update(forumGroups)
        .set({
          description: input.description,
          name: input.name,
          position: input.position,
          updatedAt: now,
        })
        .where(
          and(eq(forumGroups.placeId, placeId), eq(forumGroups.id, groupId)),
        )
        .returning();
      if (record) {
        await this.audit(
          transaction,
          placeId,
          actorUserId,
          'forum_group.updated',
          groupId,
        );
      }
      return record;
    });
  }

  async deleteGroup(placeId: string, groupId: string, actorUserId: string) {
    return this.database.transaction(async (transaction) => {
      const [group] = await transaction
        .select({ id: forumGroups.id })
        .from(forumGroups)
        .where(
          and(eq(forumGroups.placeId, placeId), eq(forumGroups.id, groupId)),
        )
        .limit(1)
        .for('update');
      if (!group) return 'missing' as const;
      const [child] = await transaction
        .select({ id: forums.id })
        .from(forums)
        .where(and(eq(forums.placeId, placeId), eq(forums.groupId, groupId)))
        .limit(1);
      if (child) return 'not-empty' as const;
      const [record] = await transaction
        .delete(forumGroups)
        .where(
          and(eq(forumGroups.placeId, placeId), eq(forumGroups.id, groupId)),
        )
        .returning({ id: forumGroups.id });
      if (record) {
        await this.audit(
          transaction,
          placeId,
          actorUserId,
          'forum_group.deleted',
          groupId,
        );
      }
      return record ? ('deleted' as const) : ('missing' as const);
    });
  }

  async createForum(
    placeId: string,
    actorUserId: string,
    input: CreateForumDto,
  ) {
    return this.database.transaction(async (transaction) => {
      const [group] = await transaction
        .select({ id: forumGroups.id })
        .from(forumGroups)
        .where(
          and(
            eq(forumGroups.placeId, placeId),
            eq(forumGroups.id, input.groupId),
          ),
        )
        .limit(1);
      if (!group) return undefined;
      const [record] = await transaction
        .insert(forums)
        .values({
          description: input.description,
          groupId: input.groupId,
          name: input.name,
          placeId,
          position: input.position,
          readPermission: input.readPermission,
          visibility: input.visibility,
          writePermission: input.writePermission,
        })
        .returning();
      if (!record) throw new Error('Forum creation returned no record.');
      await this.audit(
        transaction,
        placeId,
        actorUserId,
        'forum.created',
        record.id,
      );
      return record;
    });
  }

  async updateForum(
    placeId: string,
    forumId: string,
    actorUserId: string,
    input: UpdateForumDto,
    now: Date,
  ) {
    return this.database.transaction(async (transaction) => {
      if (input.groupId) {
        const [group] = await transaction
          .select({ id: forumGroups.id })
          .from(forumGroups)
          .where(
            and(
              eq(forumGroups.placeId, placeId),
              eq(forumGroups.id, input.groupId),
            ),
          )
          .limit(1);
        if (!group) return undefined;
      }
      const [record] = await transaction
        .update(forums)
        .set({
          description: input.description,
          groupId: input.groupId,
          name: input.name,
          position: input.position,
          readPermission: input.readPermission,
          updatedAt: now,
          visibility: input.visibility,
          writePermission: input.writePermission,
        })
        .where(
          and(
            eq(forums.placeId, placeId),
            eq(forums.id, forumId),
            isNull(forums.archivedAt),
          ),
        )
        .returning();
      if (record) {
        await this.audit(
          transaction,
          placeId,
          actorUserId,
          'forum.updated',
          forumId,
        );
        await this.emit(transaction, 'forum.updated', forumId, { placeId });
      }
      return record;
    });
  }

  async archiveForum(
    placeId: string,
    forumId: string,
    actorUserId: string,
    now: Date,
  ) {
    return this.database.transaction(async (transaction) => {
      const [record] = await transaction
        .update(forums)
        .set({ archivedAt: now, updatedAt: now })
        .where(
          and(
            eq(forums.placeId, placeId),
            eq(forums.id, forumId),
            isNull(forums.archivedAt),
          ),
        )
        .returning({ id: forums.id });
      if (record) {
        await this.audit(
          transaction,
          placeId,
          actorUserId,
          'forum.archived',
          forumId,
        );
        await this.emit(transaction, 'forum.archived', forumId, { placeId });
      }
      return record;
    });
  }

  async createTag(
    placeId: string,
    actorUserId: string,
    input: CreateForumTagDto,
  ) {
    return this.database.transaction(async (transaction) => {
      const [record] = await transaction
        .insert(forumTags)
        .values({
          color: input.color,
          name: input.name,
          placeId,
          slug: input.slug,
        })
        .returning();
      if (!record) throw new Error('Forum tag creation returned no record.');
      await this.audit(
        transaction,
        placeId,
        actorUserId,
        'forum_tag.created',
        record.id,
      );
      return record;
    });
  }

  async deleteTag(placeId: string, tagId: string, actorUserId: string) {
    return this.database.transaction(async (transaction) => {
      const [record] = await transaction
        .delete(forumTags)
        .where(and(eq(forumTags.placeId, placeId), eq(forumTags.id, tagId)))
        .returning({ id: forumTags.id });
      if (record) {
        await this.audit(
          transaction,
          placeId,
          actorUserId,
          'forum_tag.deleted',
          tagId,
        );
      }
      return record;
    });
  }

  async createTopic(
    placeId: string,
    forumId: string,
    authorUserId: string,
    title: string,
    tagIds: string[],
    content: ForumContentInput,
    idempotency: IdempotentCreate,
    now: Date,
  ) {
    return this.database.transaction(async (transaction) => {
      const claim = await this.claimIdempotency<Record<string, unknown>>(
        transaction,
        {
          ...idempotency,
          now,
          placeId,
          scope: this.topicCreationScope(placeId, forumId, authorUserId),
          userId: authorUserId,
        },
      );
      if (claim.response) return claim.response;
      if (!(await this.tagsExist(transaction, placeId, tagIds))) {
        throw new BadRequestException('One or more tag IDs are invalid.');
      }
      const [topic] = await transaction
        .insert(topics)
        .values({ authorUserId, forumId, latestPostAt: now, placeId, title })
        .returning();
      if (!topic) throw new Error('Topic creation returned no record.');
      await this.insertPost(
        transaction,
        placeId,
        topic.id,
        authorUserId,
        content,
        now,
      );
      if (tagIds.length > 0) {
        await transaction
          .insert(topicTags)
          .values(
            tagIds.map((tagId) => ({ placeId, tagId, topicId: topic.id })),
          );
      }
      await this.emit(transaction, 'topic.created', topic.id, {
        placeId,
        forumId,
      });
      await this.audit(
        transaction,
        placeId,
        authorUserId,
        'topic.created',
        topic.id,
      );
      const tagRecords =
        tagIds.length > 0
          ? await transaction
              .select()
              .from(forumTags)
              .where(
                and(
                  eq(forumTags.placeId, placeId),
                  inArray(forumTags.id, tagIds),
                ),
              )
          : [];
      const [author] = await transaction
        .select({
          displayName: users.displayName,
          handle: users.handle,
          id: users.id,
          joinedAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, authorUserId))
        .limit(1);
      if (!author) throw new Error('Topic author was not found.');
      const response = {
        author,
        authorUserId: topic.authorUserId,
        createdAt: topic.createdAt,
        forumId: topic.forumId,
        id: topic.id,
        isPinned: topic.isPinned,
        latestPostAt: topic.latestPostAt,
        previewImage: firstImage(content.document),
        replyCount: topic.replyCount,
        status: topic.status,
        tags: tagRecords.map((tag) => ({
          color: tag.color,
          id: tag.id,
          name: tag.name,
          slug: tag.slug,
        })),
        title: topic.title,
        viewCount: topic.viewCount,
      };
      await this.completeIdempotency(transaction, claim.id, response, now);
      return response;
    });
  }

  async listTopics(options: {
    cursor?: TopicCursor;
    feed: 'latest' | 'popular' | 'following';
    forumIds: string[];
    limit: number;
    placeId: string;
    tag?: string;
    userId?: string;
  }) {
    if (options.forumIds.length === 0) return [];
    const cursor = options.cursor
      ? options.feed === 'popular'
        ? or(
            lt(topics.replyCount, options.cursor.replyCount ?? 0),
            and(
              eq(topics.replyCount, options.cursor.replyCount ?? 0),
              lt(topics.latestPostAt, options.cursor.latestPostAt),
            ),
            and(
              eq(topics.replyCount, options.cursor.replyCount ?? 0),
              eq(topics.latestPostAt, options.cursor.latestPostAt),
              lt(topics.id, options.cursor.id),
            ),
          )
        : or(
            options.cursor.isPinned ? eq(topics.isPinned, false) : undefined,
            and(
              eq(topics.isPinned, options.cursor.isPinned ?? false),
              or(
                lt(topics.latestPostAt, options.cursor.latestPostAt),
                and(
                  eq(topics.latestPostAt, options.cursor.latestPostAt),
                  lt(topics.id, options.cursor.id),
                ),
              ),
            ),
          )
      : undefined;
    const records = await this.database
      .select()
      .from(topics)
      .where(
        and(
          eq(topics.placeId, options.placeId),
          inArray(topics.forumId, options.forumIds),
          isNull(topics.deletedAt),
          options.feed === 'following'
            ? sql`exists (select 1 from ${topicFollows} where ${topicFollows.topicId} = ${topics.id} and ${topicFollows.userId} = ${options.userId})`
            : undefined,
          options.tag
            ? sql`exists (select 1 from ${topicTags} inner join ${forumTags} on ${forumTags.id} = ${topicTags.tagId} where ${topicTags.topicId} = ${topics.id} and ${forumTags.placeId} = ${options.placeId} and ${forumTags.slug} = ${options.tag})`
            : undefined,
          cursor,
        ),
      )
      .orderBy(
        ...(options.feed === 'popular'
          ? [
              desc(topics.replyCount),
              desc(topics.latestPostAt),
              desc(topics.id),
            ]
          : [
              desc(topics.isPinned),
              desc(topics.latestPostAt),
              desc(topics.id),
            ]),
      )
      .limit(Math.min(Math.max(options.limit, 1), 100) + 1);
    return this.attachTopicMetadata(options.placeId, records);
  }

  async findTopic(placeId: string, topicId: string) {
    const [record] = await this.database
      .select()
      .from(topics)
      .where(
        and(
          eq(topics.placeId, placeId),
          eq(topics.id, topicId),
          isNull(topics.deletedAt),
        ),
      )
      .limit(1);
    if (!record) return undefined;
    return (await this.attachTopicMetadata(placeId, [record]))[0];
  }

  async listSavedTopics(
    userId: string,
    cursor: SavedItemCursor | undefined,
    limit: number,
  ) {
    return this.database
      .select({
        placeId: places.id,
        placeName: places.name,
        placeSlug: places.slug,
        savedAt: savedTopics.createdAt,
        topic: topics,
      })
      .from(savedTopics)
      .innerJoin(
        topics,
        and(
          eq(topics.placeId, savedTopics.placeId),
          eq(topics.id, savedTopics.topicId),
        ),
      )
      .innerJoin(places, eq(places.id, savedTopics.placeId))
      .where(
        and(
          eq(savedTopics.userId, userId),
          isNull(topics.deletedAt),
          isNull(places.archivedAt),
          cursor
            ? or(
                lt(savedTopics.createdAt, cursor.savedAt),
                and(
                  eq(savedTopics.createdAt, cursor.savedAt),
                  lt(topics.id, cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(savedTopics.createdAt), desc(topics.id))
      .limit(Math.min(Math.max(limit, 1), 100) + 1);
  }

  async listSavedPosts(
    userId: string,
    cursor: SavedItemCursor | undefined,
    limit: number,
  ) {
    return this.database
      .select({
        placeId: places.id,
        placeName: places.name,
        placeSlug: places.slug,
        post: posts,
        savedAt: savedPosts.createdAt,
        topicTitle: topics.title,
      })
      .from(savedPosts)
      .innerJoin(
        posts,
        and(
          eq(posts.placeId, savedPosts.placeId),
          eq(posts.id, savedPosts.postId),
        ),
      )
      .innerJoin(
        topics,
        and(eq(topics.placeId, posts.placeId), eq(topics.id, posts.topicId)),
      )
      .innerJoin(places, eq(places.id, savedPosts.placeId))
      .where(
        and(
          eq(savedPosts.userId, userId),
          isNull(posts.deletedAt),
          isNull(topics.deletedAt),
          isNull(places.archivedAt),
          cursor
            ? or(
                lt(savedPosts.createdAt, cursor.savedAt),
                and(
                  eq(savedPosts.createdAt, cursor.savedAt),
                  lt(posts.id, cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(savedPosts.createdAt), desc(posts.id))
      .limit(Math.min(Math.max(limit, 1), 100) + 1);
  }

  async listPosts(
    placeId: string,
    topicId: string,
    cursor: PostCursor | undefined,
    limit: number,
  ) {
    return this.database
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.placeId, placeId),
          eq(posts.topicId, topicId),
          cursor
            ? or(
                sql`${posts.createdAt} > ${cursor.createdAt}`,
                and(
                  eq(posts.createdAt, cursor.createdAt),
                  sql`${posts.id} > ${cursor.id}`,
                ),
              )
            : undefined,
        ),
      )
      .orderBy(asc(posts.createdAt), asc(posts.id))
      .limit(Math.min(Math.max(limit, 1), 100) + 1);
  }

  async listPostAuthors(userIds: string[]) {
    if (userIds.length === 0) return [];
    return this.database
      .select({
        displayName: users.displayName,
        handle: users.handle,
        id: users.id,
        joinedAt: users.createdAt,
      })
      .from(users)
      .where(inArray(users.id, [...new Set(userIds)]));
  }

  async reply(
    placeId: string,
    topicId: string,
    authorUserId: string,
    content: ForumContentInput,
    idempotency: IdempotentCreate,
    now: Date,
  ) {
    return this.database.transaction(async (transaction) => {
      const claim = await this.claimIdempotency<Record<string, unknown>>(
        transaction,
        {
          ...idempotency,
          now,
          placeId,
          scope: this.replyScope(placeId, topicId, authorUserId),
          userId: authorUserId,
        },
      );
      if (claim.response) return claim.response;
      const [topic] = await transaction
        .select({ id: topics.id })
        .from(topics)
        .where(
          and(
            eq(topics.placeId, placeId),
            eq(topics.id, topicId),
            eq(topics.status, 'open'),
            isNull(topics.deletedAt),
          ),
        )
        .limit(1)
        .for('update');
      if (!topic)
        throw new ConflictException('Topic is locked or unavailable.');
      const post = await this.insertPost(
        transaction,
        placeId,
        topicId,
        authorUserId,
        content,
        now,
      );
      await transaction
        .update(topics)
        .set({
          latestPostAt: sql`greatest(${topics.latestPostAt}, ${now})`,
          replyCount: sql`${topics.replyCount} + 1`,
          updatedAt: now,
        })
        .where(and(eq(topics.placeId, placeId), eq(topics.id, topicId)));
      await this.emit(transaction, 'post.created', post.id, {
        placeId,
        topicId,
      });
      const response = {
        authorUserId: post.authorUserId,
        createdAt: post.createdAt,
        document: post.document,
        id: post.id,
        isDeleted: false,
        plainText: post.plainText,
        reactions: [],
        sanitizedHtml: post.sanitizedHtml,
        topicId: post.topicId,
        updatedAt: post.updatedAt,
        version: post.version,
      };
      await this.completeIdempotency(transaction, claim.id, response, now);
      return response;
    });
  }

  async updateTopic(
    placeId: string,
    topicId: string,
    actorUserId: string,
    allowLocked: boolean,
    values: { tagIds?: string[]; title?: string },
    now: Date,
  ) {
    return this.database.transaction(async (transaction) => {
      await this.lockTopicForMutation(
        transaction,
        placeId,
        topicId,
        allowLocked,
      );
      if (
        values.tagIds &&
        !(await this.tagsExist(transaction, placeId, values.tagIds))
      ) {
        return undefined;
      }
      const [record] = await transaction
        .update(topics)
        .set({ title: values.title, updatedAt: now })
        .where(
          and(
            eq(topics.placeId, placeId),
            eq(topics.id, topicId),
            isNull(topics.deletedAt),
          ),
        )
        .returning();
      if (!record) return undefined;
      if (values.tagIds) {
        await transaction
          .delete(topicTags)
          .where(
            and(eq(topicTags.placeId, placeId), eq(topicTags.topicId, topicId)),
          );
        if (values.tagIds.length > 0) {
          await transaction
            .insert(topicTags)
            .values(
              values.tagIds.map((tagId) => ({ placeId, tagId, topicId })),
            );
        }
      }
      await this.audit(
        transaction,
        placeId,
        actorUserId,
        'topic.updated',
        topicId,
      );
      await this.emit(transaction, 'topic.updated', topicId, { placeId });
      return record;
    });
  }

  async editPost(
    placeId: string,
    postId: string,
    topicId: string,
    editorUserId: string,
    allowLocked: boolean,
    expectedVersion: number,
    content: ForumContentInput,
    now: Date,
  ) {
    return this.database.transaction(async (transaction) => {
      await this.lockTopicForMutation(
        transaction,
        placeId,
        topicId,
        allowLocked,
      );
      const nextVersion = expectedVersion + 1;
      const [record] = await transaction
        .update(posts)
        .set({
          document: content.document,
          plainText: content.text,
          sanitizedHtml: content.html,
          updatedAt: now,
          version: nextVersion,
        })
        .where(
          and(
            eq(posts.placeId, placeId),
            eq(posts.id, postId),
            eq(posts.version, expectedVersion),
            isNull(posts.deletedAt),
          ),
        )
        .returning();
      if (!record) throw new ConflictException('Post was changed or deleted.');
      await transaction.insert(postRevisions).values({
        document: content.document,
        editorUserId,
        placeId,
        plainText: content.text,
        postId,
        sanitizedHtml: content.html,
        version: nextVersion,
      });
      await this.replaceMentions(
        transaction,
        placeId,
        postId,
        content.mentions,
      );
      await this.replaceAssets(transaction, placeId, postId, content.assetIds);
      await this.audit(
        transaction,
        placeId,
        editorUserId,
        'post.edited',
        postId,
      );
      await this.emit(transaction, 'post.updated', postId, {
        placeId,
        topicId: record.topicId,
      });
      return record;
    });
  }

  async findPost(placeId: string, postId: string) {
    const [record] = await this.database
      .select()
      .from(posts)
      .where(and(eq(posts.placeId, placeId), eq(posts.id, postId)))
      .limit(1);
    return record;
  }

  async listReactionSummaries(
    placeId: string,
    postIds: string[],
    userId?: string,
  ) {
    if (postIds.length === 0) return [];
    const [totals, own] = await Promise.all([
      this.database
        .select({
          count: count(),
          postId: postReactions.postId,
          reaction: postReactions.reaction,
        })
        .from(postReactions)
        .where(
          and(
            eq(postReactions.placeId, placeId),
            inArray(postReactions.postId, postIds),
          ),
        )
        .groupBy(postReactions.postId, postReactions.reaction),
      userId
        ? this.database
            .select({
              postId: postReactions.postId,
              reaction: postReactions.reaction,
            })
            .from(postReactions)
            .where(
              and(
                eq(postReactions.placeId, placeId),
                inArray(postReactions.postId, postIds),
                eq(postReactions.userId, userId),
              ),
            )
        : Promise.resolve([]),
    ]);
    const ownKeys = new Set(
      own.map((item) => `${item.postId}:${item.reaction}`),
    );
    return totals.map((item) => ({
      ...item,
      reacted: ownKeys.has(`${item.postId}:${item.reaction}`),
    }));
  }

  async deletePost(
    placeId: string,
    postId: string,
    topicId: string,
    actorUserId: string,
    allowLocked: boolean,
    now: Date,
  ) {
    return this.database.transaction(async (transaction) => {
      await this.lockTopicForMutation(
        transaction,
        placeId,
        topicId,
        allowLocked,
      );
      const [record] = await transaction
        .update(posts)
        .set({ deletedAt: now, deletedByUserId: actorUserId, updatedAt: now })
        .where(
          and(
            eq(posts.placeId, placeId),
            eq(posts.id, postId),
            isNull(posts.deletedAt),
          ),
        )
        .returning();
      if (record) {
        await this.audit(
          transaction,
          placeId,
          actorUserId,
          'post.deleted',
          postId,
        );
        await this.emit(transaction, 'post.deleted', postId, {
          placeId,
          topicId: record.topicId,
        });
      }
      return record;
    });
  }

  async deleteTopic(
    placeId: string,
    topicId: string,
    actorUserId: string,
    allowLocked: boolean,
    now: Date,
  ) {
    return this.database.transaction(async (transaction) => {
      await this.lockTopicForMutation(
        transaction,
        placeId,
        topicId,
        allowLocked,
      );
      const [record] = await transaction
        .update(topics)
        .set({ deletedAt: now, updatedAt: now })
        .where(
          and(
            eq(topics.placeId, placeId),
            eq(topics.id, topicId),
            isNull(topics.deletedAt),
          ),
        )
        .returning();
      if (record) {
        await this.audit(
          transaction,
          placeId,
          actorUserId,
          'topic.deleted',
          topicId,
        );
        await this.emit(transaction, 'topic.deleted', topicId, { placeId });
      }
      return record;
    });
  }

  async setTopicModeration(
    placeId: string,
    topicId: string,
    actorUserId: string,
    values: { isPinned?: boolean; status?: 'open' | 'locked' },
    now: Date,
  ) {
    return this.database.transaction(async (transaction) => {
      const [record] = await transaction
        .update(topics)
        .set({ ...values, updatedAt: now })
        .where(
          and(
            eq(topics.placeId, placeId),
            eq(topics.id, topicId),
            isNull(topics.deletedAt),
          ),
        )
        .returning();
      if (record) {
        await this.audit(
          transaction,
          placeId,
          actorUserId,
          'topic.moderated',
          topicId,
        );
        await this.emit(transaction, 'topic.updated', topicId, { placeId });
      }
      return record;
    });
  }

  async setReaction(
    placeId: string,
    postId: string,
    userId: string,
    reaction: string,
    enabled: boolean,
  ) {
    if (enabled) {
      await this.database
        .insert(postReactions)
        .values({ placeId, postId, reaction, userId })
        .onConflictDoNothing();
      return;
    }
    await this.database
      .delete(postReactions)
      .where(
        and(
          eq(postReactions.placeId, placeId),
          eq(postReactions.postId, postId),
          eq(postReactions.userId, userId),
          eq(postReactions.reaction, reaction),
        ),
      );
  }

  async setTopicRelationship(
    relationship: 'follow' | 'save',
    placeId: string,
    topicId: string,
    userId: string,
    enabled: boolean,
  ) {
    const table = relationship === 'follow' ? topicFollows : savedTopics;
    if (enabled) {
      await this.database
        .insert(table)
        .values({ placeId, topicId, userId })
        .onConflictDoNothing();
    } else {
      await this.database
        .delete(table)
        .where(
          and(
            eq(table.placeId, placeId),
            eq(table.topicId, topicId),
            eq(table.userId, userId),
          ),
        );
    }
  }

  async setPostSaved(
    placeId: string,
    postId: string,
    userId: string,
    enabled: boolean,
  ) {
    if (enabled) {
      await this.database
        .insert(savedPosts)
        .values({ placeId, postId, userId })
        .onConflictDoNothing();
    } else {
      await this.database
        .delete(savedPosts)
        .where(
          and(
            eq(savedPosts.placeId, placeId),
            eq(savedPosts.postId, postId),
            eq(savedPosts.userId, userId),
          ),
        );
    }
  }

  async markRead(
    placeId: string,
    topicId: string,
    userId: string,
    lastReadPostId: string | undefined,
    now: Date,
  ) {
    if (lastReadPostId) {
      const [post] = await this.database
        .select({ id: posts.id })
        .from(posts)
        .where(
          and(
            eq(posts.placeId, placeId),
            eq(posts.topicId, topicId),
            eq(posts.id, lastReadPostId),
          ),
        )
        .limit(1);
      if (!post) return false;
    }
    await this.database
      .insert(topicReadState)
      .values({ lastReadPostId, placeId, readAt: now, topicId, userId })
      .onConflictDoUpdate({
        target: [
          topicReadState.placeId,
          topicReadState.topicId,
          topicReadState.userId,
        ],
        set: { lastReadPostId, readAt: now },
      });
    return true;
  }

  async markUnread(placeId: string, topicId: string, userId: string) {
    await this.database
      .delete(topicReadState)
      .where(
        and(
          eq(topicReadState.placeId, placeId),
          eq(topicReadState.topicId, topicId),
          eq(topicReadState.userId, userId),
        ),
      );
  }

  async listRevisions(placeId: string, postId: string) {
    return this.database
      .select()
      .from(postRevisions)
      .where(
        and(
          eq(postRevisions.placeId, placeId),
          eq(postRevisions.postId, postId),
        ),
      )
      .orderBy(desc(postRevisions.version));
  }

  async flushViews(
    batchId: string,
    topicId: string,
    count: number,
  ): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const [topic] = await transaction
        .select({ id: topics.id })
        .from(topics)
        .where(eq(topics.id, topicId))
        .limit(1)
        .for('key share');
      if (!topic) return;
      const [inserted] = await transaction
        .insert(topicViewFlushes)
        .values({ count, id: batchId, topicId })
        .onConflictDoNothing()
        .returning({ id: topicViewFlushes.id });
      if (!inserted) return;
      await transaction
        .update(topics)
        .set({ viewCount: sql`${topics.viewCount} + ${count}` })
        .where(eq(topics.id, topicId));
    });
  }

  async pruneViewFlushes(before: Date): Promise<void> {
    await this.database
      .delete(topicViewFlushes)
      .where(lt(topicViewFlushes.processedAt, before));
  }

  private async insertPost(
    transaction: DatabaseTransaction,
    placeId: string,
    topicId: string,
    authorUserId: string,
    content: ForumContentInput,
    now: Date,
  ) {
    const [post] = await transaction
      .insert(posts)
      .values({
        authorUserId,
        createdAt: now,
        document: content.document,
        placeId,
        plainText: content.text,
        sanitizedHtml: content.html,
        topicId,
      })
      .returning();
    if (!post) throw new Error('Post creation returned no record.');
    await transaction.insert(postRevisions).values({
      document: content.document,
      editorUserId: authorUserId,
      placeId,
      plainText: content.text,
      postId: post.id,
      sanitizedHtml: content.html,
      version: 1,
    });
    await this.replaceMentions(transaction, placeId, post.id, content.mentions);
    await this.replaceAssets(transaction, placeId, post.id, content.assetIds);
    return post;
  }

  private async claimIdempotency<T>(
    transaction: DatabaseTransaction,
    options: IdempotentCreate & {
      now: Date;
      placeId: string;
      scope: string;
      userId: string;
    },
  ): Promise<{ id: string; response?: T }> {
    const expiresAt = new Date(options.now.getTime() + 24 * 60 * 60 * 1_000);
    const [created] = await transaction
      .insert(idempotencyKeys)
      .values({
        expiresAt,
        key: options.key,
        placeId: options.placeId,
        requestHash: options.requestHash,
        scope: options.scope,
        userId: options.userId,
      })
      .onConflictDoNothing()
      .returning({ id: idempotencyKeys.id });
    if (created) return created;

    const [existing] = await transaction
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.scope, options.scope),
          eq(idempotencyKeys.key, options.key),
        ),
      )
      .limit(1)
      .for('update');
    if (!existing)
      throw new ConflictException('Idempotency request is unavailable.');
    if (
      existing.requestHash !== options.requestHash &&
      existing.expiresAt > options.now
    ) {
      throw new ConflictException(
        'Idempotency-Key was already used with a different request.',
      );
    }
    if (existing.expiresAt <= options.now) {
      await transaction
        .update(idempotencyKeys)
        .set({
          expiresAt,
          placeId: options.placeId,
          requestHash: options.requestHash,
          responseBody: null,
          responseHeaders: null,
          responseStatus: null,
          status: 'processing',
          updatedAt: options.now,
          userId: options.userId,
        })
        .where(eq(idempotencyKeys.id, existing.id));
      return { id: existing.id };
    }
    if (existing.status !== 'completed' || existing.responseBody === null) {
      throw new ConflictException(
        'The idempotent request is still being processed.',
      );
    }
    return { id: existing.id, response: existing.responseBody as T };
  }

  private async replayIdempotency<T>(
    options: IdempotentCreate & {
      now: Date;
      placeId: string;
      scope: string;
      userId: string;
    },
  ): Promise<T | undefined> {
    const [existing] = await this.database
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.scope, options.scope),
          eq(idempotencyKeys.key, options.key),
          eq(idempotencyKeys.placeId, options.placeId),
          eq(idempotencyKeys.userId, options.userId),
        ),
      )
      .limit(1);
    if (!existing || existing.expiresAt <= options.now) return undefined;
    if (existing.requestHash !== options.requestHash) {
      throw new ConflictException(
        'Idempotency-Key was already used with a different request.',
      );
    }
    return existing.status === 'completed' && existing.responseBody !== null
      ? (existing.responseBody as T)
      : undefined;
  }

  private topicCreationScope(
    placeId: string,
    forumId: string,
    userId: string,
  ): string {
    return `forum.topic.create:${placeId}:${forumId}:${userId}`;
  }

  private replyScope(placeId: string, topicId: string, userId: string): string {
    return `forum.post.reply:${placeId}:${topicId}:${userId}`;
  }

  private async completeIdempotency(
    transaction: DatabaseTransaction,
    id: string,
    responseBody: unknown,
    now: Date,
  ): Promise<void> {
    await transaction
      .update(idempotencyKeys)
      .set({
        responseBody,
        responseHeaders: {},
        responseStatus: 201,
        status: 'completed',
        updatedAt: now,
      })
      .where(eq(idempotencyKeys.id, id));
  }

  private async replaceMentions(
    transaction: DatabaseTransaction,
    placeId: string,
    postId: string,
    handles: string[],
  ): Promise<void> {
    await transaction
      .delete(postMentions)
      .where(
        and(eq(postMentions.placeId, placeId), eq(postMentions.postId, postId)),
      );
    if (handles.length === 0) return;
    const mentionedUsers = await transaction
      .select({ id: users.id })
      .from(users)
      .innerJoin(
        placeMembers,
        and(
          eq(placeMembers.userId, users.id),
          eq(placeMembers.placeId, placeId),
          eq(placeMembers.status, 'active'),
        ),
      )
      .where(and(inArray(users.handle, handles), eq(users.status, 'active')));
    if (mentionedUsers.length > 0) {
      await transaction
        .insert(postMentions)
        .values(
          mentionedUsers.map((user) => ({
            mentionedUserId: user.id,
            placeId,
            postId,
          })),
        );
    }
  }

  private async replaceAssets(
    transaction: DatabaseTransaction,
    placeId: string,
    postId: string,
    assetIds: string[],
  ): Promise<void> {
    await transaction
      .delete(postAssets)
      .where(
        and(eq(postAssets.placeId, placeId), eq(postAssets.postId, postId)),
      );
    if (assetIds.length === 0) return;
    const records = await transaction
      .select({ id: assets.id })
      .from(assets)
      .where(
        and(
          eq(assets.placeId, placeId),
          eq(assets.status, 'ready'),
          inArray(assets.id, assetIds),
        ),
      );
    if (records.length !== assetIds.length) {
      throw new BadRequestException(
        'One or more asset IDs are invalid or not ready.',
      );
    }
    await transaction
      .insert(postAssets)
      .values(assetIds.map((assetId) => ({ assetId, placeId, postId })));
  }

  private async tagsExist(
    transaction: DatabaseTransaction,
    placeId: string,
    tagIds: string[],
  ) {
    if (tagIds.length === 0) return true;
    const records = await transaction
      .select({ id: forumTags.id })
      .from(forumTags)
      .where(
        and(eq(forumTags.placeId, placeId), inArray(forumTags.id, tagIds)),
      );
    return records.length === tagIds.length;
  }

  private async lockTopicForMutation(
    transaction: DatabaseTransaction,
    placeId: string,
    topicId: string,
    allowLocked: boolean,
  ): Promise<void> {
    const [topic] = await transaction
      .select({ status: topics.status })
      .from(topics)
      .where(
        and(
          eq(topics.placeId, placeId),
          eq(topics.id, topicId),
          isNull(topics.deletedAt),
        ),
      )
      .limit(1)
      .for('update');
    if (!topic) throw new ConflictException('Topic is unavailable.');
    if (topic.status === 'locked' && !allowLocked) {
      throw new ConflictException('Topic is locked.');
    }
  }

  private async attachTopicMetadata<T extends { authorUserId: string; id: string }>(
    placeId: string,
    records: T[],
  ) {
    if (records.length === 0) return [];
    const topicIds = records.map((record) => record.id);
    const [authors, links, originalPosts] = await Promise.all([
      this.database
        .select({
          displayName: users.displayName,
          handle: users.handle,
          id: users.id,
          joinedAt: users.createdAt,
        })
        .from(users)
        .where(inArray(users.id, [...new Set(records.map((record) => record.authorUserId))])),
      this.database
        .select({ tag: forumTags, topicId: topicTags.topicId })
        .from(topicTags)
        .innerJoin(forumTags, eq(forumTags.id, topicTags.tagId))
        .where(
          and(
            eq(topicTags.placeId, placeId),
            inArray(topicTags.topicId, topicIds),
          ),
        ),
      this.database
        .selectDistinctOn([posts.topicId], {
          document: posts.document,
          topicId: posts.topicId,
        })
        .from(posts)
        .where(
          and(
            eq(posts.placeId, placeId),
            inArray(posts.topicId, topicIds),
            isNull(posts.deletedAt),
          ),
        )
        .orderBy(posts.topicId, posts.createdAt, posts.id),
    ]);
    return records.map((record) => {
      const author = authors.find((item) => item.id === record.authorUserId);
      if (!author) throw new Error('Topic author was not found.');
      return {
        ...record,
        author,
        previewImage: firstImage(
          originalPosts.find((post) => post.topicId === record.id)?.document ?? {},
        ),
        tags: links
          .filter((link) => link.topicId === record.id)
          .map((link) => link.tag),
      };
    });
  }

  private async audit(
    transaction: DatabaseTransaction,
    placeId: string,
    actorUserId: string,
    action: string,
    targetId: string,
  ): Promise<void> {
    await transaction.insert(auditLog).values({
      action,
      actorUserId,
      placeId,
      targetId,
      targetType: action.split('.')[0],
    });
  }

  private async emit(
    transaction: DatabaseTransaction,
    eventType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await transaction.insert(outboxEvents).values({
      aggregateId,
      aggregateType: eventType.split('.')[0]!,
      eventType,
      payload,
    });
  }
}
