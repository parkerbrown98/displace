import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { CLOCK, type Clock } from '../platform/clock/clock.js';
import { CursorCodecService } from '../platform/pagination/cursor-codec.service.js';
import {
  PlacesRepository,
  type PlaceAuthorizationRecord,
} from '../places/places.repository.js';
import type { PlacePermission } from '../places/place-permissions.js';
import {
  type CreateForumDto,
  type CreateForumGroupDto,
  type CreateForumTagDto,
  type CreateTopicDto,
  type EditPostDto,
  type FeedQueryDto,
  type ForumCursorQueryDto,
  type MarkTopicReadDto,
  type TopicQueryDto,
  type UpdateForumDto,
  type UpdateForumGroupDto,
  type UpdateTopicDto,
} from './forums.dto.js';
import {
  ForumsRepository,
  type FeedCursor,
  type PostCursor,
  type SavedItemCursor,
  type TopicCursor,
} from './forums.repository.js';
import { RichTextService } from './rich-text.service.js';
import { TopicViewCounterService } from './topic-view-counter.service.js';

type ForumRecord = NonNullable<
  Awaited<ReturnType<ForumsRepository['findForum']>>
>;

@Injectable()
export class ForumsService {
  constructor(
    private readonly auth: AuthService,
    private readonly cursors: CursorCodecService,
    private readonly forums: ForumsRepository,
    private readonly places: PlacesRepository,
    private readonly richText: RichTextService,
    private readonly views: TopicViewCounterService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async navigation(identifier: string, userId?: string) {
    const { authorization, placeId } = await this.readContext(
      identifier,
      userId,
    );
    const navigation = await this.forums.navigation(placeId);
    const readableForums = navigation.forums.filter((forum) =>
      this.canReadForum(forum, authorization),
    );
    const readableGroupIds = new Set(
      readableForums.map((forum) => forum.groupId),
    );
    const visibleGroups = authorization?.permissions.has('forum.manage')
      ? navigation.groups
      : navigation.groups.filter((group) => readableGroupIds.has(group.id));
    return {
      groups: visibleGroups.map((group) =>
        this.toGroup(
          group,
          readableForums.filter((forum) => forum.groupId === group.id),
        ),
      ),
      tags: navigation.tags.map((tag) => this.toTag(tag)),
    };
  }

  async createGroup(
    placeId: string,
    userId: string,
    input: CreateForumGroupDto,
  ) {
    await this.requireVerified(userId);
    try {
      const group = await this.forums.createGroup(placeId, userId, input);
      return this.groupResponse(placeId, group);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Forum group name is already in use.');
      }
      throw error;
    }
  }

