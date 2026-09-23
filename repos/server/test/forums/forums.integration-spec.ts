import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq } from 'drizzle-orm';
import { AccessTokenService } from '../../src/auth/access-token.service.js';
import {
  postMentions,
  postReactions,
  postRevisions,
  posts,
  savedPosts,
  savedTopics,
  sessions,
  topicFollows,
  topicReadState,
  topicViewFlushes,
  topics,
  userEmails,
  users,
} from '../../src/database/schema/index.js';
import { ForumsRepository } from '../../src/forums/forums.repository.js';
import {
  startDatabaseTestContext,
  type DatabaseTestContext,
} from '../factories/database-test-context.js';
import { createTestApplication } from '../factories/test-application.js';

interface TestIdentity {
  accessToken: string;
  id: string;
}

const document = (text: string) => ({
  content: [{ content: [{ text, type: 'text' }], type: 'paragraph' }],
  type: 'doc',
  version: 1,
});

describe('forum lifecycle', () => {
  let app: NestFastifyApplication;
  let context: DatabaseTestContext;

  beforeAll(async () => {
    context = await startDatabaseTestContext();
    app = await createTestApplication({
      environment: {
        ACCESS_TOKEN_SECRET: 'forums-integration-access-token-secret-at-least-32-bytes',
        DATABASE_URL: context.environment.DATABASE_URL,
        REDIS_URL: `redis://:${context.redis.options.password}@${context.redis.options.host}:${context.redis.options.port}`,
        REFRESH_TOKEN_PEPPER: 'forums-integration-refresh-token-pepper-at-least-32-bytes',
      },
    });
  });

  afterAll(async () => {
    await app?.close();
    await context?.stop();
  });

  it('supports durable forum content while enforcing visibility and place scope', async () => {
    const repository = app.get(ForumsRepository);
    const owner = await createIdentity('forum_owner');
    const member = await createIdentity('forum_member');
    const outsider = await createIdentity('forum_outsider');
    const place = await createPlace(owner, `forum-${suffix()}`);
    const otherPlace = await createPlace(owner, `other-${suffix()}`);
    await join(place.id, member);

    const memberSearch = await request(member, 'GET', `/places/${place.id}/members?status=active&q=${owner.handle.slice(0, 8)}`);
    expect(memberSearch.statusCode).toBe(200);
    expect(memberSearch.json<{ items: Array<{ id: string; handle: string }> }>().items)
      .toContainEqual(expect.objectContaining({ handle: owner.handle }));

    const groupResponse = await request(owner, 'POST', `/places/${place.id}/forum-groups`, {
      name: 'General',
      position: 10,
    });
    expect(groupResponse.statusCode).toBe(201);
    const group = groupResponse.json<{ forums: unknown[]; id: string }>();
    expect(group.forums).toEqual([]);
    const ownerNavigation = await request(owner, 'GET', `/places/${place.id}/forums`);
    expect(ownerNavigation.json<{ groups: Array<{ id: string }> }>().groups)
      .toContainEqual(expect.objectContaining({ id: group.id }));
    const publicNavigation = await app.inject({
      method: 'GET',
      url: `/api/v1/places/${place.id}/forums`,
    });
    expect(publicNavigation.statusCode, publicNavigation.body).toBe(200);
    expect(publicNavigation.json<{ groups: Array<{ id: string }> }>().groups)
      .not.toContainEqual(expect.objectContaining({ id: group.id }));
    const duplicateGroup = await request(owner, 'POST', `/places/${place.id}/forum-groups`, {
      name: 'general',
    });
    expect(duplicateGroup.statusCode).toBe(409);

    const publicForumResponse = await request(owner, 'POST', `/places/${place.id}/forums`, {
      groupId: group.id,
      name: 'Public discussion',
      position: 10,
      visibility: 'public',
    });
    expect(publicForumResponse.statusCode).toBe(201);
    const publicForum = publicForumResponse.json<{ id: string }>();

    const membersForumResponse = await request(owner, 'POST', `/places/${place.id}/forums`, {
      groupId: group.id,
      name: 'Members discussion',
      position: 20,
      visibility: 'members',
      writePermission: 'post.create',
    });
    expect(membersForumResponse.statusCode).toBe(201);
    const membersForum = membersForumResponse.json<{ id: string }>();
    const updatedGroup = await request(owner, 'PATCH', `/places/${place.id}/forum-groups/${group.id}`, {
      description: 'All discussions',
    });
    expect(updatedGroup.json<{ forums: unknown[] }>().forums).toHaveLength(2);
    const duplicateForum = await request(owner, 'POST', `/places/${place.id}/forums`, {
      groupId: group.id,
      name: 'members DISCUSSION',
    });
    expect(duplicateForum.statusCode).toBe(409);
    const nonemptyGroupDelete = await request(owner, 'DELETE', `/places/${place.id}/forum-groups/${group.id}`);
    expect(nonemptyGroupDelete.statusCode).toBe(409);
    const archivedGroupResponse = await request(owner, 'POST', `/places/${place.id}/forum-groups`, {
      name: 'Archived',
    });
    const archivedGroup = archivedGroupResponse.json<{ id: string }>();
    const archivedForumResponse = await request(owner, 'POST', `/places/${place.id}/forums`, {
      groupId: archivedGroup.id,
      name: 'Old forum',
    });
    const archivedForum = archivedForumResponse.json<{ id: string }>();
    const archivedTopicKey = `topic-${suffix()}`;
    const archivedTopicInput = {
      document: document('Archived forum topic'),
      tagIds: [],
      title: 'Archived forum topic',
    };
    const archivedTopicResponse = await request(
      member,
      'POST',
      `/places/${place.id}/forums/${archivedForum.id}/topics`,
      archivedTopicInput,
      { 'idempotency-key': archivedTopicKey },
    );
    expect(archivedTopicResponse.statusCode).toBe(201);
    expect((await request(owner, 'DELETE', `/places/${place.id}/forums/${archivedForum.id}`)).statusCode).toBe(204);
    const archivedTopicReplay = await request(
      member,
      'POST',
      `/places/${place.id}/forums/${archivedForum.id}/topics`,
      archivedTopicInput,
      { 'idempotency-key': archivedTopicKey },
    );
    expect(archivedTopicReplay.json()).toEqual(archivedTopicResponse.json());
    expect((await request(owner, 'DELETE', `/places/${place.id}/forum-groups/${archivedGroup.id}`)).statusCode).toBe(409);

    const tagResponse = await request(owner, 'POST', `/places/${place.id}/forum-tags`, {
      color: '#2563EB',
      name: 'News',
      slug: 'news',
    });
    expect(tagResponse.statusCode).toBe(201);
    const tag = tagResponse.json<{ id: string }>();

    const anonymousNavigation = await app.inject({
      method: 'GET',
      url: `/api/v1/places/${place.id}/forums`,
    });
    expect(anonymousNavigation.statusCode).toBe(200);
    expect(anonymousNavigation.json<{ groups: Array<{ forums: Array<{ id: string }> }> }>()
      .groups.flatMap((item) => item.forums.map((forum) => forum.id))).toEqual([publicForum.id]);

    const memberNavigation = await request(member, 'GET', `/places/${place.id}/forums`);
    expect(memberNavigation.statusCode).toBe(200);
    expect(memberNavigation.json<{ groups: Array<{ forums: unknown[] }> }>().groups[0]?.forums).toHaveLength(2);

    const topicInput = {
      document: {
        content: [
          {
            content: [
              { text: '<welcome> ', type: 'text' },
              { attrs: { handle: owner.handle }, type: 'mention' },
              { text: ' ', type: 'text' },
              { attrs: { handle: outsider.handle }, type: 'mention' },
            ],
            type: 'paragraph',
          },
        ],
        type: 'doc',
        version: 1,
      },
      tagIds: [tag.id],
      title: 'First topic',
    };
    const topicKey = `topic-${suffix()}`;
    const topicResponse = await request(
      member,
      'POST',
      `/places/${place.id}/forums/${membersForum.id}/topics`,
      topicInput,
      { 'idempotency-key': topicKey },
    );
    expect(topicResponse.statusCode).toBe(201);
    const topic = topicResponse.json<{ id: string }>();
    expect(topicResponse.json()).not.toHaveProperty('placeId');
    expect(topicResponse.json()).not.toHaveProperty('deletedAt');
    expect(topicResponse.json()).not.toHaveProperty('updatedAt');
    const topicReplay = await request(
      member,
      'POST',
      `/places/${place.id}/forums/${membersForum.id}/topics`,
      topicInput,
      { 'idempotency-key': topicKey },
    );
    expect(topicReplay.json()).toEqual(topicResponse.json());
    expect((await request(
      member,
      'POST',
      `/places/${place.id}/forums/${membersForum.id}/topics`,
      { ...topicInput, title: 'Changed retry' },
      { 'idempotency-key': topicKey },
    )).statusCode).toBe(409);
    expect((await request(owner, 'DELETE', `/places/${place.id}/forum-tags/${tag.id}`)).statusCode).toBe(204);
    const topicReplayAfterTagDelete = await request(
      member,
      'POST',
      `/places/${place.id}/forums/${membersForum.id}/topics`,
      topicInput,
      { 'idempotency-key': topicKey },
    );
    expect(topicReplayAfterTagDelete.json()).toEqual(topicResponse.json());

    const anonymousTopic = await app.inject({
      method: 'GET',
      url: `/api/v1/places/${place.id}/topics/${topic.id}`,
    });
    expect(anonymousTopic.statusCode).toBe(404);
    const outsiderTopic = await request(outsider, 'GET', `/places/${place.id}/topics/${topic.id}`);
    expect(outsiderTopic.statusCode).toBe(404);

    const postsResponse = await request(member, 'GET', `/places/${place.id}/topics/${topic.id}/posts?limit=1`);
    expect(postsResponse.statusCode).toBe(200);
    const firstPost = postsResponse.json<{ items: Array<{ author: { displayName: string; handle: string; id: string; joinedAt: string }; id: string; sanitizedHtml: string; version: number }> }>().items[0]!;
    expect(firstPost.author).toMatchObject({
      displayName: expect.any(String),
      handle: member.handle,
      id: member.id,
      joinedAt: expect.any(String),
    });
    expect(firstPost.sanitizedHtml).toContain('&lt;welcome&gt;');
    expect(firstPost.version).toBe(1);

    const mentions = await context.database.select().from(postMentions);
    expect(mentions).toHaveLength(1);
    const [mention] = mentions;
    expect(mention).toMatchObject({ mentionedUserId: owner.id, postId: firstPost.id });

    const replyInput = {
      document: document('Second post'),
    };
    const replyKey = `reply-${suffix()}`;
    const replyResponse = await request(
      member,
      'POST',
      `/places/${place.id}/topics/${topic.id}/posts`,
      replyInput,
      { 'idempotency-key': replyKey },
    );
    expect(replyResponse.statusCode).toBe(201);
    const reply = replyResponse.json<{ author: { handle: string; id: string }; id: string; reactions: unknown[]; version: number }>();
    expect(reply.author).toEqual(expect.objectContaining({ handle: member.handle, id: member.id }));
    expect(reply.reactions).toEqual([]);
    const replyReplay = await request(
      member,
      'POST',
      `/places/${place.id}/topics/${topic.id}/posts`,
      replyInput,
      { 'idempotency-key': replyKey },
    );
    expect(replyReplay.json()).toEqual(replyResponse.json());

    const editResponse = await request(member, 'PATCH', `/places/${place.id}/posts/${reply.id}`, {
      document: document('Edited post'),
      expectedVersion: 1,
    });
    expect(editResponse.statusCode).toBe(200);
    expect(editResponse.json()).toMatchObject({ author: { handle: member.handle, id: member.id }, plainText: 'Edited post', reactions: [], version: 2 });
    const staleEdit = await request(member, 'PATCH', `/places/${place.id}/posts/${reply.id}`, {
      document: document('Stale edit'),
      expectedVersion: 1,
    });
    expect(staleEdit.statusCode).toBe(409);
    expect(
      await context.database
        .select()
        .from(postRevisions)
        .where(eq(postRevisions.postId, reply.id)),
    ).toHaveLength(2);

    expect((await request(member, 'POST', `/places/${place.id}/posts/${reply.id}/reactions`, { reaction: 'like' })).statusCode).toBe(204);
    const reactedPosts = await request(member, 'GET', `/places/${place.id}/topics/${topic.id}/posts`);
    expect(reactedPosts.json<{ items: Array<{ id: string; reactions: unknown[] }> }>().items)
      .toContainEqual(expect.objectContaining({
        id: reply.id,
        reactions: [{ count: 1, reacted: true, reaction: 'like' }],
      }));
    expect((await request(member, 'POST', `/places/${place.id}/topics/${topic.id}/follow`)).statusCode).toBe(204);
    expect((await request(member, 'POST', `/places/${place.id}/topics/${topic.id}/save`)).statusCode).toBe(204);
    expect((await request(member, 'POST', `/places/${place.id}/posts/${reply.id}/save`)).statusCode).toBe(204);
    expect((await request(member, 'PUT', `/places/${place.id}/topics/${topic.id}/read`, { lastReadPostId: reply.id })).statusCode).toBe(204);
    expect(await context.database.select().from(postReactions)).toHaveLength(1);
    expect(await context.database.select().from(topicFollows)).toHaveLength(1);
    expect(await context.database.select().from(savedTopics)).toHaveLength(1);
    expect(await context.database.select().from(savedPosts)).toHaveLength(1);
    expect(await context.database.select().from(topicReadState)).toHaveLength(1);

    const savedTopicResponse = await request(member, 'GET', '/saved/topics?limit=1');
    expect(savedTopicResponse.statusCode).toBe(200);
    expect(savedTopicResponse.json<{ items: Array<{ placeSlug: string; topic: { id: string } }> }>().items)
      .toContainEqual(expect.objectContaining({ placeSlug: place.slug, topic: expect.objectContaining({ id: topic.id }) }));
    const savedPostResponse = await request(member, 'GET', '/saved/posts?limit=1');
    expect(savedPostResponse.statusCode).toBe(200);
    expect(savedPostResponse.json<{ items: Array<{ post: { id: string }; topicTitle: string }> }>().items)
      .toContainEqual(expect.objectContaining({ post: expect.objectContaining({ id: reply.id }), topicTitle: 'First topic' }));
    expect((await request(outsider, 'GET', '/saved/topics')).json<{ items: unknown[] }>().items).toEqual([]);

    const following = await request(member, 'GET', `/places/${place.id}/topics?feed=following`);
    expect(following.statusCode).toBe(200);
    expect(following.json<{ items: Array<{ id: string }> }>().items).toContainEqual(expect.objectContaining({ id: topic.id }));

    const firstPage = await request(member, 'GET', `/places/${place.id}/topics/${topic.id}/posts?limit=1`);
    const firstPageBody = firstPage.json<{ items: Array<{ id: string }>; nextCursor: string }>();
    expect(firstPageBody.items).toHaveLength(1);
    expect(firstPageBody.nextCursor).toEqual(expect.any(String));
    const secondPage = await request(
      member,
      'GET',
      `/places/${place.id}/topics/${topic.id}/posts?limit=1&cursor=${encodeURIComponent(firstPageBody.nextCursor)}`,
    );
    const secondPageBody = secondPage.json<{ items: Array<{ id: string }> }>();
    expect(secondPageBody.items).toHaveLength(1);
    expect([
      firstPageBody.items[0]?.id,
      secondPageBody.items[0]?.id,
    ]).toEqual(expect.arrayContaining([firstPost.id, reply.id]));

    const concurrentKey = `reply-${suffix()}`;
    const concurrentReplies = await Promise.all([
      request(
        member,
        'POST',
        `/places/${place.id}/topics/${topic.id}/posts`,
        { document: document('Concurrent idempotent reply') },
        { 'idempotency-key': concurrentKey },
      ),
      request(
        member,
        'POST',
        `/places/${place.id}/topics/${topic.id}/posts`,
        { document: document('Concurrent idempotent reply') },
        { 'idempotency-key': concurrentKey },
      ),
    ]);
    expect(concurrentReplies.map((response) => response.statusCode)).toEqual([201, 201]);
    expect(concurrentReplies[0]?.json()).toEqual(concurrentReplies[1]?.json());

    const futureActivity = new Date(Date.now() + 60_000);
    await context.database
      .update(topics)
      .set({ latestPostAt: futureActivity })
      .where(eq(topics.id, topic.id));
    expect((await request(member, 'POST', `/places/${place.id}/topics/${topic.id}/posts`, {
      document: document('Concurrent reply'),
    }, { 'idempotency-key': `reply-${suffix()}` })).statusCode).toBe(201);
    const [activityRecord] = await context.database
      .select({ latestPostAt: topics.latestPostAt })
      .from(topics)
      .where(eq(topics.id, topic.id));
    expect(activityRecord?.latestPostAt).toEqual(futureActivity);

    expect((await request(owner, 'PATCH', `/places/${place.id}/forums/${membersForum.id}`, {
      writePermission: 'forum.manage',
    })).statusCode).toBe(200);
    expect((await request(member, 'DELETE', `/places/${place.id}/posts/${reply.id}`)).statusCode).toBe(403);
    expect((await request(owner, 'PATCH', `/places/${place.id}/forums/${membersForum.id}`, {
      writePermission: 'post.create',
    })).statusCode).toBe(200);

    expect((await request(owner, 'POST', `/places/${place.id}/topics/${topic.id}/lock`)).statusCode).toBe(200);
    const replyReplayAfterLock = await request(
      member,
      'POST',
      `/places/${place.id}/topics/${topic.id}/posts`,
      replyInput,
      { 'idempotency-key': replyKey },
    );
    expect(replyReplayAfterLock.json()).toEqual(replyResponse.json());
    await expect(
      repository.deletePost(place.id, reply.id, topic.id, member.id, false, new Date()),
    ).rejects.toThrow('Topic is locked.');
    expect((await request(
      member,
      'POST',
      `/places/${place.id}/topics/${topic.id}/posts`,
      { document: document('blocked') },
      { 'idempotency-key': `reply-${suffix()}` },
    )).statusCode).toBe(409);
    expect((await request(member, 'PATCH', `/places/${place.id}/topics/${topic.id}`, { title: 'Blocked edit' })).statusCode).toBe(409);
    expect((await request(member, 'DELETE', `/places/${place.id}/posts/${reply.id}`)).statusCode).toBe(409);
    expect((await request(owner, 'DELETE', `/places/${place.id}/topics/${topic.id}/lock`)).statusCode).toBe(200);

    expect((await request(member, 'DELETE', `/places/${place.id}/posts/${reply.id}`)).statusCode).toBe(204);
    const tombstones = await request(member, 'GET', `/places/${place.id}/topics/${topic.id}/posts`);
    expect(tombstones.statusCode).toBe(200);
    const tombstoneItems = tombstones.json<{ items: Array<Record<string, unknown> & { id: string; isDeleted: boolean; plainText: string | null }> }>().items;
    expect(tombstoneItems)
      .toContainEqual(expect.objectContaining({ id: reply.id, isDeleted: true, plainText: null }));
    const tombstone = tombstoneItems.find((post) => post.id === reply.id);
    expect(tombstone).not.toHaveProperty('deletedAt');
    expect(tombstone).not.toHaveProperty('deletedByUserId');
    expect(tombstone).not.toHaveProperty('placeId');
    expect((await request(member, 'POST', `/places/${place.id}/posts/${reply.id}/save`)).statusCode).toBe(404);
    const revisionsResponse = await request(owner, 'GET', `/places/${place.id}/posts/${reply.id}/revisions`);
    expect(revisionsResponse.statusCode).toBe(200);
    const revisions = revisionsResponse.json<Array<Record<string, unknown>>>();
    expect(revisions).toHaveLength(2);
    expect(revisions[0]).toEqual(expect.objectContaining({
      createdAt: expect.any(String),
      document: expect.any(Object),
      editorUserId: member.id,
      id: expect.any(String),
      plainText: expect.any(String),
      postId: reply.id,
      sanitizedHtml: expect.any(String),
      version: expect.any(Number),
    }));
    expect(revisions[0]).not.toHaveProperty('placeId');

    const crossPlace = await request(owner, 'GET', `/places/${otherPlace.id}/topics/${topic.id}`);
    expect(crossPlace.statusCode).toBe(404);
    const rollbackKey = `topic-${suffix()}`;
    const invalidTag = await request(
      member,
      'POST',
      `/places/${place.id}/forums/${publicForum.id}/topics`,
      {
        document: document('Cross-place tag'),
        tagIds: [randomUUID()],
        title: 'Invalid tag',
      },
      { 'idempotency-key': rollbackKey },
    );
    expect(invalidTag.statusCode).toBe(400);
    const retryAfterRollback = await request(
      member,
      'POST',
      `/places/${place.id}/forums/${publicForum.id}/topics`,
      {
        document: document('Valid retry'),
        tagIds: [],
        title: 'Valid retry',
      },
      { 'idempotency-key': rollbackKey },
    );
    expect(retryAfterRollback.statusCode).toBe(201);

    await context.database
      .update(userEmails)
      .set({ verifiedAt: null })
      .where(eq(userEmails.userId, member.id));
    expect((await request(member, 'DELETE', `/places/${place.id}/topics/${topic.id}/follow`)).statusCode).toBe(403);
    await context.database
      .update(userEmails)
      .set({ verifiedAt: new Date() })
      .where(eq(userEmails.userId, member.id));

    const otherTopicResponse = await request(
      member,
      'POST',
      `/places/${place.id}/forums/${membersForum.id}/topics`,
      {
        document: document('Other root post'),
        tagIds: [],
        title: 'Other topic',
      },
      { 'idempotency-key': `topic-${suffix()}` },
    );
    expect(otherTopicResponse.statusCode).toBe(201);
    const otherTopic = otherTopicResponse.json<{ id: string }>();
    const [otherPost] = await context.database
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.topicId, otherTopic.id));
    await expect(
      context.database
        .update(topicReadState)
        .set({ lastReadPostId: otherPost?.id })
        .where(eq(topicReadState.topicId, topic.id)),
    ).rejects.toThrow();

    const deletedTopicReplyKey = `reply-${suffix()}`;
    const deletedTopicReplyInput = { document: document('Reply before topic deletion') };
    const deletedTopicReply = await request(
      member,
      'POST',
      `/places/${place.id}/topics/${otherTopic.id}/posts`,
      deletedTopicReplyInput,
      { 'idempotency-key': deletedTopicReplyKey },
    );
    expect(deletedTopicReply.statusCode).toBe(201);
    expect((await request(member, 'DELETE', `/places/${place.id}/topics/${otherTopic.id}`)).statusCode).toBe(204);
    const deletedTopicReplyReplay = await request(
      member,
      'POST',
      `/places/${place.id}/topics/${otherTopic.id}/posts`,
      deletedTopicReplyInput,
      { 'idempotency-key': deletedTopicReplyKey },
    );
    expect(deletedTopicReplyReplay.json()).toEqual(deletedTopicReply.json());

    const batchId = randomUUID();
    const expiredBatchId = randomUUID();
    await repository.flushViews(batchId, topic.id, 3);
    await repository.flushViews(expiredBatchId, topic.id, 1);
    await context.database
      .update(topicViewFlushes)
      .set({ processedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1_000) })
      .where(eq(topicViewFlushes.id, expiredBatchId));
    await repository.pruneViewFlushes(new Date(Date.now() - 31 * 24 * 60 * 60 * 1_000));
    await repository.flushViews(batchId, topic.id, 3);
    const [viewRecord] = await context.database
      .select({ viewCount: topics.viewCount })
      .from(topics)
      .where(eq(topics.id, topic.id));
    expect(viewRecord?.viewCount).toBe(4);
    expect(await context.database.select().from(topicViewFlushes)).toEqual([
      expect.objectContaining({ id: batchId }),
    ]);
  });

  async function createIdentity(prefix: string): Promise<TestIdentity & { handle: string }> {
    const value = suffix();
    const handle = `${prefix}_${value}`;
    const [user] = await context.database
      .insert(users)
      .values({ displayName: `${prefix} ${value}`, handle })
      .returning({ id: users.id });
    if (!user) throw new Error('Test user was not returned.');
    await context.database.insert(userEmails).values({
      email: `${prefix}-${value}@example.test`,
      isPrimary: true,
      userId: user.id,
      verifiedAt: new Date(),
    });
    const [session] = await context.database
      .insert(sessions)
      .values({
        expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
        refreshTokenHash: `test-${randomUUID()}`,
        userId: user.id,
      })
      .returning({ id: sessions.id });
    if (!session) throw new Error('Test session was not returned.');
    return {
      accessToken: await app.get(AccessTokenService).issue(user.id, session.id),
      handle,
      id: user.id,
    };
  }

  async function createPlace(identity: TestIdentity, slug: string) {
    const response = await request(identity, 'POST', '/places', { name: slug, slug });
    expect(response.statusCode).toBe(201);
    return response.json<{ id: string }>();
  }

  async function join(placeId: string, identity: TestIdentity) {
    const response = await request(identity, 'POST', `/places/${placeId}/join`, {});
    expect(response.statusCode).toBe(200);
  }

  function request(
    identity: TestIdentity,
    method: string,
    path: string,
    payload?: unknown,
    headers: Record<string, string> = {},
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${identity.accessToken}`, ...headers },
      method,
      payload,
      url: `/api/v1${path}`,
    });
  }
});

function suffix(): string {
  return randomUUID().replaceAll('-', '').slice(0, 8);
}