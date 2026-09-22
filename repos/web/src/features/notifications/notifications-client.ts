import { authenticatedMutation, authenticatedRead } from "@/features/auth/auth-client";

export interface NotificationContract {
  createdAt: string;
  id: string;
  payload: Record<string, unknown>;
  placeId: string | null;
  readAt: string | null;
  type: string;
}

export interface NotificationPageContract {
  items: NotificationContract[];
  nextCursor?: string;
  unreadCount: number;
}

export function listNotifications(cursor?: string): Promise<NotificationPageContract> {
  return authenticatedRead(`/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
}

export function markNotificationRead(notificationId: string): Promise<NotificationContract> {
  return authenticatedMutation(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: "PATCH" });
}

export function dismissNotification(notificationId: string): Promise<void> {
  return authenticatedMutation(`/notifications/${encodeURIComponent(notificationId)}`, { method: "DELETE" });
}