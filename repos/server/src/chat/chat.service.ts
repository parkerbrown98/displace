import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CLOCK, type Clock } from '../platform/clock/clock.js';
import { CursorCodecService } from '../platform/pagination/cursor-codec.service.js';
import { PlacesRepository } from '../places/places.repository.js';
import type { PlacePermission } from '../places/place-permissions.js';
import { RealtimePublisher } from '../realtime/realtime.publisher.js';
import type {
  CreateChatChannelDto,
  CreateChatMessageDto,
  UpdateChatChannelDto,
  UpdateChatMessageDto,
} from './chat.dto.js';
import { ChatRepository, type ChatMessageCursor } from './chat.repository.js';

@Injectable()
export class ChatService {
  constructor(
    private readonly chat: ChatRepository,
    private readonly cursors: CursorCodecService,
    private readonly places: PlacesRepository,
    private readonly realtime: RealtimePublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async listChannels(placeId: string, userId: string) {
    const permissions = await this.requireMembership(placeId, userId);
    const channels = await this.chat.listChannels(placeId);
    return channels.filter((channel) => this.canRead(channel, permissions)).map((channel) => this.channelResponse(channel));
  }

  async getChannel(placeId: string, channelIdentifier: string, userId: string) {
    const { channel } = await this.requireReadableChannel(placeId, channelIdentifier, userId);
    return this.channelResponse(channel);
  }

  async createChannel(placeId: string, userId: string, input: CreateChatChannelDto) {
    await this.requirePermission(placeId, userId, 'chat.manage');
    try {
      const channel = await this.chat.createChannel(placeId, input);
      const response = this.channelResponse(channel);
      this.realtime.publishChannelChanged(placeId, response);
      return response;
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('Chat channel slug is already in use.');
      throw error;
    }
  }

  async updateChannel(placeId: string, channelId: string, userId: string, input: UpdateChatChannelDto) {
    await this.requirePermission(placeId, userId, 'chat.manage');
    const channel = await this.chat.updateChannel(placeId, channelId, input, this.clock.now());
    if (!channel) throw new NotFoundException('Chat channel was not found.');
    const response = this.channelResponse(channel);
    this.realtime.publishChannelChanged(placeId, response);
    return response;
  }

  async archiveChannel(placeId: string, channelId: string, userId: string) {
    await this.requirePermission(placeId, userId, 'chat.manage');
    const channel = await this.chat.archiveChannel(placeId, channelId, this.clock.now());
    if (!channel) throw new NotFoundException('Chat channel was not found.');
    this.realtime.publishChannelChanged(placeId, { ...this.channelResponse(channel), archived: true });
  }

  async listMessages(placeId: string, channelIdentifier: string, userId: string, cursor: string | undefined, limit: number) {
    const { channel, permissions } = await this.requireReadableChannel(placeId, channelIdentifier, userId);
    const decoded = cursor ? this.decodeCursor(cursor) : undefined;
    const records = await this.chat.listMessages(placeId, channel.id, decoded, limit);
    const delivered = records.slice(0, limit);
    const page = delivered.reverse().map((message) => this.messageResponse(message));
    const last = delivered.at(-1);
    return {
      channel: this.channelResponse(channel),
      items: page,
      nextCursor: records.length > limit && last ? this.cursors.encode({ createdAt: last.createdAt.toISOString(), id: last.id }) : undefined,
      permissions: { canManage: permissions.has('chat.manage'), canSend: this.canSend(channel, permissions) },
    };
  }

  async sendMessage(placeId: string, channelIdentifier: string, userId: string, input: CreateChatMessageDto) {
    const { channel, permissions } = await this.requireReadableChannel(placeId, channelIdentifier, userId);
    if (!this.canSend(channel, permissions)) throw new ForbiddenException('Chat sending is not permitted.');
    const result = await this.chat.createMessage(placeId, channel.id, userId, input.body.trim(), input.clientCommandId, this.clock.now());
    const message = await this.chat.findMessage(placeId, result.message.id);
    if (!message) throw new Error('Created chat message could not be loaded.');
    const response = this.messageResponse(message);
    if (!result.replayed) {
      this.realtime.publishMessageCreated(channel.id, response);
      for (const notification of result.notifications) {
        this.realtime.publishNotification(notification.userId, this.notificationResponse(notification));
      }
    }
    return response;
  }

  async editMessage(placeId: string, messageId: string, userId: string, input: UpdateChatMessageDto) {
    const current = await this.chat.findMessage(placeId, messageId);
    if (!current) throw new NotFoundException('Chat message was not found.');
    const permissions = await this.requireMembership(placeId, userId);
    if (current.authorUserId !== userId && !permissions.has('chat.manage')) throw new ForbiddenException('Chat message editing is not permitted.');
    const updated = await this.chat.updateMessage(placeId, messageId, userId, input.body.trim(), this.clock.now());
    if (!updated) throw new NotFoundException('Chat message was not found.');
    const message = await this.chat.findMessage(placeId, messageId);
    if (!message) throw new Error('Updated chat message could not be loaded.');
    const response = this.messageResponse(message);
    this.realtime.publishMessageUpdated(message.channelId, response);
    return response;
  }

  async deleteMessage(placeId: string, messageId: string, userId: string) {
    const current = await this.chat.findMessage(placeId, messageId);
    if (!current) throw new NotFoundException('Chat message was not found.');
    const permissions = await this.requireMembership(placeId, userId);
    if (current.authorUserId !== userId && !permissions.has('chat.manage')) throw new ForbiddenException('Chat message deletion is not permitted.');
    const deleted = await this.chat.deleteMessage(placeId, messageId, userId, this.clock.now());
    if (!deleted) throw new NotFoundException('Chat message was not found.');
    const message = await this.chat.findMessage(placeId, messageId);
    if (!message) throw new Error('Deleted chat message could not be loaded.');
    this.realtime.publishMessageUpdated(message.channelId, this.messageResponse(message));
  }

  async markRead(placeId: string, channelIdentifier: string, userId: string, messageId: string) {
    const { channel } = await this.requireReadableChannel(placeId, channelIdentifier, userId);
    const message = await this.chat.findMessage(placeId, messageId);
    if (!message || message.channelId !== channel.id) throw new NotFoundException('Chat message was not found.');
    return this.chat.markRead(placeId, channel.id, userId, messageId, this.clock.now());
  }

  private async requireReadableChannel(placeId: string, identifier: string, userId: string) {
    const permissions = await this.requireMembership(placeId, userId);
    const channel = await this.chat.findChannel(placeId, identifier);
    if (!channel || !this.canRead(channel, permissions)) throw new NotFoundException('Chat channel was not found.');
    return { channel, permissions };
  }

  private async requireMembership(placeId: string, userId: string) {
    const authorization = await this.places.getAuthorization(placeId, userId);
    if (!authorization) throw new ForbiddenException('Place membership is required.');
    return authorization.permissions;
  }

  private async requirePermission(placeId: string, userId: string, permission: PlacePermission) {
    const permissions = await this.requireMembership(placeId, userId);
    if (!permissions.has(permission)) throw new ForbiddenException('The required place permission is missing.');
  }

  private canRead(channel: { readPermission: string | null }, permissions: ReadonlySet<string>) {
    return !channel.readPermission || permissions.has(channel.readPermission);
  }

  private canSend(channel: { sendPermission: string | null }, permissions: ReadonlySet<string>) {
    return permissions.has(channel.sendPermission ?? 'chat.send');
  }

  private decodeCursor(cursor: string): ChatMessageCursor {
    const value = this.cursors.decode<{ createdAt?: string; id?: string }>(cursor);
    if (!value.createdAt || !value.id) throw new BadRequestException('Chat cursor is invalid.');
    const createdAt = new Date(value.createdAt);
    if (Number.isNaN(createdAt.getTime())) throw new BadRequestException('Chat cursor is invalid.');
    return { createdAt, id: value.id };
  }

  private channelResponse(channel: { archivedAt: Date | null; id: string; name: string; position: number; readPermission: string | null; sendPermission: string | null; slug: string; visibility: string }) {
    return { archived: Boolean(channel.archivedAt), id: channel.id, name: channel.name, position: channel.position, readPermission: channel.readPermission, sendPermission: channel.sendPermission, slug: channel.slug, visibility: channel.visibility };
  }

  private messageResponse(message: { authorDisplayName: string; authorHandle: string; authorUserId: string; body: string; channelId: string; createdAt: Date; deletedAt: Date | null; id: string; updatedAt: Date }) {
    return { author: { displayName: message.authorDisplayName, handle: message.authorHandle, id: message.authorUserId }, body: message.deletedAt ? null : message.body, channelId: message.channelId, createdAt: message.createdAt, id: message.id, isDeleted: Boolean(message.deletedAt), updatedAt: message.updatedAt };
  }

  private notificationResponse(notification: { createdAt: Date; id: string; payload: Record<string, unknown>; placeId: string | null; readAt: Date | null; type: string }) {
    return { createdAt: notification.createdAt, id: notification.id, payload: notification.payload, placeId: notification.placeId, readAt: notification.readAt, type: notification.type };
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
  }
}