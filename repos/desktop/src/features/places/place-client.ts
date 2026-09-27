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
export type Post = components['schemas']['PostDto'];
export type PostPage = components['schemas']['PostPageDto'];
export type PostRevision = components['schemas']['PostRevisionDto'];
export type TopicViewerState = components['schemas']['TopicViewerStateDto'];
export type RichTextDocument = components['schemas']['RichTextDocumentDto']['document'];
export type PublicProfile = components['schemas']['PublicProfileDto'];
export type SearchPage = components['schemas']['SearchPageDto'];
export type MemberPage = components['schemas']['MemberPageDto'];
export type Member = components['schemas']['MemberDto'];
export type RolePage = components['schemas']['RolePageDto'];
export type Role = components['schemas']['RoleDto'];
export type InvitePage = components['schemas']['InvitePageDto'];
export type Invite = components['schemas']['InviteDto'];
export type Forum = components['schemas']['ForumDto'];
export type ForumGroup = components['schemas']['ForumGroupDto'];
export type ForumTag = components['schemas']['ForumTagDto'];
export type ChatChannel = components['schemas']['ChatChannelDto'];
export type VoiceRoom = components['schemas']['VoiceRoomDto'];
export type PlacePermission = PlaceContext['viewer']['permissions'][number];
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

  async createTopic(placeId: string, forumId: string, input: { document: RichTextDocument; tagIds: string[]; title: string }): Promise<Topic> {
    const topic = await this.auth.authenticatedRequest<Topic>(`${this.placePath(placeId)}/forums/${encodeURIComponent(forumId)}/topics`, {
      body: input,
      headers: { 'Idempotency-Key': this.auth.api.createIdempotencyKey() },
      method: 'POST',
    });
    this.invalidateForums();
    return topic;
  }

  async createReply(placeId: string, topicId: string, document: RichTextDocument): Promise<Post> {
    const post = await this.auth.authenticatedRequest<Post>(`${this.placePath(placeId)}/topics/${encodeURIComponent(topicId)}/posts`, {
      body: { document },
      headers: { 'Idempotency-Key': this.auth.api.createIdempotencyKey() },
      method: 'POST',
    });
    this.invalidateForums();
    return post;
  }

  viewerState(placeId: string, topicId: string): Promise<TopicViewerState> {
    return this.protectedRead(`place:${placeId}:topic:${topicId}:viewer`, `${this.placePath(placeId)}/topics/${encodeURIComponent(topicId)}/viewer-state`);
  }

  async updateTopic(placeId: string, topicId: string, input: { tagIds?: string[]; title?: string }): Promise<Topic> {
    const topic = await this.auth.authenticatedRequest<Topic>(`${this.placePath(placeId)}/topics/${encodeURIComponent(topicId)}`, { body: input, method: 'PATCH' });
    this.invalidateForums();
    return topic;
  }

  async deleteTopic(placeId: string, topicId: string): Promise<void> {
    await this.auth.authenticatedRequest(`${this.placePath(placeId)}/topics/${encodeURIComponent(topicId)}`, { method: 'DELETE' });
    this.invalidateForums();
  }

  async editPost(placeId: string, postId: string, document: RichTextDocument, expectedVersion: number): Promise<Post> {
    const post = await this.auth.authenticatedRequest<Post>(`${this.placePath(placeId)}/posts/${encodeURIComponent(postId)}`, {
      body: { document, expectedVersion },
      method: 'PATCH',
    });
    this.invalidateForums();
    return post;
  }

  async deletePost(placeId: string, postId: string): Promise<void> {
    await this.auth.authenticatedRequest(`${this.placePath(placeId)}/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' });
    this.invalidateForums();
  }

  revisions(placeId: string, postId: string): Promise<PostRevision[]> {
    return this.protectedRead(`place:${placeId}:post:${postId}:revisions`, `${this.placePath(placeId)}/posts/${encodeURIComponent(postId)}/revisions`);
  }

  async setReaction(placeId: string, postId: string, reaction: string, enabled: boolean): Promise<void> {
    const basePath = `${this.placePath(placeId)}/posts/${encodeURIComponent(postId)}/reactions`;
    await this.auth.authenticatedRequest(enabled ? basePath : `${basePath}/${encodeURIComponent(reaction)}`, {
      body: enabled ? { reaction } : undefined,
      method: enabled ? 'POST' : 'DELETE',
    });
    this.invalidateForums();
  }

  setTopicFollow(placeId: string, topicId: string, enabled: boolean): Promise<void> {
    return this.setTopicFlag(placeId, topicId, 'follow', enabled);
  }

  setTopicSave(placeId: string, topicId: string, enabled: boolean): Promise<void> {
    return this.setTopicFlag(placeId, topicId, 'save', enabled);
  }

  async setPostSave(placeId: string, postId: string, enabled: boolean): Promise<void> {
    await this.auth.authenticatedRequest(`${this.placePath(placeId)}/posts/${encodeURIComponent(postId)}/save`, { method: enabled ? 'POST' : 'DELETE' });
    this.invalidateForums();
  }

  async markTopicRead(placeId: string, topicId: string, lastReadPostId?: string): Promise<void> {
    await this.auth.authenticatedRequest(`${this.placePath(placeId)}/topics/${encodeURIComponent(topicId)}/read`, {
      body: lastReadPostId ? { lastReadPostId } : {},
      method: 'PUT',
    });
    this.invalidateForums();
  }

  async markTopicUnread(placeId: string, topicId: string): Promise<void> {
    await this.auth.authenticatedRequest(`${this.placePath(placeId)}/topics/${encodeURIComponent(topicId)}/read`, { method: 'DELETE' });
    this.invalidateForums();
  }

  async setTopicLock(placeId: string, topicId: string, enabled: boolean): Promise<Topic> {
    return this.setTopicState(placeId, topicId, 'lock', enabled);
  }

  async setTopicPin(placeId: string, topicId: string, enabled: boolean): Promise<Topic> {
    return this.setTopicState(placeId, topicId, 'pin', enabled);
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

  members(placeId: string, query?: string, status: 'active' | 'pending' = 'active'): Promise<MemberPage> {
    const path = `/api/v1/places/${encodeURIComponent(placeId)}/members?status=${status}&limit=24&sort=last_seen${query ? `&q=${encodeURIComponent(query)}` : ''}`;
    return this.protectedRead(`place:${placeId}:members:${status}:${query ?? ''}`, path);
  }

  member(placeId: string, memberId: string): Promise<Member> {
    return this.protectedRead(`place:${placeId}:member:${memberId}`, `/api/v1/places/${encodeURIComponent(placeId)}/members/${encodeURIComponent(memberId)}`);
  }

  roles(placeId: string): Promise<RolePage> {
    return this.protectedRead(`place:${placeId}:roles`, `/api/v1/places/${encodeURIComponent(placeId)}/roles`);
  }

  invites(placeId: string): Promise<InvitePage> {
    return this.protectedRead(`place:${placeId}:invites`, `/api/v1/places/${encodeURIComponent(placeId)}/invites`);
  }

  forumSettings(placeId: string): Promise<ForumNavigation> {
    return this.protectedRead(`place:${placeId}:forum-settings`, `/api/v1/places/${encodeURIComponent(placeId)}/forums`);
  }

  chatChannels(placeId: string): Promise<ChatChannel[]> {
    return this.protectedRead(`place:${placeId}:chat-channels`, `/api/v1/places/${encodeURIComponent(placeId)}/chat/channels`);
  }

  voiceRooms(placeId: string): Promise<VoiceRoom[]> {
    return this.protectedRead(`place:${placeId}:voice-rooms`, `/api/v1/places/${encodeURIComponent(placeId)}/voice/rooms`);
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

  async revokeInvite(placeId: string, inviteId: string): Promise<void> {
    await this.auth.authenticatedRequest(`/api/v1/places/${encodeURIComponent(placeId)}/invites/${encodeURIComponent(inviteId)}`, { method: 'DELETE' });
    this.invalidateManagement(placeId, 'invites');
  }

  async approveMember(placeId: string, memberId: string): Promise<Member> {
    const member = await this.auth.authenticatedRequest<Member>(`/api/v1/places/${encodeURIComponent(placeId)}/members/${encodeURIComponent(memberId)}/approve`, { method: 'POST' });
    this.invalidateManagement(placeId, 'members');
    return member;
  }

  async removeMember(placeId: string, memberId: string): Promise<void> {
    await this.auth.authenticatedRequest(`/api/v1/places/${encodeURIComponent(placeId)}/members/${encodeURIComponent(memberId)}`, { method: 'DELETE' });
    this.invalidateManagement(placeId, 'members');
  }

  async transferOwnership(placeId: string, userId: string): Promise<void> {
    await this.auth.authenticatedRequest(`/api/v1/places/${encodeURIComponent(placeId)}/ownership`, { body: { userId }, method: 'POST' });
    this.invalidatePlace(placeId);
  }

  async createRole(placeId: string, input: components['schemas']['CreateRoleDto']): Promise<Role> {
    const role = await this.auth.authenticatedRequest<Role>(`/api/v1/places/${encodeURIComponent(placeId)}/roles`, { body: input, method: 'POST' });
    this.invalidateManagement(placeId, 'roles');
    return role;
  }

  async updateRole(placeId: string, roleId: string, input: components['schemas']['UpdateRoleDto']): Promise<Role> {
    const role = await this.auth.authenticatedRequest<Role>(`/api/v1/places/${encodeURIComponent(placeId)}/roles/${encodeURIComponent(roleId)}`, { body: input, method: 'PATCH' });
    this.invalidateManagement(placeId, 'roles');
    return role;
  }

  async deleteRole(placeId: string, roleId: string): Promise<void> {
    await this.auth.authenticatedRequest(`/api/v1/places/${encodeURIComponent(placeId)}/roles/${encodeURIComponent(roleId)}`, { method: 'DELETE' });
    this.invalidateManagement(placeId, 'roles');
  }

  async assignRole(placeId: string, memberId: string, roleId: string): Promise<Member> {
    const member = await this.auth.authenticatedRequest<Member>(`/api/v1/places/${encodeURIComponent(placeId)}/members/${encodeURIComponent(memberId)}/roles`, { body: { roleId }, method: 'POST' });
    this.invalidateManagement(placeId, 'members');
    return member;
  }

  async removeRole(placeId: string, memberId: string, roleId: string): Promise<Member> {
    const member = await this.auth.authenticatedRequest<Member>(`/api/v1/places/${encodeURIComponent(placeId)}/members/${encodeURIComponent(memberId)}/roles/${encodeURIComponent(roleId)}`, { method: 'DELETE' });
    this.invalidateManagement(placeId, 'members');
    return member;
  }

  async createForumGroup(placeId: string, input: components['schemas']['CreateForumGroupDto']): Promise<ForumGroup> {
    const group = await this.auth.authenticatedRequest<ForumGroup>(`/api/v1/places/${encodeURIComponent(placeId)}/forum-groups`, { body: input, method: 'POST' });
    this.invalidateManagement(placeId, 'forum-settings');
    return group;
  }

  async updateForumGroup(placeId: string, groupId: string, input: components['schemas']['UpdateForumGroupDto']): Promise<ForumGroup> {
    const group = await this.auth.authenticatedRequest<ForumGroup>(`/api/v1/places/${encodeURIComponent(placeId)}/forum-groups/${encodeURIComponent(groupId)}`, { body: input, method: 'PATCH' });
    this.invalidateManagement(placeId, 'forum-settings');
    return group;
  }

  async deleteForumGroup(placeId: string, groupId: string): Promise<void> {
    await this.auth.authenticatedRequest(`/api/v1/places/${encodeURIComponent(placeId)}/forum-groups/${encodeURIComponent(groupId)}`, { method: 'DELETE' });
    this.invalidateManagement(placeId, 'forum-settings');
  }

  async createForum(placeId: string, input: components['schemas']['CreateForumDto']): Promise<Forum> {
    const forum = await this.auth.authenticatedRequest<Forum>(`/api/v1/places/${encodeURIComponent(placeId)}/forums`, { body: input, method: 'POST' });
    this.invalidateManagement(placeId, 'forum-settings');
    return forum;
  }

  async updateForum(placeId: string, forumId: string, input: components['schemas']['UpdateForumDto']): Promise<Forum> {
    const forum = await this.auth.authenticatedRequest<Forum>(`/api/v1/places/${encodeURIComponent(placeId)}/forums/${encodeURIComponent(forumId)}`, { body: input, method: 'PATCH' });
    this.invalidateManagement(placeId, 'forum-settings');
    return forum;
  }

  async archiveForum(placeId: string, forumId: string): Promise<void> {
    await this.auth.authenticatedRequest(`/api/v1/places/${encodeURIComponent(placeId)}/forums/${encodeURIComponent(forumId)}`, { method: 'DELETE' });
    this.invalidateManagement(placeId, 'forum-settings');
  }

  async createForumTag(placeId: string, input: components['schemas']['CreateForumTagDto']): Promise<ForumTag> {
    const tag = await this.auth.authenticatedRequest<ForumTag>(`/api/v1/places/${encodeURIComponent(placeId)}/forum-tags`, { body: input, method: 'POST' });
    this.invalidateManagement(placeId, 'forum-settings');
    return tag;
  }

  async deleteForumTag(placeId: string, tagId: string): Promise<void> {
    await this.auth.authenticatedRequest(`/api/v1/places/${encodeURIComponent(placeId)}/forum-tags/${encodeURIComponent(tagId)}`, { method: 'DELETE' });
    this.invalidateManagement(placeId, 'forum-settings');
  }

  async createChatChannel(placeId: string, input: components['schemas']['CreateChatChannelDto']): Promise<ChatChannel> {
    const channel = await this.auth.authenticatedRequest<ChatChannel>(`/api/v1/places/${encodeURIComponent(placeId)}/chat/channels`, { body: input, method: 'POST' });
    this.invalidateManagement(placeId, 'chat-channels');
    return channel;
  }

  async updateChatChannel(placeId: string, channelId: string, input: components['schemas']['UpdateChatChannelDto']): Promise<ChatChannel> {
    const channel = await this.auth.authenticatedRequest<ChatChannel>(`/api/v1/places/${encodeURIComponent(placeId)}/chat/channels/${encodeURIComponent(channelId)}`, { body: input, method: 'PATCH' });
    this.invalidateManagement(placeId, 'chat-channels');
    return channel;
  }

  async archiveChatChannel(placeId: string, channelId: string): Promise<void> {
    await this.auth.authenticatedRequest(`/api/v1/places/${encodeURIComponent(placeId)}/chat/channels/${encodeURIComponent(channelId)}`, { method: 'DELETE' });
    this.invalidateManagement(placeId, 'chat-channels');
  }

  async createVoiceRoom(placeId: string, input: components['schemas']['CreateVoiceRoomDto']): Promise<VoiceRoom> {
    const room = await this.auth.authenticatedRequest<VoiceRoom>(`/api/v1/places/${encodeURIComponent(placeId)}/voice/rooms`, { body: input, method: 'POST' });
    this.invalidateManagement(placeId, 'voice-rooms');
    return room;
  }

  async updateVoiceRoom(placeId: string, roomId: string, input: components['schemas']['UpdateVoiceRoomDto']): Promise<VoiceRoom> {
    const room = await this.auth.authenticatedRequest<VoiceRoom>(`/api/v1/places/${encodeURIComponent(placeId)}/voice/rooms/${encodeURIComponent(roomId)}`, { body: input, method: 'PATCH' });
    this.invalidateManagement(placeId, 'voice-rooms');
    return room;
  }

  async archiveVoiceRoom(placeId: string, roomId: string): Promise<void> {
    await this.auth.authenticatedRequest(`/api/v1/places/${encodeURIComponent(placeId)}/voice/rooms/${encodeURIComponent(roomId)}`, { method: 'DELETE' });
    this.invalidateManagement(placeId, 'voice-rooms');
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
    this.cache.deletePrefix('authorized:/api/v1/places');
  }

  private invalidateManagement(placeId: string, resource: string): void {
    this.cache.deletePrefix(`place:${placeId}:${resource}`);
    this.cache.deletePrefix(`place:${placeId}:context`);
  }

  private async setTopicFlag(placeId: string, topicId: string, flag: 'follow' | 'save', enabled: boolean): Promise<void> {
    await this.auth.authenticatedRequest(`${this.placePath(placeId)}/topics/${encodeURIComponent(topicId)}/${flag}`, { method: enabled ? 'POST' : 'DELETE' });
    this.invalidateForums();
  }

  private async setTopicState(placeId: string, topicId: string, state: 'lock' | 'pin', enabled: boolean): Promise<Topic> {
    const topic = await this.auth.authenticatedRequest<Topic>(`${this.placePath(placeId)}/topics/${encodeURIComponent(topicId)}/${state}`, { method: enabled ? 'POST' : 'DELETE' });
    this.invalidateForums();
    return topic;
  }

  private invalidateForums(): void {
    this.cache.deletePrefix('public:/api/v1/places');
    this.cache.deletePrefix('authorized:/api/v1/places');
    this.cache.deletePrefix('place:');
  }

  private placePath(placeSlug: string): string {
    return `/api/v1/places/${encodeURIComponent(placeSlug)}`;
  }
}