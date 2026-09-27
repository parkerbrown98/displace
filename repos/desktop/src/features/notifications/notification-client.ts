import type { components } from '@displace/api-client';
import type { NativeAuthClient } from '../auth/auth-client';

export type Notification = components['schemas']['NotificationDto'];
export type NotificationPage = components['schemas']['NotificationPageDto'];

export class NotificationClient {
  constructor(private readonly auth: NativeAuthClient) {}

  list(cursor?: string): Promise<NotificationPage> {
    return this.auth.authenticatedRequest(this.auth.api.pagePath('/api/v1/notifications', cursor));
  }

  markRead(notificationId: string): Promise<Notification> {
    return this.auth.authenticatedRequest(`/api/v1/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'PATCH' });
  }

  dismiss(notificationId: string): Promise<void> {
    return this.auth.authenticatedRequest(`/api/v1/notifications/${encodeURIComponent(notificationId)}`, { method: 'DELETE' });
  }
}