import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { Meilisearch } from 'meilisearch';
import type { AppEnvironment } from '../config/environment.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import {
  forums,
  outboxEvents,
  places,
  posts,
  topics,
} from '../database/schema/index.js';
import { CursorCodecService } from '../platform/pagination/cursor-codec.service.js';
import { SearchQueryDto } from './search.dto.js';

const SEARCH_INDEX_NAME = 'displace-content';
const SEARCHABLE_EVENT_TYPES = new Set([
  'post.created',
  'post.deleted',
  'post.updated',
  'place.archived',
  'place.created',
  'place.updated',
  'forum.archived',
  'forum.updated',
  'topic.created',
  'topic.deleted',
  'topic.updated',
]);

export interface SearchDocument {
  createdAt: string;
  forumId?: string;
  id: string;
  placeId: string;
  placeSlug: string;
  postId?: string;
  text: string;
  title: string;
  topicId?: string;
  type: 'place' | 'post' | 'topic';
}

type SearchCursor = { offset: number };
type SearchScope = Pick<SearchDocument, 'placeId' | 'postId' | 'topicId' | 'type'>;

@Injectable()
export class SearchService {
  private readonly client: Meilisearch;
  private setup?: Promise<void>;

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(ConfigService) config: ConfigService<AppEnvironment, true>,
    @Inject(CursorCodecService)
    private readonly cursors: CursorCodecService,
  ) {
    this.client = new Meilisearch({
      apiKey: config.get('MEILISEARCH_MASTER_KEY', { infer: true }),
      host: config.get('MEILISEARCH_HOST', { infer: true }),
    });
  }

  async search(query: SearchQueryDto) {
    const cursor = query.cursor
      ? this.cursors.decode<SearchCursor>(query.cursor)
      : { offset: 0 };
    if (!Number.isInteger(cursor.offset) || cursor.offset < 0) {
      throw new Error('Search cursor is invalid.');
    }
    const filters = [
      ...(query.placeId ? [`placeId = "${query.placeId}"`] : []),
      ...(query.type ? [`type = "${query.type}"`] : []),
    ];
    const result = await this.index.search(query.q.trim(), {
      attributesToHighlight: ['text', 'title'],
      filter: filters.length > 0 ? filters : undefined,
      highlightPostTag: '</mark>',
      highlightPreTag: '<mark>',
      limit: query.limit,
      offset: cursor.offset,
      sort: ['createdAt:desc'],
    });
    const rawItems = result.hits.map((hit) => {
      const document = hit as SearchDocument & {
        _formatted?: Partial<Record<'text' | 'title', string>>;
      };
      return {
        createdAt: document.createdAt,
        forumId: document.forumId,
        highlights: document._formatted,
        placeId: document.placeId,
        placeSlug: document.placeSlug,
        postId: document.postId,
        text: document.text,
        title: document.title,
        topicId: document.topicId,
        type: document.type,
      };
    });
    const visibility = await Promise.all(
      rawItems.map((item) => this.isCurrentlyPublic(item)),
    );
    const items = rawItems.filter((_, index) => visibility[index]);
    const total = result.estimatedTotalHits ?? 0;
    const nextOffset = cursor.offset + rawItems.length;
    return {
      items,
      nextCursor:
        rawItems.length > 0 && nextOffset < total
          ? this.cursors.encode({ offset: nextOffset })
          : undefined,
    };
  }

  async processOutboxEvent(eventId: string): Promise<void> {
    const [event] = await this.database
      .select({
        aggregateId: outboxEvents.aggregateId,
        eventType: outboxEvents.eventType,
        id: outboxEvents.id,
        payload: outboxEvents.payload,
      })
      .from(outboxEvents)
      .where(eq(outboxEvents.id, eventId))
      .limit(1);
    if (!event || !SEARCHABLE_EVENT_TYPES.has(event.eventType)) return;

    try {
      await this.indexEvent(event.eventType, event.aggregateId, event.payload);
      await this.database
        .update(outboxEvents)
        .set({ lastError: null, processedAt: new Date(), status: 'completed' })
        .where(eq(outboxEvents.id, event.id));
    } catch (error) {
      await this.markFailed(event.id, error);
      throw error;
    }
  }

  async reindex(): Promise<void> {
    await this.ensureIndex();
    const clear = this.index.deleteAllDocuments();
    await this.waitForTask(clear);
    const [placeRecords, topicRecords, postRecords] = await Promise.all([
      this.database.select({ id: places.id }).from(places),
      this.database.select({ id: topics.id }).from(topics),
      this.database.select({ id: posts.id }).from(posts),
    ]);
    for (const place of placeRecords) await this.syncPlace(place.id);
    for (const topic of topicRecords) await this.syncTopic(topic.id);
    for (const post of postRecords) await this.syncPost(post.id);
  }

  private get index() {
    return this.client.index<SearchDocument>(SEARCH_INDEX_NAME);
  }

  private documentId(type: SearchDocument['type'], id: string): string {
    return `${type}-${id}`;
  }

  private async indexEvent(
    eventType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.ensureIndex();
    if (eventType.startsWith('place.')) {
      await this.syncPlace(aggregateId);
      return;
    }
    if (eventType.startsWith('forum.')) {
      await this.syncForum(aggregateId);
      return;
    }
    if (eventType.startsWith('topic.')) {
      await this.syncTopic(aggregateId);
      return;
    }
    const topicId = payload.topicId;
    if (typeof topicId !== 'string') return;
    await Promise.all([this.syncPost(aggregateId), this.syncTopic(topicId)]);
  }

  private async syncTopic(topicId: string): Promise<void> {
    const document = await this.topicDocument(topicId);
    if (document) {
      await this.upsert(document);
      return;
    }
    await this.remove(this.documentId('topic', topicId));
    const topicPosts = await this.database
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.topicId, topicId));
    if (topicPosts.length > 0) {
      await this.remove(topicPosts.map((post) => this.documentId('post', post.id)));
    }
  }

  private async syncPost(postId: string): Promise<void> {
    const document = await this.postDocument(postId);
    if (document) {
      await this.upsert(document);
      return;
    }
    await this.remove(this.documentId('post', postId));
  }

  private async syncPlace(placeId: string): Promise<void> {
    const document = await this.placeDocument(placeId);
    if (document) {
      await this.upsert(document);
    } else {
      await this.remove(this.documentId('place', placeId));
    }
    const placeTopics = await this.database
      .select({ id: topics.id })
      .from(topics)
      .where(eq(topics.placeId, placeId));
    await Promise.all(placeTopics.map((topic) => this.syncTopic(topic.id)));
  }

  private async syncForum(forumId: string): Promise<void> {
    const forumTopics = await this.database
      .select({ id: topics.id })
      .from(topics)
      .where(eq(topics.forumId, forumId));
    await Promise.all(forumTopics.map((topic) => this.syncTopic(topic.id)));
  }

  private async placeDocument(
    placeId: string,
  ): Promise<SearchDocument | undefined> {
    const [place] = await this.database
      .select({
        createdAt: places.createdAt,
        id: places.id,
        placeSlug: places.slug,
        text: places.description,
        title: places.name,
      })
      .from(places)
      .where(
        and(
          eq(places.id, placeId),
          eq(places.visibility, 'public'),
          isNull(places.archivedAt),
        ),
      )
      .limit(1);
    if (!place) return undefined;
    return {
      createdAt: place.createdAt.toISOString(),
      id: this.documentId('place', place.id),
      placeId: place.id,
      placeSlug: place.placeSlug,
      text: place.text,
      title: place.title,
      type: 'place',
    };
  }

  private async topicDocument(topicId: string): Promise<SearchDocument | undefined> {
    const [topic] = await this.database
      .select({
        createdAt: topics.createdAt,
        forumId: forums.id,
        id: topics.id,
        placeId: places.id,
        placeSlug: places.slug,
        title: topics.title,
      })
      .from(topics)
      .innerJoin(forums, eq(forums.id, topics.forumId))
      .innerJoin(places, eq(places.id, topics.placeId))
      .where(
        and(
          eq(topics.id, topicId),
          eq(places.visibility, 'public'),
          eq(forums.visibility, 'public'),
          isNull(places.archivedAt),
          isNull(forums.archivedAt),
          isNull(topics.deletedAt),
        ),
      )
      .limit(1);
    if (!topic) return undefined;
    const topicPosts = await this.database
      .select({ plainText: posts.plainText })
      .from(posts)
      .where(and(eq(posts.topicId, topic.id), isNull(posts.deletedAt)))
      .orderBy(asc(posts.createdAt));
    return {
      createdAt: topic.createdAt.toISOString(),
      forumId: topic.forumId,
      id: this.documentId('topic', topic.id),
      placeId: topic.placeId,
      placeSlug: topic.placeSlug,
      text: topicPosts.map((post) => post.plainText).join('\n'),
      title: topic.title,
      topicId: topic.id,
      type: 'topic',
    };
  }

  private async postDocument(postId: string): Promise<SearchDocument | undefined> {
    const [post] = await this.database
      .select({
        createdAt: posts.createdAt,
        forumId: forums.id,
        id: posts.id,
        placeId: places.id,
        placeSlug: places.slug,
        text: posts.plainText,
        title: topics.title,
        topicId: topics.id,
      })
      .from(posts)
      .innerJoin(topics, eq(topics.id, posts.topicId))
      .innerJoin(forums, eq(forums.id, topics.forumId))
      .innerJoin(places, eq(places.id, topics.placeId))
      .where(
        and(
          eq(posts.id, postId),
          eq(places.visibility, 'public'),
          eq(forums.visibility, 'public'),
          isNull(places.archivedAt),
          isNull(forums.archivedAt),
          isNull(posts.deletedAt),
          isNull(topics.deletedAt),
        ),
      )
      .limit(1);
    if (!post) return undefined;
    return {
      createdAt: post.createdAt.toISOString(),
      forumId: post.forumId,
      id: this.documentId('post', post.id),
      placeId: post.placeId,
      placeSlug: post.placeSlug,
      postId: post.id,
      text: post.text,
      title: post.title,
      topicId: post.topicId,
      type: 'post',
    };
  }

  private async isCurrentlyPublic(document: SearchScope): Promise<boolean> {
    if (document.type === 'place') {
      const [place] = await this.database
        .select({ id: places.id })
        .from(places)
        .where(
          and(
            eq(places.id, document.placeId),
            eq(places.visibility, 'public'),
            isNull(places.archivedAt),
          ),
        )
        .limit(1);
      return Boolean(place);
    }
    if (document.type === 'topic' && document.topicId) {
      const [topic] = await this.database
        .select({ id: topics.id })
        .from(topics)
        .innerJoin(forums, eq(forums.id, topics.forumId))
        .innerJoin(places, eq(places.id, topics.placeId))
        .where(
          and(
            eq(topics.id, document.topicId),
            eq(places.visibility, 'public'),
            eq(forums.visibility, 'public'),
            isNull(places.archivedAt),
            isNull(forums.archivedAt),
            isNull(topics.deletedAt),
          ),
        )
        .limit(1);
      return Boolean(topic);
    }
    if (document.type === 'post' && document.postId) {
      const [post] = await this.database
        .select({ id: posts.id })
        .from(posts)
        .innerJoin(topics, eq(topics.id, posts.topicId))
        .innerJoin(forums, eq(forums.id, topics.forumId))
        .innerJoin(places, eq(places.id, topics.placeId))
        .where(
          and(
            eq(posts.id, document.postId),
            eq(places.visibility, 'public'),
            eq(forums.visibility, 'public'),
            isNull(places.archivedAt),
            isNull(forums.archivedAt),
            isNull(posts.deletedAt),
            isNull(topics.deletedAt),
          ),
        )
        .limit(1);
      return Boolean(post);
    }
    return false;
  }

  private async ensureIndex(): Promise<void> {
    this.setup ??= this.configureIndex();
    await this.setup;
  }

  private async configureIndex(): Promise<void> {
    const task = this.index.updateSettings({
      filterableAttributes: ['placeId', 'type'],
      searchableAttributes: ['title', 'text'],
      sortableAttributes: ['createdAt'],
    });
    await task.waitTask();
  }

  private async upsert(document: SearchDocument): Promise<void> {
    const task = this.index.addDocuments([document], { primaryKey: 'id' });
    await this.waitForTask(task);
  }

  private async remove(ids: string | string[]): Promise<void> {
    const task = Array.isArray(ids)
      ? this.index.deleteDocuments(ids)
      : this.index.deleteDocument(ids);
    await this.waitForTask(task);
  }

  private async waitForTask(task: {
    waitTask(): Promise<{
      error: { message?: string } | null;
      status: string;
      type: string;
    }>;
  }): Promise<void> {
    const result = await task.waitTask();
    if (result.status !== 'succeeded') {
      throw new Error(
        `Meilisearch ${result.type} failed: ${result.error?.message ?? result.status}`,
      );
    }
  }

  private async markFailed(eventId: string, error: unknown): Promise<void> {
    await this.database
      .update(outboxEvents)
      .set({
        availableAt: new Date(Date.now() + 30_000),
        lastError: error instanceof Error ? error.message.slice(0, 2_000) : String(error).slice(0, 2_000),
        status: 'failed',
      })
      .where(eq(outboxEvents.id, eventId));
  }
}