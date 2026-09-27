import { authenticatedMutation, authenticatedRead } from "@/features/auth/auth-client";
import type { components } from '@displace/api-client';

export type NotificationContract = components['schemas']['NotificationDto'];
export type NotificationPageContract = components['schemas']['NotificationPageDto'];

export function listNotifications(cursor?: string): Promise<NotificationPageContract> {
  return authenticatedRead(`/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
}

export function markNotificationRead(notificationId: string): Promise<NotificationContract> {
  return authenticatedMutation(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: "PATCH" });
}

export function dismissNotification(notificationId: string): Promise<void> {
  return authenticatedMutation(`/notifications/${encodeURIComponent(notificationId)}`, { method: "DELETE" });
}