import type { components } from '@displace/api-client';
import { authenticatedMutation, authenticatedRead } from './auth-client';

export type ApiToken = components['schemas']['ApiTokenDto'];
export type ApiTokenScope = ApiToken['scopes'][number];
export type CreateApiTokenInput = components['schemas']['CreateApiTokenDto'];
export type IssuedApiToken = components['schemas']['IssuedApiTokenDto'];

export function listApiTokens(): Promise<ApiToken[]> {
  return authenticatedRead<ApiToken[]>('/developer/tokens');
}

export function createApiToken(input: CreateApiTokenInput): Promise<IssuedApiToken> {
  return authenticatedMutation<IssuedApiToken>('/developer/tokens', {
    body: input,
    method: 'POST',
  });
}

export function rotateApiToken(tokenId: string, expiresAt?: string): Promise<IssuedApiToken> {
  return authenticatedMutation<IssuedApiToken>(
    `/developer/tokens/${encodeURIComponent(tokenId)}/rotate`,
    {
      body: expiresAt ? { expiresAt } : {},
      method: 'POST',
    },
  );
}

export function revokeApiToken(tokenId: string): Promise<void> {
  return authenticatedMutation<void>(
    `/developer/tokens/${encodeURIComponent(tokenId)}`,
    { method: 'DELETE' },
  );
}