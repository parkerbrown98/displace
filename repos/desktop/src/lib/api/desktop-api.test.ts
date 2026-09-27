import { ApiError } from '@displace/api-client/http';
import { describe, expect, it, vi } from 'vitest';
import { createDesktopApi, normalizeApiError } from './desktop-api';

describe('desktop API adapter', () => {
  it('adds the in-memory access token and request identifiers', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const api = createDesktopApi({
      config: { apiOrigin: 'https://api.displace.example' },
      fetchImplementation,
      getAccessToken: () => 'memory-only-token',
    });

    await api.request('/api/v1/health');

    const request = fetchImplementation.mock.calls[0]?.[1];
    const headers = new Headers(request?.headers);
    expect(headers.get('Authorization')).toBe('Bearer memory-only-token');
    expect(headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('normalizes RFC 9457 authorization failures', () => {
    const error = normalizeApiError(
      new ApiError({ status: 403, title: 'Forbidden', requestId: 'request-42' }),
    );

    expect(error.kind).toBe('forbidden');
    expect(error.requestId).toBe('request-42');
  });

  it('normalizes connectivity failures without exposing transport details', () => {
    expect(normalizeApiError(new TypeError('fetch failed')).kind).toBe('offline');
  });
});