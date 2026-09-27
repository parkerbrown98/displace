import { describe, expect, it, vi } from 'vitest';
import { createApiClient, withCursor } from './http.js';

describe('createApiClient', () => {
  it('adds standard headers and returns typed endpoint data', async () => {
    const fetchImplementation = vi.fn(async (request: Request) => {
      expect(request.url).toBe('https://api.example.com/api/v1/auth/me');
      expect(request.headers.get('Accept')).toBe('application/json');
      expect(request.headers.get('X-Request-Id')).toBe('request-id');
      return Response.json({ id: 'user-id' });
    });
    const client = createApiClient({
      baseUrl: 'https://api.example.com',
      createRequestId: () => 'request-id',
      fetch: fetchImplementation,
    });

    const result = await client.GET('/api/v1/auth/me');

    expect(result.data).toEqual({ id: 'user-id' });
  });

  it('throws an ApiError for problem responses', async () => {
    const client = createApiClient({
      baseUrl: 'https://api.example.com',
      fetch: async () => Response.json(
        { detail: 'Sign in again.', status: 401, title: 'Unauthorized' },
        { status: 401 },
      ),
    });

    await expect(client.GET('/api/v1/auth/me')).rejects.toMatchObject({
      message: 'Sign in again.',
      name: 'ApiError',
      problem: { status: 401, title: 'Unauthorized' },
    });
  });
});

describe('withCursor', () => {
  it('serializes cursor and optional filters', () => {
    expect(withCursor('/places', 'next value', { tag: 'typescript' }))
      .toBe('/places?cursor=next+value&tag=typescript');
  });
});