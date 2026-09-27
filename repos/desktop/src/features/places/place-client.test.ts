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