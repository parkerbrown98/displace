import { describe, expect, it, vi } from 'vitest';
import type { NativeAuthClient } from '../auth/auth-client';
import { ChatClient } from './chat-client';

describe('ChatClient', () => {
  it('uses a stable command identifier for REST idempotency', async () => {
    const authenticatedRequest = vi.fn().mockResolvedValue({ id: 'message' });
    const client = new ChatClient(createAuth(authenticatedRequest));

    await client.send('place/id', 'channel/id', 'Hello', 'command-id');

    expect(authenticatedRequest).toHaveBeenCalledWith('/api/v1/places/place%2Fid/chat/channels/channel%2Fid/messages', {
      body: { body: 'Hello', clientCommandId: 'command-id' },
      headers: { 'Idempotency-Key': 'command-id' },
      method: 'POST',
    });
  });

  it('encodes opaque message cursors and durable action paths', async () => {
    const authenticatedRequest = vi.fn().mockResolvedValue({ items: [] });
    const client = new ChatClient(createAuth(authenticatedRequest));

    await client.listMessages('place', 'channel', 'next+/=');
    await client.markRead('place', 'channel', 'message');
    await client.edit('place', 'message', 'Changed');
    await client.delete('place', 'message');

    expect(authenticatedRequest.mock.calls).toEqual([
      ['/api/v1/places/place/chat/channels/channel/messages?cursor=next%2B%2F%3D'],
      ['/api/v1/places/place/chat/channels/channel/read', { body: { messageId: 'message' }, method: 'PUT' }],
      ['/api/v1/places/place/chat/messages/message', { body: { body: 'Changed' }, method: 'PATCH' }],
      ['/api/v1/places/place/chat/messages/message', { method: 'DELETE' }],
    ]);
  });
});

function createAuth(authenticatedRequest: ReturnType<typeof vi.fn>): NativeAuthClient {
  return {
    api: {
      createCommandId: () => 'generated-command',
      pagePath: (path: string, cursor?: string) => `${path}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    },
    authenticatedRequest,
  } as unknown as NativeAuthClient;
}