  async updateGroup(
    placeId: string,
    groupId: string,
    userId: string,
    input: UpdateForumGroupDto,
  ) {
    await this.requireVerified(userId);
    try {
      const result = await this.forums.updateGroup(
        placeId,
        groupId,
        userId,
        input,
        this.clock.now(),
      );
      if (!result) throw new NotFoundException('Forum group was not found.');
      return this.groupResponse(placeId, result);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Forum group name is already in use.');
      }
      throw error;
    }
  }

  async deleteGroup(placeId: string, groupId: string, userId: string) {
    await this.requireVerified(userId);
    const result = await this.forums.deleteGroup(placeId, groupId, userId);
    if (result === 'missing')
      throw new NotFoundException('Forum group was not found.');
    if (result === 'not-empty') {
      throw new ConflictException(
        'Delete is unavailable while the group contains forums.',
      );
    }
  }

  async createForum(placeId: string, userId: string, input: CreateForumDto) {
    await this.requireVerified(userId);
    try {
      const result = await this.forums.createForum(placeId, userId, input);
      if (!result) throw new NotFoundException('Forum group was not found.');
      return this.toForum(result);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Forum name is already in use in this group.',
        );
      }
      throw error;
    }
  }

  async updateForum(
    placeId: string,
    forumId: string,
    userId: string,
    input: UpdateForumDto,
  ) {
    await this.requireVerified(userId);
    try {
      const result = await this.forums.updateForum(
        placeId,
        forumId,
        userId,
        input,
        this.clock.now(),
      );
      if (!result)
        throw new NotFoundException('Forum or forum group was not found.');
      return this.toForum(result);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Forum name is already in use in this group.',
        );
      }
      throw error;
    }
  }

  async archiveForum(placeId: string, forumId: string, userId: string) {
    await this.requireVerified(userId);
    const result = await this.forums.archiveForum(
      placeId,
      forumId,
      userId,
      this.clock.now(),
    );
    if (!result) throw new NotFoundException('Forum was not found.');
  }

  async createTag(placeId: string, userId: string, input: CreateForumTagDto) {
    await this.requireVerified(userId);
    try {
      return this.toTag(await this.forums.createTag(placeId, userId, input));
    } catch (error) {
      if (this.isUniqueViolation(error))
        throw new ConflictException('Tag slug is already in use.');
      throw error;
    }
  }

  async deleteTag(placeId: string, tagId: string, userId: string) {
    await this.requireVerified(userId);
    const result = await this.forums.deleteTag(placeId, tagId, userId);
    if (!result) throw new NotFoundException('Forum tag was not found.');
  }

  async createTopic(
    placeId: string,
    forumId: string,
    userId: string,
    input: CreateTopicDto,
    idempotencyKey: string,
  ) {
    await this.requirePermission(placeId, userId, 'topic.create');
    const content = this.richText.render(input.document);
    const now = this.clock.now();
    const idempotency = {
      key: idempotencyKey,
      requestHash: this.requestHash({
        document: content.document,
        tagIds: [...input.tagIds].sort(),
        title: input.title.trim(),
      }),
    };
    const replay = await this.forums.replayTopicCreation(
      placeId,
      forumId,
      userId,
      idempotency,
      now,
    );
    if (replay !== undefined) return replay;
    await this.requireWrite(placeId, forumId, userId, 'topic.create');
    const result = await this.forums.createTopic(
      placeId,
      forumId,
      userId,
      input.title.trim(),
      input.tagIds,
      {
        assetIds: content.assetIds,
        document: content.document,
        html: content.html,
        mentions: content.mentions,
        text: content.text,
      },
      idempotency,
      now,
    );
    return result;
  }

  async listTopics(
    identifier: string,
    userId: string | undefined,
    query: TopicQueryDto,
  ) {
    const { authorization, placeId } = await this.readContext(
      identifier,
      userId,
    );
    if (query.feed === 'following' && !authorization) {
      throw new ForbiddenException(
        'Membership is required for the following feed.',
      );
    }
    const navigation = await this.forums.navigation(placeId);
    const forumIds = navigation.forums
      .filter((forum) => this.canReadForum(forum, authorization))
      .filter((forum) => !query.forumId || forum.id === query.forumId)
      .map((forum) => forum.id);
    if (query.forumId && !forumIds.includes(query.forumId)) {
      throw new NotFoundException('Forum was not found.');
    }
    const records = await this.forums.listTopics({
      cursor: query.cursor
        ? this.decodeTopicCursor(query.cursor, query.feed)
        : undefined,
      feed: query.feed,
      forumIds,
      limit: query.limit,
      placeId,
      tag: query.tag?.toLowerCase(),
      userId,
    });
    const hasMore = records.length > query.limit;
    const pageRecords = records.slice(0, query.limit);
    const items = pageRecords.map((topic) => this.toTopic(topic));
    const last = pageRecords.at(-1);
    return {
      items,
      nextCursor:
        hasMore && last
          ? this.cursors.encode({
              id: last.id,
              ...(query.feed !== 'popular' ? { isPinned: last.isPinned } : {}),
              latestPostAt: last.latestPostAt.toISOString(),
              ...(query.feed === 'popular'
                ? { replyCount: last.replyCount }
                : {}),
            })
          : undefined,
    };
  }

  async listFeed(userId: string | undefined, query: FeedQueryDto) {
    const cursor = query.cursor
      ? this.decodeFeedCursor(query.cursor, query.sort)
      : undefined;
    const asOf = cursor?.asOf ?? this.clock.now();
    const records = await this.forums.listFeed({
      asOf,
      cursor,
      limit: query.limit,
      sort: query.sort,
      userId,
    });
    const hasMore = records.length > query.limit;
    const page = records.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page.map((record) => ({
        excerpt: record.excerpt,
        forum: { id: record.forumId, name: record.forumName },
        isFollowing: record.isFollowing,
        isSaved: record.isSaved,
        originalPostId: record.originalPostId,
        place: {
          id: record.placeId,
          name: record.placeName,
          slug: record.placeSlug,
        },
        reactionCount: record.reactionCount,
        sources: [
          ...(record.isFollowing ? (['following'] as const) : []),
          ...(record.isJoined ? (['joined'] as const) : []),
          ...(record.isTrending ? (['trending'] as const) : []),
        ],
        topic: this.toTopic(record),
        viewerHasReacted: record.viewerHasReacted,
      })),
      nextCursor:
        hasMore && last
          ? this.cursors.encode({
              asOf: asOf.toISOString(),
              id: last.id,
              latestPostAt: last.latestPostAt.toISOString(),
              score: last.score,
              sort: query.sort,
            })
          : undefined,
    };
  }

  async getTopic(identifier: string, topicId: string, userId?: string) {
    const { authorization, placeId } = await this.readContext(
      identifier,
      userId,
    );
    const topic = await this.requireTopic(placeId, topicId);
    const forum = await this.requireReadableForum(
      placeId,
      topic.forumId,
      authorization,
    );
    void forum;
    void this.views.record(topicId);
    return this.toTopic(topic);
  }

  async listPosts(
    identifier: string,
    topicId: string,
    userId: string | undefined,
    query: ForumCursorQueryDto,
  ) {
    const { authorization, placeId } = await this.readContext(
      identifier,
      userId,
    );
    const topic = await this.requireTopic(placeId, topicId);
    await this.requireReadableForum(placeId, topic.forumId, authorization);
    const records = await this.forums.listPosts(
      placeId,
      topicId,
      query.cursor ? this.decodePostCursor(query.cursor) : undefined,
      query.limit,
    );
    const hasMore = records.length > query.limit;
    const pageRecords = records.slice(0, query.limit);
    const [reactionSummaries, authors] = await Promise.all([
      this.forums.listReactionSummaries(
        placeId,
        pageRecords.map((post) => post.id),
        userId,
      ),
      this.forums.listPostAuthors(
        pageRecords.map((post) => post.authorUserId),
      ),
    ]);
    const authorsById = new Map(authors.map((author) => [author.id, author]));
    const items = pageRecords.map((post) => ({
      ...this.toPost(post),
      author: this.requirePostAuthor(authorsById.get(post.authorUserId)),
      reactions: reactionSummaries
        .filter((item) => item.postId === post.id)
        .map(({ count, reacted, reaction }) => ({ count, reacted, reaction })),
    }));
    const last = pageRecords.at(-1);
    return {
      items,
      nextCursor:
        hasMore && last
          ? this.cursors.encode({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            })
          : undefined,
    };
  }

  async reply(
    placeId: string,
    topicId: string,
    userId: string,
    document: unknown,
    idempotencyKey: string,
  ) {
    await this.requirePermission(placeId, userId, 'post.create');
    const content = this.richText.render(document);
    const now = this.clock.now();
    const idempotency = {
      key: idempotencyKey,
      requestHash: this.requestHash({ document: content.document }),
    };
    const replay = await this.forums.replayReply(
      placeId,
      topicId,
      userId,
      idempotency,
      now,
    );
    if (replay !== undefined) return this.withPostAuthor(replay);
    const topic = await this.requireTopic(placeId, topicId);
    await this.requireWrite(placeId, topic.forumId, userId, 'post.create');
    const result = await this.forums.reply(
      placeId,
      topicId,
      userId,
      {
        assetIds: content.assetIds,
        document: content.document,
        html: content.html,
        mentions: content.mentions,
        text: content.text,
      },
      idempotency,
      now,
    );
    return this.withPostAuthor(result);
  }

  async updateTopic(
    placeId: string,
    topicId: string,
    userId: string,
    input: UpdateTopicDto,
  ) {
    const { authorization, topic } = await this.authorOrModerator(
      placeId,
      topicId,
      userId,
    );
    const result = await this.forums.updateTopic(
      placeId,
      topicId,
      userId,
      authorization.permissions.has('forum.manage'),
      input,
      this.clock.now(),
    );
    if (!result)
      throw new BadRequestException('One or more tag IDs are invalid.');
    return this.toTopic(await this.requireTopic(placeId, topic.id));
  }

  async editPost(
    placeId: string,
    postId: string,
    userId: string,
    input: EditPostDto,
  ) {
    const post = await this.requirePost(placeId, postId);
    const { authorization } = await this.requirePostMutation(
      placeId,
      post,
      userId,
    );
    const content = this.richText.render(input.document);
    const result = await this.forums.editPost(
      placeId,
      postId,
      post.topicId,
      userId,
      authorization.permissions.has('forum.manage'),
      input.expectedVersion,
      {
        assetIds: content.assetIds,
        document: content.document,
        html: content.html,
        mentions: content.mentions,
        text: content.text,
      },
      this.clock.now(),
    );
    return this.postResponse(placeId, result, userId);
  }

  async deletePost(placeId: string, postId: string, userId: string) {
    const post = await this.requirePost(placeId, postId);
    const { authorization } = await this.requirePostMutation(
      placeId,
      post,
      userId,
    );
    const result = await this.forums.deletePost(
      placeId,
      postId,
      post.topicId,
      userId,
      authorization.permissions.has('forum.manage'),
      this.clock.now(),
    );
    if (!result) throw new NotFoundException('Post was not found.');
  }

  async deleteTopic(placeId: string, topicId: string, userId: string) {
    const { authorization } = await this.authorOrModerator(
      placeId,
      topicId,
      userId,
    );
    const result = await this.forums.deleteTopic(
      placeId,
      topicId,
      userId,
      authorization.permissions.has('forum.manage'),
      this.clock.now(),
    );
    if (!result) throw new NotFoundException('Topic was not found.');
  }

  async moderateTopic(
    placeId: string,
    topicId: string,
    userId: string,
    values: { isPinned?: boolean; status?: 'open' | 'locked' },
  ) {
    await this.requirePermission(placeId, userId, 'forum.manage');
    const result = await this.forums.setTopicModeration(
      placeId,
      topicId,
      userId,
      values,
      this.clock.now(),
    );
    if (!result) throw new NotFoundException('Topic was not found.');
    return this.toTopic(await this.requireTopic(placeId, topicId));
  }

  async setReaction(
    placeId: string,
    postId: string,
    userId: string,
    reaction: string,
    enabled: boolean,
  ) {
    if (!/^[a-z0-9_+-]{1,40}$/.test(reaction)) {
      throw new BadRequestException('Reaction is invalid.');
    }
    const post = await this.requirePost(placeId, postId);
    const topic = await this.requireTopic(placeId, post.topicId);
    await this.requireWrite(placeId, topic.forumId, userId, 'post.create');
    if (post.deletedAt) throw new NotFoundException('Post was not found.');
    await this.forums.setReaction(placeId, postId, userId, reaction, enabled);
  }

  async setFollow(
    placeId: string,
    topicId: string,
    userId: string,
    enabled: boolean,
  ) {
    await this.requireTopicRead(placeId, topicId, userId);
    await this.forums.setTopicRelationship(
      'follow',
      placeId,
      topicId,
      userId,
      enabled,
    );
  }

  async setTopicSaved(
    placeId: string,
    topicId: string,
    userId: string,
    enabled: boolean,
  ) {
    await this.requireTopicRead(placeId, topicId, userId);
    await this.forums.setTopicRelationship(
      'save',
      placeId,
      topicId,
      userId,
      enabled,
    );
  }

  async setPostSaved(
    placeId: string,
    postId: string,
    userId: string,
    enabled: boolean,
  ) {
    const post = await this.requirePost(placeId, postId);
    if (post.deletedAt) throw new NotFoundException('Post was not found.');
    await this.requireTopicRead(placeId, post.topicId, userId);
    await this.forums.setPostSaved(placeId, postId, userId, enabled);
  }

  async listSavedTopics(userId: string, query: ForumCursorQueryDto) {
    await this.requireVerified(userId);
    const records = await this.forums.listSavedTopics(
      userId,
      query.cursor ? this.decodeSavedCursor(query.cursor) : undefined,
      query.limit,
    );
    const hasMore = records.length > query.limit;
    const page = records.slice(0, query.limit);
    const readable = [];
    for (const record of page) {
      try {
        await this.requireTopicRead(record.placeId, record.topic.id, userId);
        readable.push(record);
      } catch {
        // Saves remain private and hidden if the viewer loses access.
      }
    }
    const last = page.at(-1);
    return {
      items: await Promise.all(
        readable.map(async (record) => ({
          placeId: record.placeId,
          placeName: record.placeName,
          placeSlug: record.placeSlug,
          savedAt: record.savedAt,
          topic: this.toTopic(
            (await this.forums.findTopic(record.placeId, record.topic.id))!,
          ),
        })),
      ),
      nextCursor:
        hasMore && last
          ? this.cursors.encode({
              id: last.topic.id,
              savedAt: last.savedAt.toISOString(),
            })
          : undefined,
    };
  }

  async listSavedPosts(userId: string, query: ForumCursorQueryDto) {
    await this.requireVerified(userId);
    const records = await this.forums.listSavedPosts(
      userId,
      query.cursor ? this.decodeSavedCursor(query.cursor) : undefined,
      query.limit,
    );
    const hasMore = records.length > query.limit;
    const page = records.slice(0, query.limit);
    const readable = [];
    for (const record of page) {
      try {
        await this.requireTopicRead(
          record.placeId,
          record.post.topicId,
          userId,
        );
        readable.push(record);
      } catch {
        // Saves remain private and hidden if the viewer loses access.
      }
    }
    const postIdsByPlace = new Map<string, string[]>();
    for (const record of readable) {
      postIdsByPlace.set(record.placeId, [
        ...(postIdsByPlace.get(record.placeId) ?? []),
        record.post.id,
      ]);
    }
    const [reactions, authors] = await Promise.all([
      Promise.all(
        [...postIdsByPlace].map(([placeId, postIds]) =>
          this.forums.listReactionSummaries(placeId, postIds, userId),
        ),
      ).then((items) => items.flat()),
      this.forums.listPostAuthors(
        readable.map((record) => record.post.authorUserId),
      ),
    ]);
    const authorsById = new Map(authors.map((author) => [author.id, author]));
    const last = page.at(-1);
    return {
      items: readable.map((record) => ({
        placeId: record.placeId,
        placeName: record.placeName,
        placeSlug: record.placeSlug,
        post: {
          ...this.toPost(record.post),
          author: this.requirePostAuthor(
            authorsById.get(record.post.authorUserId),
          ),
          reactions: reactions
            .filter((item) => item.postId === record.post.id)
            .map(({ count, reacted, reaction }) => ({
              count,
              reacted,
              reaction,
            })),
        },
        savedAt: record.savedAt,
        topicTitle: record.topicTitle,
      })),
      nextCursor:
        hasMore && last
          ? this.cursors.encode({
              id: last.post.id,
              savedAt: last.savedAt.toISOString(),
            })
          : undefined,
    };
  }

  async markRead(
    placeId: string,
    topicId: string,
    userId: string,
    input: MarkTopicReadDto,
  ) {
    await this.requireTopicRead(placeId, topicId, userId);
    if (
      !(await this.forums.markRead(
        placeId,
        topicId,
        userId,
        input.lastReadPostId,
        this.clock.now(),
      ))
    ) {
      throw new BadRequestException(
        'The last-read post does not belong to this topic.',
      );
    }
  }

  async markUnread(placeId: string, topicId: string, userId: string) {
    await this.requireTopicRead(placeId, topicId, userId);
    await this.forums.markUnread(placeId, topicId, userId);
  }

  async revisions(placeId: string, postId: string, userId: string) {
    await this.requirePermission(placeId, userId, 'forum.manage');
    await this.requirePost(placeId, postId);
    const revisions = await this.forums.listRevisions(placeId, postId);
    return revisions.map((revision) => ({
      createdAt: revision.createdAt,
      document: revision.document,
      editorUserId: revision.editorUserId,
      id: revision.id,
      plainText: revision.plainText,
      postId: revision.postId,
      sanitizedHtml: revision.sanitizedHtml,
      version: revision.version,
    }));
  }

  private async requireTopicRead(
    placeId: string,
    topicId: string,
    userId: string,
  ) {
    await this.requireVerified(userId);
    const authorization = await this.requireAuthorization(placeId, userId);
    const topic = await this.requireTopic(placeId, topicId);
    await this.requireReadableForum(placeId, topic.forumId, authorization);
    return topic;
  }

  private async authorOrModerator(
    placeId: string,
    topicId: string,
    userId: string,
  ) {
    await this.requireVerified(userId);
    const topic = await this.requireTopic(placeId, topicId);
    const authorization = await this.requireAuthorization(placeId, userId);
    const forum = await this.requireReadableForum(
      placeId,
      topic.forumId,
      authorization,
    );
    if (
      topic.authorUserId !== userId &&
      !authorization.permissions.has('forum.manage')
    ) {
      throw new ForbiddenException(
        'Only the author or a forum manager can change this topic.',
      );
    }
    if (
      !authorization.permissions.has('forum.manage') &&
      forum.writePermission &&
      !authorization.permissions.has(forum.writePermission)
    ) {
      throw new ForbiddenException(
        'This forum has an additional write restriction.',
      );
    }
    if (
      topic.status === 'locked' &&
      !authorization.permissions.has('forum.manage')
    ) {
      throw new ConflictException('Topic is locked.');
    }
    return { authorization, topic };
  }

  private async requirePostMutation(
    placeId: string,
    post: NonNullable<Awaited<ReturnType<ForumsRepository['findPost']>>>,
    userId: string,
  ) {
    await this.requireVerified(userId);
    const topic = await this.requireTopic(placeId, post.topicId);
    const authorization = await this.requireAuthorization(placeId, userId);
    const forum = await this.requireReadableForum(
      placeId,
      topic.forumId,
      authorization,
    );
    if (
      post.authorUserId !== userId &&
      !authorization.permissions.has('forum.manage')
    ) {
      throw new ForbiddenException(
        'Only the author or a forum manager can change this post.',
      );
    }
    if (
      !authorization.permissions.has('forum.manage') &&
      forum.writePermission &&
      !authorization.permissions.has(forum.writePermission)
    ) {
      throw new ForbiddenException(
        'This forum has an additional write restriction.',
      );
    }
    if (
      topic.status === 'locked' &&
      !authorization.permissions.has('forum.manage')
    ) {
      throw new ConflictException('Topic is locked.');
    }
    return { authorization, topic };
  }

  private async requireWrite(
    placeId: string,
    forumId: string,
    userId: string,
    permission: PlacePermission,
  ) {
    await this.requireVerified(userId);
    const authorization = await this.requireAuthorization(placeId, userId);
    const forum = await this.requireReadableForum(
      placeId,
      forumId,
      authorization,
    );
    if (!authorization.permissions.has(permission)) {
      throw new ForbiddenException('Required forum permission is missing.');
    }
    if (
      forum.writePermission &&
      !authorization.permissions.has(forum.writePermission)
    ) {
      throw new ForbiddenException(
        'This forum has an additional write restriction.',
      );
    }
    return authorization;
  }

  private async requireReadableForum(
    placeId: string,
    forumId: string,
    authorization?: PlaceAuthorizationRecord,
  ) {
    const forum = await this.forums.findForum(placeId, forumId);
    if (!forum || !this.canReadForum(forum, authorization)) {
      throw new NotFoundException('Forum was not found.');
    }
    return forum;
  }

  private canReadForum(
    forum: ForumRecord,
    authorization?: PlaceAuthorizationRecord,
  ): boolean {
    if (!authorization)
      return forum.visibility === 'public' && !forum.readPermission;
    return (
      !forum.readPermission ||
      authorization.permissions.has(forum.readPermission)
    );
  }

  private async readContext(identifier: string, userId?: string) {
    const place = await this.places.findByIdentifier(identifier);
    if (!place || place.archivedAt)
      throw new NotFoundException('Place was not found.');
    const authorization = userId
      ? await this.places.getAuthorization(place.id, userId)
      : undefined;
    if (place.visibility !== 'public' && !authorization) {
      throw new NotFoundException('Place was not found.');
    }
    return { authorization, placeId: place.id };
  }

  private async requireAuthorization(placeId: string, userId: string) {
    const authorization = await this.places.getAuthorization(placeId, userId);
    if (!authorization)
      throw new ForbiddenException('Active place membership is required.');
    return authorization;
  }

  private async requirePermission(
    placeId: string,
    userId: string,
    permission: PlacePermission,
  ) {
    await this.requireVerified(userId);
    const authorization = await this.requireAuthorization(placeId, userId);
    if (!authorization.permissions.has(permission)) {
      throw new ForbiddenException('Required forum permission is missing.');
    }
    return authorization;
  }

  private async requireVerified(userId: string): Promise<void> {
    const profile = await this.auth.getProfile(userId);
    if (!profile.emailVerified)
      throw new ForbiddenException('Email verification is required.');
  }

  private async requireTopic(placeId: string, topicId: string) {
    const topic = await this.forums.findTopic(placeId, topicId);
    if (!topic) throw new NotFoundException('Topic was not found.');
    return topic;
  }

  private async requirePost(placeId: string, postId: string) {
    const post = await this.forums.findPost(placeId, postId);
    if (!post) throw new NotFoundException('Post was not found.');
    return post;
  }

  private decodeTopicCursor(value: string, feed: string): TopicCursor {
    const cursor = this.cursors.decode<Record<string, unknown>>(value);
    if (
      typeof cursor.id !== 'string' ||
      typeof cursor.latestPostAt !== 'string' ||
      Number.isNaN(Date.parse(cursor.latestPostAt)) ||
      (feed === 'popular' && !Number.isInteger(cursor.replyCount)) ||
      (feed !== 'popular' && typeof cursor.isPinned !== 'boolean')
    ) {
      throw new BadRequestException('Topic cursor is invalid.');
    }
    return {
      id: cursor.id,
      isPinned:
        typeof cursor.isPinned === 'boolean' ? cursor.isPinned : undefined,
      latestPostAt: new Date(cursor.latestPostAt),
      replyCount:
        typeof cursor.replyCount === 'number' ? cursor.replyCount : undefined,
    };
  }

  private decodeFeedCursor(
    value: string,
    sort: string,
  ): FeedCursor & { asOf: Date } {
    const cursor = this.cursors.decode<Record<string, unknown>>(value);
    if (
      typeof cursor.id !== 'string' ||
      typeof cursor.score !== 'number' ||
      !Number.isFinite(cursor.score) ||
      cursor.sort !== sort ||
      typeof cursor.asOf !== 'string' ||
      Number.isNaN(Date.parse(cursor.asOf)) ||
      typeof cursor.latestPostAt !== 'string' ||
      Number.isNaN(Date.parse(cursor.latestPostAt))
    ) {
      throw new BadRequestException('Feed cursor is invalid.');
    }
    return {
      asOf: new Date(cursor.asOf),
      id: cursor.id,
      latestPostAt: new Date(cursor.latestPostAt),
      score: cursor.score,
    };
  }

  private decodePostCursor(value: string): PostCursor {
    const cursor = this.cursors.decode<Record<string, unknown>>(value);
    if (
      typeof cursor.id !== 'string' ||
      typeof cursor.createdAt !== 'string' ||
      Number.isNaN(Date.parse(cursor.createdAt))
    ) {
      throw new BadRequestException('Post cursor is invalid.');
    }
    return { createdAt: new Date(cursor.createdAt), id: cursor.id };
  }

  private decodeSavedCursor(value: string): SavedItemCursor {
    const cursor = this.cursors.decode<Record<string, unknown>>(value);
    if (
      typeof cursor.id !== 'string' ||
      typeof cursor.savedAt !== 'string' ||
      Number.isNaN(Date.parse(cursor.savedAt))
    ) {
      throw new BadRequestException('Saved-item cursor is invalid.');
    }
    return { id: cursor.id, savedAt: new Date(cursor.savedAt) };
  }

  private toPost<
    T extends {
      authorUserId: string;
      createdAt: Date;
      deletedAt: Date | null;
      document: unknown;
      id: string;
      plainText: string;
      sanitizedHtml: string;
      topicId: string;
      updatedAt: Date;
      version: number;
    },
  >(post: T) {
    return {
      authorUserId: post.authorUserId,
      createdAt: post.createdAt,
      document: post.deletedAt ? null : post.document,
      id: post.id,
      isDeleted: post.deletedAt !== null,
      plainText: post.deletedAt ? null : post.plainText,
      sanitizedHtml: post.deletedAt ? null : post.sanitizedHtml,
      topicId: post.topicId,
      updatedAt: post.updatedAt,
      version: post.version,
    };
  }

  private async groupResponse<T extends { id: string }>(
    placeId: string,
    group: T,
  ) {
    const navigation = await this.forums.navigation(placeId);
    return this.toGroup(
      group as T & { description: string; name: string; position: number },
      navigation.forums.filter((forum) => forum.groupId === group.id),
    );
  }

  private toGroup<
    T extends {
      description: string;
      id: string;
      name: string;
      position: number;
    },
    F extends Parameters<ForumsService['toForum']>[0],
  >(group: T, forums: F[]) {
    return {
      description: group.description,
      forums: forums.map((forum) => this.toForum(forum)),
      id: group.id,
      name: group.name,
      position: group.position,
    };
  }

  private toForum<
    T extends {
      description: string;
      groupId: string;
      id: string;
      name: string;
      position: number;
      readPermission: string | null;
      visibility: 'members' | 'public';
      writePermission: string | null;
    },
  >(forum: T) {
    return {
      description: forum.description,
      groupId: forum.groupId,
      id: forum.id,
      name: forum.name,
      position: forum.position,
      readPermission: forum.readPermission,
      visibility: forum.visibility,
      writePermission: forum.writePermission,
    };
  }

  private toTag<
    T extends { color: string | null; id: string; name: string; slug: string },
  >(tag: T) {
    return { color: tag.color, id: tag.id, name: tag.name, slug: tag.slug };
  }

  private toTopic<
    T extends {
      author: {
        displayName: string;
        handle: string;
        id: string;
        joinedAt: Date;
      };
      authorUserId: string;
      createdAt: Date;
      forumId: string;
      id: string;
      isPinned: boolean;
      latestPostAt: Date;
      previewImage?: { alt: string; assetId: string } | null;
      replyCount: number;
      status: 'locked' | 'open';
      tags: Array<{
        color: string | null;
        id: string;
        name: string;
        slug: string;
      }>;
      title: string;
      viewCount: number;
    },
  >(topic: T) {
    return {
      author: topic.author,
      authorUserId: topic.authorUserId,
      createdAt: topic.createdAt,
      forumId: topic.forumId,
      id: topic.id,
      isPinned: topic.isPinned,
      latestPostAt: topic.latestPostAt,
      previewImage: topic.previewImage ?? null,
      replyCount: topic.replyCount,
      status: topic.status,
      tags: topic.tags.map((tag) => this.toTag(tag)),
      title: topic.title,
      viewCount: topic.viewCount,
    };
  }

  private async postResponse<
    T extends {
      authorUserId: string;
      createdAt: Date;
      deletedAt: Date | null;
      document: unknown;
      id: string;
      plainText: string;
      sanitizedHtml: string;
      topicId: string;
      updatedAt: Date;
      version: number;
    },
  >(placeId: string, post: T, userId: string) {
    const [reactions, authors] = await Promise.all([
      this.forums.listReactionSummaries(placeId, [post.id], userId),
      this.forums.listPostAuthors([post.authorUserId]),
    ]);
    return {
      ...this.toPost(post),
      author: this.requirePostAuthor(authors[0]),
      reactions: reactions.map(({ count, reacted, reaction }) => ({
        count,
        reacted,
        reaction,
      })),
    };
  }

  private async withPostAuthor<T extends Record<string, unknown>>(post: T) {
    const authorUserId = post.authorUserId;
    if (typeof authorUserId !== 'string')
      throw new Error('Post response is missing its author.');
    const [author] = await this.forums.listPostAuthors([authorUserId]);
    return { ...post, author: this.requirePostAuthor(author) };
  }

  private requirePostAuthor(author: {
    displayName: string;
    handle: string;
    id: string;
    joinedAt: Date;
  } | undefined) {
    if (!author) throw new Error('Post author was not found.');
    return author;
  }

  private requestHash(value: unknown): string {
    return createHash('sha256').update(this.canonicalJson(value)).digest('hex');
  }

  private canonicalJson(value: unknown): string {
    if (value === null || typeof value !== 'object')
      return JSON.stringify(value);
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.canonicalJson(item)).join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${this.canonicalJson(record[key])}`)
      .join(',')}}`;
  }

  private isUniqueViolation(error: unknown): boolean {
    let current = error;
    const seen = new Set<unknown>();
    while (
      typeof current === 'object' &&
      current !== null &&
      !seen.has(current)
    ) {
      if ('code' in current && current.code === '23505') return true;
      seen.add(current);
      current = 'cause' in current ? current.cause : undefined;
    }
    return false;
  }
}
