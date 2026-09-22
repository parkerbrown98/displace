import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CLOCK, type Clock } from '../platform/clock/clock.js';
import { CursorCodecService } from '../platform/pagination/cursor-codec.service.js';
import { RealtimePublisher } from '../realtime/realtime.publisher.js';
import { NotificationsRepository, type NotificationCursor } from './notifications.repository.js';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly cursors: CursorCodecService,
    private readonly notifications: NotificationsRepository,
    private readonly realtime: RealtimePublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(userId: string, cursor: string | undefined, limit: number) {
    const records = await this.notifications.list(userId, cursor ? this.decodeCursor(cursor) : undefined, limit);
    const delivered = records.slice(0, limit);
    const items = delivered.map((notification) => this.response(notification));
    const last = delivered.at(-1);
    return {
      items,
      nextCursor: records.length > limit && last ? this.cursors.encode({ createdAt: last.createdAt.toISOString(), id: last.id }) : undefined,
      unreadCount: await this.notifications.unreadCount(userId),
    };
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.notifications.markRead(userId, notificationId, this.clock.now());
    if (!notification) throw new NotFoundException('Notification was not found.');
    const response = this.response(notification);
    this.realtime.publishNotificationUpdated(userId, response);
    return response;
  }

  async dismiss(userId: string, notificationId: string) {
    const notification = await this.notifications.dismiss(userId, notificationId, this.clock.now());
    if (!notification) throw new NotFoundException('Notification was not found.');
    const response = this.response(notification);
    this.realtime.publishNotificationUpdated(userId, { ...response, dismissed: true });
  }

  private decodeCursor(cursor: string): NotificationCursor {
    const value = this.cursors.decode<{ createdAt?: string; id?: string }>(cursor);
    if (!value.createdAt || !value.id) throw new BadRequestException('Notification cursor is invalid.');
    const createdAt = new Date(value.createdAt);
    if (Number.isNaN(createdAt.getTime())) throw new BadRequestException('Notification cursor is invalid.');
    return { createdAt, id: value.id };
  }

  private response(notification: { createdAt: Date; id: string; payload: Record<string, unknown>; placeId: string | null; readAt: Date | null; type: string }) {
    return { createdAt: notification.createdAt, id: notification.id, payload: notification.payload, placeId: notification.placeId, readAt: notification.readAt, type: notification.type };
  }
}