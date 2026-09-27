import { describe, expect, it, vi } from 'vitest';
import type { NativeAuthClient } from '../auth/auth-client';
import { NotificationClient } from './notification-client';

describe('NotificationClient', () => {
  it('maps inbox pagination and durable actions to API routes', async () => {
    const authenticatedRequest = vi.fn().mockResolvedValue({ items: [], unreadCount: 0 });
    const client = new NotificationClient({
      api: { pagePath: (path: string, cursor?: string) => `${path}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}` },
      authenticatedRequest,
    } as unknown as NativeAuthClient);

    await client.list('next+/=');
    await client.markRead('notification/id');
    await client.dismiss('notification/id');

    expect(authenticatedRequest.mock.calls).toEqual([
      ['/api/v1/notifications?cursor=next%2B%2F%3D'],
      ['/api/v1/notifications/notification%2Fid/read', { method: 'PATCH' }],
      ['/api/v1/notifications/notification%2Fid', { method: 'DELETE' }],
    ]);
  });
});