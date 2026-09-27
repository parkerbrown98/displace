import { describe, expect, it, vi } from 'vitest';
import type { NativeAuthClient } from '../auth/auth-client';
import { createDesktopApi, DesktopApiError, type DesktopApi } from '../../lib/api/desktop-api';
import { ReadCache } from '../../lib/api/read-cache';
import { PlaceClient } from './place-client';

describe('PlaceClient', () => {
  it('encodes discovery filters and opaque cursors, then reuses the public read', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ items: [] }));
    const api = createDesktopApi({
      config: { apiOrigin: 'https://api.displace.test' },
      fetchImplementation,
      getAccessToken: () => null,
    });
    const client = new PlaceClient(createAuth(api), new ReadCache());
    const parameters = {
      cursor: 'next+/=cursor',
      joinPolicy: 'approval' as const,
      query: 'wood & tools',
      tag: 'hand craft',
    };

    await client.discover(parameters);
    await client.discover(parameters);

    expect(fetchImplementation).toHaveBeenCalledOnce();
    const url = requestUrl(fetchImplementation.mock.calls[0]?.[0]);
    expect(url.pathname).toBe('/api/v1/places');
    expect(url.searchParams.get('cursor')).toBe(parameters.cursor);
    expect(url.searchParams.get('joinPolicy')).toBe(parameters.joinPolicy);
    expect(url.searchParams.get('q')).toBe(parameters.query);
    expect(url.searchParams.get('tag')).toBe(parameters.tag);
  });

  it('purges cached protected reads after the server revokes access', async () => {
    const cache = new ReadCache();
    const reload = vi.fn(async () => 'reloaded');
    await cache.getOrLoad('private-fixture', async () => 'cached', true);
    const authenticatedRequest = vi.fn().mockRejectedValue(new DesktopApiError('forbidden'));
    const client = new PlaceClient(createAuth(stubApi(), authenticatedRequest), cache);

    await expect(client.context('place-one')).rejects.toMatchObject({ kind: 'forbidden' });
    await expect(cache.getOrLoad('private-fixture', reload, true)).resolves.toBe('reloaded');
    expect(reload).toHaveBeenCalledOnce();
  });

  it('loads the current user place shortcuts as a protected read', async () => {
    const authenticatedRequest = vi.fn().mockResolvedValue({ items: [] });
    const client = new PlaceClient(createAuth(stubApi(), authenticatedRequest, true), new ReadCache());

    await client.mine();
    await client.mine();

    expect(authenticatedRequest).toHaveBeenCalledOnce();
    expect(authenticatedRequest).toHaveBeenCalledWith('/api/v1/places/mine');
  });

  it('keeps authorization-shaped place reads in the sensitive cache', async () => {
    const cache = new ReadCache();
    const authenticatedRequest = vi.fn().mockResolvedValue({ id: 'private-place' });
    const client = new PlaceClient(createAuth(stubApi(), authenticatedRequest, true), cache);

    await client.get('private-place');
    await client.get('private-place');
    cache.clearSensitive();
    await client.get('private-place');

    expect(authenticatedRequest).toHaveBeenCalledTimes(2);
    expect(authenticatedRequest).toHaveBeenCalledWith('/api/v1/places/private-place');
  });

  it('creates topics and replies with a fresh idempotency key', async () => {
    const authenticatedRequest = vi.fn().mockResolvedValue({ id: 'created' });
    const client = new PlaceClient(createAuth(stubApi(), authenticatedRequest, true), new ReadCache());
    const document = { content: [{ content: [{ text: 'Hello', type: 'text' }], type: 'paragraph' }], type: 'doc', version: 1 };

    await client.createTopic('place/id', 'forum/id', { document, tagIds: [], title: 'A topic' });
    await client.createReply('place/id', 'topic/id', document);

    expect(authenticatedRequest).toHaveBeenNthCalledWith(1, '/api/v1/places/place%2Fid/forums/forum%2Fid/topics', {
      body: { document, tagIds: [], title: 'A topic' },
      headers: { 'Idempotency-Key': 'idempotency' },
      method: 'POST',
    });
    expect(authenticatedRequest).toHaveBeenNthCalledWith(2, '/api/v1/places/place%2Fid/topics/topic%2Fid/posts', {
      body: { document },
      headers: { 'Idempotency-Key': 'idempotency' },
      method: 'POST',
    });
  });

  it('maps durable topic and post toggles to their server endpoints', async () => {
    const authenticatedRequest = vi.fn().mockResolvedValue({ id: 'topic' });
    const client = new PlaceClient(createAuth(stubApi(), authenticatedRequest, true), new ReadCache());

    await client.setTopicFollow('place', 'topic', true);
    await client.setTopicSave('place', 'topic', false);
    await client.setPostSave('place', 'post', true);
    await client.setReaction('place', 'post', 'helpful', false);
    await client.markTopicRead('place', 'topic', 'last-post');
    await client.setTopicPin('place', 'topic', true);

    expect(authenticatedRequest.mock.calls).toEqual([
      ['/api/v1/places/place/topics/topic/follow', { method: 'POST' }],
      ['/api/v1/places/place/topics/topic/save', { method: 'DELETE' }],
      ['/api/v1/places/place/posts/post/save', { method: 'POST' }],
      ['/api/v1/places/place/posts/post/reactions/helpful', { body: undefined, method: 'DELETE' }],
      ['/api/v1/places/place/topics/topic/read', { body: { lastReadPostId: 'last-post' }, method: 'PUT' }],
      ['/api/v1/places/place/topics/topic/pin', { method: 'POST' }],
    ]);
  });

  it('maps member, invitation, and role administration to scoped endpoints', async () => {
    const authenticatedRequest = vi.fn().mockResolvedValue({ id: 'result', token: 'invite-token' });
    const client = new PlaceClient(createAuth(stubApi(), authenticatedRequest, true), new ReadCache());

    await client.createInvite('place/id', { email: 'member@example.com', roleId: 'role/id' });
    await client.approveMember('place/id', 'member/id');
    await client.assignRole('place/id', 'member/id', 'role/id');
    await client.removeRole('place/id', 'member/id', 'role/id');
    await client.transferOwnership('place/id', 'user/id');
    await client.removeMember('place/id', 'member/id');

    expect(authenticatedRequest.mock.calls).toEqual([
      ['/api/v1/places/place%2Fid/invites', { body: { email: 'member@example.com', expiresInHours: 168, maxUses: 1, roleId: 'role/id' }, method: 'POST' }],
      ['/api/v1/places/place%2Fid/members/member%2Fid/approve', { method: 'POST' }],
      ['/api/v1/places/place%2Fid/members/member%2Fid/roles', { body: { roleId: 'role/id' }, method: 'POST' }],
      ['/api/v1/places/place%2Fid/members/member%2Fid/roles/role%2Fid', { method: 'DELETE' }],
      ['/api/v1/places/place%2Fid/ownership', { body: { userId: 'user/id' }, method: 'POST' }],
      ['/api/v1/places/place%2Fid/members/member%2Fid', { method: 'DELETE' }],
    ]);
  });

  it('maps forum, chat, and voice settings mutations to scoped endpoints', async () => {
    const authenticatedRequest = vi.fn().mockResolvedValue({ id: 'result' });
    const client = new PlaceClient(createAuth(stubApi(), authenticatedRequest, true), new ReadCache());

    await client.createForumGroup('place', { description: '', name: 'Guides', position: 0 });
    await client.createForum('place', { groupId: 'group', name: 'General', position: 0, visibility: 'members' });
    await client.createForumTag('place', { color: '#123456', name: 'Help', slug: 'help' });
    await client.createChatChannel('place', { name: 'Lobby', position: 0, slug: 'lobby', visibility: 'members' });
    await client.createVoiceRoom('place', { capacity: 25, listenPermission: 'voice.join', name: 'Standup', position: 0, slug: 'standup', speakPermission: 'voice.join' });

    expect(authenticatedRequest.mock.calls).toEqual([
      ['/api/v1/places/place/forum-groups', { body: { description: '', name: 'Guides', position: 0 }, method: 'POST' }],
      ['/api/v1/places/place/forums', { body: { groupId: 'group', name: 'General', position: 0, visibility: 'members' }, method: 'POST' }],
      ['/api/v1/places/place/forum-tags', { body: { color: '#123456', name: 'Help', slug: 'help' }, method: 'POST' }],
      ['/api/v1/places/place/chat/channels', { body: { name: 'Lobby', position: 0, slug: 'lobby', visibility: 'members' }, method: 'POST' }],
      ['/api/v1/places/place/voice/rooms', { body: { capacity: 25, listenPermission: 'voice.join', name: 'Standup', position: 0, slug: 'standup', speakPermission: 'voice.join' }, method: 'POST' }],
    ]);
  });

  it('reads and assigns place images through the asset endpoints', async () => {
    const authenticatedRequest = vi.fn().mockResolvedValue({ assetId: 'asset/id', url: 'https://assets.test/image' });
    const client = new PlaceClient(createAuth(stubApi(), authenticatedRequest, true), new ReadCache());

    await client.placeImage('place/id', 'icon');
    await client.assetDownload('place/id', 'asset/id');
    await client.setPlaceImage('place/id', 'banner', 'asset/id');

    expect(authenticatedRequest.mock.calls).toEqual([
      ['/api/v1/places/place%2Fid/assets/place-images/icon'],
      ['/api/v1/places/place%2Fid/assets/downloads/asset%2Fid'],
      ['/api/v1/places/place%2Fid/assets/place-images/banner', { body: { assetId: 'asset/id' }, method: 'PUT' }],
    ]);
  });
});

function createAuth(api: DesktopApi, authenticatedRequest = vi.fn(), authenticated = false) {
  return { api, authenticatedRequest, user: authenticated ? { id: 'user-one' } : null } as unknown as Pick<NativeAuthClient, 'api' | 'authenticatedRequest' | 'user'>;
}

function stubApi(): DesktopApi {
  return {
    client: {} as DesktopApi['client'],
    createCommandId: () => 'command',
    createIdempotencyKey: () => 'idempotency',
    pagePath: (path) => path,
    request: vi.fn(),
    run: (operation) => operation,
  };
}

function requestUrl(input: RequestInfo | URL | undefined): URL {
  if (input instanceof Request) return new URL(input.url);
  return new URL(String(input));
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
}