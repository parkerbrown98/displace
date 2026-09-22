import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, isNull, lt, or } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { notifications } from '../database/schema/index.js';

export interface NotificationCursor {
  createdAt: Date;
  id: string;
}

@Injectable()
export class NotificationsRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  list(userId: string, cursor: NotificationCursor | undefined, limit: number) {
    const before = cursor
      ? or(
          lt(notifications.createdAt, cursor.createdAt),
          and(eq(notifications.createdAt, cursor.createdAt), lt(notifications.id, cursor.id)),
        )
      : undefined;
    return this.database
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.dismissedAt), before))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit + 1);
  }

  async unreadCount(userId: string): Promise<number> {
    const [result] = await this.database
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), isNull(notifications.dismissedAt)));
    return Number(result?.value ?? 0);
  }

  async markRead(userId: string, notificationId: string, now: Date) {
    const [notification] = await this.database
      .update(notifications)
      .set({ readAt: now })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId), isNull(notifications.dismissedAt)))
      .returning();
    return notification;
  }

  async dismiss(userId: string, notificationId: string, now: Date) {
    const [notification] = await this.database
      .update(notifications)
      .set({ dismissedAt: now })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId), isNull(notifications.dismissedAt)))
      .returning();
    return notification;
  }
}