import { describe, expect, it, vi } from 'vitest';
import { MemoryNativePlatform } from '../../lib/platform/native-platform';
import { NativeAuthClient, type Authentication } from './auth-client';

const authentication: Authentication = {
  accessToken: 'access-one',
  expiresInSeconds: 900,
  refreshToken: 'refresh-one-that-is-long-enough-for-the-api',
  user: {
    displayName: 'Parker',
    email: 'parker@example.test',
    emailVerified: true,
    handle: 'parker',
    id: 'user-1',
    isInstanceAdmin: false,
  },
};
const config = { apiOrigin: 'https://api.example.test', oidcCallbackScheme: 'displace-test' };

describe('NativeAuthClient', () => {
  it('stores native refresh tokens and sends bearer access tokens', async () => {
    const platform = new MemoryNativePlatform();
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(authentication))
      .mockResolvedValueOnce(jsonResponse(authentication.user));
    const client = new NativeAuthClient(config, platform, fetchMock);

    await client.signIn({ identifier: 'parker', password: 'correct horse battery staple' });
    await client.getCurrentProfile();

    expect(await platform.inspectRefreshToken()).toBe(authentication.refreshToken);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      refreshTokenDelivery: 'response_body',
    });
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('Authorization')).toBe('Bearer access-one');
  });

  it('serializes concurrent refresh attempts and stores the rotated token', async () => {
    let resolveResponse!: (response: Response) => void;
    const fetchMock = vi.fn<typeof fetch>(() => new Promise((resolve) => { resolveResponse = resolve; }));
    const platform = new MemoryNativePlatform(fetchMock);
    await platform.storeRefreshToken('refresh-old-that-is-long-enough-for-the-api');
    const client = new NativeAuthClient(config, platform, fetchMock);

    const first = client.refreshAuthentication();
    const second = client.refreshAuthentication();
    expect(first).toBe(second);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    resolveResponse(jsonResponse({ ...authentication, refreshToken: 'refresh-rotated-that-is-long-enough' }));
    await first;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await platform.inspectRefreshToken()).toBe('refresh-rotated-that-is-long-enough');
  });

  it('clears secure storage when a refresh token is rejected', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(problemResponse(401));
    const platform = new MemoryNativePlatform(fetchMock);
    await platform.storeRefreshToken('refresh-revoked-that-is-long-enough');
    const client = new NativeAuthClient(config, platform, fetchMock);
    const invalidated = vi.fn();
    client.onSessionInvalidated(invalidated);

    await expect(client.initialize()).resolves.toBeNull();
    expect(await platform.hasRefreshToken()).toBe(false);
    expect(client.user).toBeNull();
    expect(invalidated).toHaveBeenCalledOnce();
  });

  it('restores a persisted session after the application reopens', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(authentication));
    const platform = new MemoryNativePlatform(fetchMock);
    await platform.storeRefreshToken('refresh-persisted-that-is-long-enough');
    const client = new NativeAuthClient(config, platform, fetchMock);

    await expect(client.initialize()).resolves.toEqual(withoutRefreshToken(authentication));
    expect(client.user).toEqual(authentication.user);
    expect(await platform.inspectRefreshToken()).toBe(authentication.refreshToken);
  });

  it('preserves the persisted session when offline at startup', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'));
    const platform = new MemoryNativePlatform(fetchMock);
    const token = 'refresh-persisted-that-is-long-enough';
    await platform.storeRefreshToken(token);
    const client = new NativeAuthClient(config, platform, fetchMock);

    await expect(client.initialize()).rejects.toMatchObject({ kind: 'offline' });
    expect(await platform.inspectRefreshToken()).toBe(token);
  });

  it('uses PKCE without placing application tokens in browser or deep-link URLs', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(authentication));
    const platform = new MemoryNativePlatform(fetchMock);
    const open = vi.spyOn(platform, 'openExternalUrl');
    const client = new NativeAuthClient(config, platform, fetchMock);

    await client.beginOidcSignIn();
    const authorizationUrl = new URL(String(open.mock.calls[0]?.[0]));
    expect(authorizationUrl.pathname).toBe('/api/v1/auth/oidc/native/authorize');
    expect(authorizationUrl.searchParams.get('codeChallenge')).toHaveLength(43);
    expect(authorizationUrl.toString()).not.toContain('access-one');
    expect(authorizationUrl.toString()).not.toContain('refresh-one');

    const state = authorizationUrl.searchParams.get('state');
    const callback = `displace-test://auth/callback?code=provider-code&state=${state}`;
    await client.completeOidcSignIn(callback);
    await expect(client.completeOidcSignIn(callback)).rejects.toThrow(/invalid or expired/i);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ callbackUrl: callback });
    expect(callback).not.toContain(authentication.accessToken);
    expect(callback).not.toContain(authentication.refreshToken);
  });
});

function withoutRefreshToken(value: Authentication): Authentication {
  const authenticationWithoutRefreshToken = { ...value };
  delete authenticationWithoutRefreshToken.refreshToken;
  return authenticationWithoutRefreshToken;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
}

function problemResponse(status: number): Response {
  return new Response(JSON.stringify({ status, title: 'Authentication required' }), {
    headers: { 'Content-Type': 'application/problem+json' },
    status,
  });
}