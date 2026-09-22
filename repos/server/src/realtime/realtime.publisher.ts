import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

@Injectable()
export class RealtimePublisher {
  private server?: Server;

  attach(server: Server): void {
    this.server = server;
  }

  publishChannelChanged(placeId: string, channel: unknown): void {
    this.server?.to(`place:${placeId}`).emit('chat.channel.updated', channel);
  }

  publishMessageCreated(channelId: string, message: unknown): void {
    this.server?.to(`chat:${channelId}`).emit('chat.message.created', message);
  }

  publishMessageUpdated(channelId: string, message: unknown): void {
    this.server?.to(`chat:${channelId}`).emit('chat.message.updated', message);
  }

  publishNotification(userId: string, notification: unknown): void {
    this.server?.to(`user:${userId}`).emit('notification.created', notification);
  }

  publishNotificationUpdated(userId: string, notification: unknown): void {
    this.server?.to(`user:${userId}`).emit('notification.updated', notification);
  }

  publishVoiceRoomUpdated(placeId: string, roomId: string): void {
    this.server?.to(`place:${placeId}`).to(`voice:${roomId}`).emit('voice.room.updated', {
      placeId,
      roomId,
    });
  }
}