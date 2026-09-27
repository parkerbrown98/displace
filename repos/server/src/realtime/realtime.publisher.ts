import { Injectable } from '@nestjs/common';
import type {
  ClientToServerEvents,
  NotificationUpdatedEvent,
  RealtimeChatChannel,
  RealtimeChatMessage,
  RealtimeInterServerEvents,
  RealtimeNotification,
  RealtimeSocketData,
  ServerToClientEvents,
} from '@displace/api-client';
import type { Namespace, Server } from 'socket.io';

type RealtimeServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  RealtimeInterServerEvents,
  RealtimeSocketData
> | Namespace<
  ClientToServerEvents,
  ServerToClientEvents,
  RealtimeInterServerEvents,
  RealtimeSocketData
>;

type RealtimeChatMessageInput = Omit<
  RealtimeChatMessage,
  'createdAt' | 'updatedAt'
> & {
  createdAt: Date | string;
  updatedAt: Date | string;
};

type RealtimeNotificationInput = Omit<
  RealtimeNotification,
  'createdAt' | 'readAt'
> & {
  createdAt: Date | string;
  readAt: Date | string | null;
};

type NotificationUpdatedInput = RealtimeNotificationInput & {
  dismissed?: boolean;
};

@Injectable()
export class RealtimePublisher {
  private server?: RealtimeServer;

  attach(server: RealtimeServer): void {
    this.server = server;
  }

  publishChannelChanged(placeId: string, channel: RealtimeChatChannel): void {
    this.server?.to(`place:${placeId}`).emit('chat.channel.updated', channel);
  }

  publishMessageCreated(channelId: string, message: RealtimeChatMessageInput): void {
    this.server?.to(`chat:${channelId}`).emit('chat.message.created', this.toWire<RealtimeChatMessage>(message));
  }

  publishMessageUpdated(channelId: string, message: RealtimeChatMessageInput): void {
    this.server?.to(`chat:${channelId}`).emit('chat.message.updated', this.toWire<RealtimeChatMessage>(message));
  }

  publishNotification(userId: string, notification: RealtimeNotificationInput): void {
    this.server?.to(`user:${userId}`).emit('notification.created', this.toWire<RealtimeNotification>(notification));
  }

  publishNotificationUpdated(userId: string, notification: NotificationUpdatedInput): void {
    this.server?.to(`user:${userId}`).emit('notification.updated', this.toWire<NotificationUpdatedEvent>(notification));
  }

  publishVoiceRoomUpdated(placeId: string, roomId: string): void {
    this.server?.to(`place:${placeId}`).to(`voice:${roomId}`).emit('voice.room.updated', {
      placeId,
      roomId,
    });
  }

  private toWire<Payload>(value: unknown): Payload {
    return JSON.parse(JSON.stringify(value)) as Payload;
  }
}