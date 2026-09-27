import type { components } from '@displace/api-client';
import type { NativeAuthClient } from '../auth/auth-client';
import { DesktopApiError } from '../../lib/api/desktop-api';
import { desktopReadCache, type ReadCache } from '../../lib/api/read-cache';

export type Place = components['schemas']['PlaceDto'];
export type PlacePage = components['schemas']['PlacePageDto'];
export type PlaceContext = components['schemas']['PlaceContextDto'];
export type ForumNavigation = components['schemas']['ForumNavigationDto'];
export type Topic = components['schemas']['TopicDto'];
export type TopicPage = components['schemas']['TopicPageDto'];
export type PostPage = components['schemas']['PostPageDto'];
export type PublicProfile = components['schemas']['PublicProfileDto'];
export type SearchPage = components['schemas']['SearchPageDto'];
export type MemberPage = components['schemas']['MemberPageDto'];
export type RolePage = components['schemas']['RolePageDto'];
export type InvitePage = components['schemas']['InvitePageDto'];
export type Invite = components['schemas']['InviteDto'];
export type PlaceWriteInput = components['schemas']['CreatePlaceDto'];

export interface PlaceDiscoveryParameters {
  cursor?: string;
  joinPolicy?: Place['joinPolicy'];
  query?: string;
  tag?: string;
}

export class PlaceClient {
  constructor(
    private readonly auth: Pick<NativeAuthClient, 'api' | 'authenticatedRequest' | 'user'>,
    private readonly cache: ReadCache = desktopReadCache,
  ) {}

  discover(parameters: PlaceDiscoveryParameters = {}): Promise<PlacePage> {
    const path = this.auth.api.pagePath('/api/v1/places', parameters.cursor, {
      joinPolicy: parameters.joinPolicy,
      q: parameters.query,
      tag: parameters.tag,
    });
    return this.publicRead(path, () => this.auth.api.request<PlacePage>(path));
  }

  mine(cursor?: string): Promise<PlacePage> {
    const path = this.auth.api.pagePath('/api/v1/places/mine', cursor);
    return this.protectedRead(`places:mine:${cursor ?? 'first'}`, path);
  }

  get(placeSlug: string): Promise<Place> {
    const path = this.placePath(placeSlug);
    return this.publicRead(path, () => this.auth.api.request<Place>(path));
  }

  forums(placeSlug: string): Promise<ForumNavigation> {
    const path = `${this.placePath(placeSlug)}/forums`;
    return this.publicRead(path, () => this.auth.api.request<ForumNavigation>(path));
  }

  topics(placeSlug: string, parameters: { cursor?: string; feed?: 'following' | 'latest' | 'popular'; forumId?: string; tag?: string } = {}): Promise<TopicPage> {
    const path = this.auth.api.pagePath(`${this.placePath(placeSlug)}/topics`, parameters.cursor, {
      feed: parameters.feed,
      forumId: parameters.forumId,
      tag: parameters.tag,
    });
    return this.publicRead(path, () => this.auth.api.request<TopicPage>(path));
  }

  topic(placeSlug: string, topicId: string): Promise<Topic> {
    const path = `${this.placePath(placeSlug)}/topics/${encodeURIComponent(topicId)}`;
    return this.publicRead(path, () => this.auth.api.request<Topic>(path));
  }

  posts(placeSlug: string, topicId: string, cursor?: string): Promise<PostPage> {
    const path = this.auth.api.pagePath(`${this.placePath(placeSlug)}/topics/${encodeURIComponent(topicId)}/posts`, cursor);
    return this.publicRead(path, () => this.auth.api.request<PostPage>(path));
  }

  profile(handle: string): Promise<PublicProfile> {
    const path = `/api/v1/profiles/${encodeURIComponent(handle)}`;
    return this.publicRead(path, () => this.auth.api.request<PublicProfile>(path));
  }

  search(parameters: { cursor?: string; placeId?: string; query: string; type?: 'place' | 'post' | 'topic' }): Promise<SearchPage> {
    const path = this.auth.api.pagePath('/api/v1/search', parameters.cursor, {
      placeId: parameters.placeId,
      q: parameters.query,
      type: parameters.type,
    });
    return this.auth.user ? this.auth.authenticatedRequest<SearchPage>(path) : this.auth.api.request<SearchPage>(path);
  }

