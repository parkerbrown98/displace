import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { mockServer } from '@/test/mocks/server';
import { resetAuthenticationForTests, signIn } from './auth-client';
import { userProfileFixture } from './auth-fixtures';
import {
  createApiToken,
  listApiTokens,
  revokeApiToken,
  rotateApiToken,
  type ApiToken,
  type IssuedApiToken,
} from './api-token-client';

const token: ApiToken = {
  createdAt: '2026-09-26T12:00:00.000Z',
  expiresAt: '2026-10-26T12:00:00.000Z',
  id: '01997a4e-a200-7000-8000-000000000001',
  lastUsedAt: null,
  name: 'Deploy automation',
  prefix: 'dsp_abcd1234',
  revokedAt: null,
  scopes: ['read', 'write'],
};
const issued: IssuedApiToken = { ...token, token: 'dsp_one-time-secret' };

describe('API token client', () => {
  afterEach(() => resetAuthenticationForTests());

  it('uses the authenticated generated contract for the complete token lifecycle', async () => {
    mockServer.use(
      http.post('http://localhost:3001/api/v1/auth/login', () => HttpResponse.json({
        accessToken: 'access-token',
        csrfToken: 'csrf-token',
        expiresInSeconds: 900,
        user: userProfileFixture,
      })),
      http.get('http://localhost:3001/api/v1/developer/tokens', ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer access-token');
        return HttpResponse.json([token]);
      }),
      http.post('http://localhost:3001/api/v1/developer/tokens', async ({ request }) => {
        expect(request.headers.get('X-CSRF-Token')).toBe('csrf-token');
        expect(await request.json()).toEqual({
          expiresAt: token.expiresAt,
          name: token.name,
          scopes: token.scopes,
        });
        return HttpResponse.json(issued, { status: 201 });
      }),
      http.post('http://localhost:3001/api/v1/developer/tokens/:tokenId/rotate', async ({ params, request }) => {
        expect(params.tokenId).toBe(token.id);
        expect(await request.json()).toEqual({});
        return HttpResponse.json({ ...issued, token: 'dsp_rotated-secret' }, { status: 201 });
      }),
      http.delete('http://localhost:3001/api/v1/developer/tokens/:tokenId', ({ params }) => {
        expect(params.tokenId).toBe(token.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await signIn({ identifier: 'parker', password: 'password' });
    await expect(listApiTokens()).resolves.toEqual([token]);
    await expect(createApiToken({
      expiresAt: token.expiresAt,
      name: token.name,
      scopes: token.scopes,
    })).resolves.toEqual(issued);
    await expect(rotateApiToken(token.id)).resolves.toMatchObject({ token: 'dsp_rotated-secret' });
    await expect(revokeApiToken(token.id)).resolves.toBeUndefined();
  });
});