  context(placeId: string): Promise<PlaceContext> {
    return this.protectedRead(`place:${placeId}:context`, `/api/v1/places/${encodeURIComponent(placeId)}/context`);
  }

  members(placeId: string): Promise<MemberPage> {
    return this.protectedRead(`place:${placeId}:members`, `/api/v1/places/${encodeURIComponent(placeId)}/members?status=active&limit=24&sort=last_seen`);
  }

  roles(placeId: string): Promise<RolePage> {
    return this.protectedRead(`place:${placeId}:roles`, `/api/v1/places/${encodeURIComponent(placeId)}/roles`);
  }

  invites(placeId: string): Promise<InvitePage> {
    return this.protectedRead(`place:${placeId}:invites`, `/api/v1/places/${encodeURIComponent(placeId)}/invites`);
  }

  async create(input: PlaceWriteInput): Promise<Place> {
    return this.auth.authenticatedRequest('/api/v1/places', { body: input, method: 'POST' });
  }

  async update(placeId: string, input: Omit<PlaceWriteInput, 'slug'>): Promise<Place> {
    const place = await this.auth.authenticatedRequest<Place>(`/api/v1/places/${encodeURIComponent(placeId)}`, { body: input, method: 'PATCH' });
    this.invalidatePlace(placeId);
    return place;
  }

  async updateSettings(placeId: string, settings: Record<string, unknown>): Promise<Place> {
    const place = await this.auth.authenticatedRequest<Place>(`/api/v1/places/${encodeURIComponent(placeId)}/settings`, { body: { settings }, method: 'PATCH' });
    this.invalidatePlace(placeId);
    return place;
  }

  async archive(placeId: string): Promise<void> {
    await this.auth.authenticatedRequest(`/api/v1/places/${encodeURIComponent(placeId)}`, { method: 'DELETE' });
    this.invalidatePlace(placeId);
  }

  async join(placeId: string): Promise<components['schemas']['JoinPlaceResultDto']> {
    const result = await this.auth.authenticatedRequest<components['schemas']['JoinPlaceResultDto']>(`/api/v1/places/${encodeURIComponent(placeId)}/join`, { body: {}, method: 'POST' });
    this.invalidatePlace(placeId);
    return result;
  }

  async acceptInvite(placeId: string, token: string): Promise<components['schemas']['JoinPlaceResultDto']> {
    const result = await this.auth.authenticatedRequest<components['schemas']['JoinPlaceResultDto']>(`/api/v1/places/${encodeURIComponent(placeId)}/invites/accept`, { body: { token }, method: 'POST' });
    this.invalidatePlace(placeId);
    return result;
  }

  async createInvite(placeId: string, input: { email?: string; roleId?: string }): Promise<Invite> {
    const invite = await this.auth.authenticatedRequest<Invite>(`/api/v1/places/${encodeURIComponent(placeId)}/invites`, {
      body: { ...input, expiresInHours: 168, maxUses: 1 },
      method: 'POST',
    });
    this.cache.deletePrefix(`place:${placeId}:invites`);
    return invite;
  }

  private protectedRead<T>(key: string, path: string): Promise<T> {
    return this.cache.getOrLoad(key, async () => {
      try {
        return await this.auth.authenticatedRequest<T>(path);
      } catch (error) {
        if (error instanceof DesktopApiError && ['forbidden', 'gone', 'not-found', 'unauthenticated'].includes(error.kind)) {
          this.cache.clearSensitive();
        }
        throw error;
      }
    }, true);
  }

  private publicRead<T>(path: string, loader: () => Promise<T>): Promise<T> {
    if (this.auth.user) {
      return this.protectedRead(`authorized:${path}`, path);
    }
    return this.cache.getOrLoad(`public:${path}`, loader);
  }

  private invalidatePlace(placeId: string): void {
    this.cache.deletePrefix(`place:${placeId}:`);
    this.cache.deletePrefix('public:/api/v1/places');
  }

  private placePath(placeSlug: string): string {
    return `/api/v1/places/${encodeURIComponent(placeSlug)}`;
  }
}