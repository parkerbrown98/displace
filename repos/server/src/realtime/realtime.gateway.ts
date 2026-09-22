import { Injectable } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer, WsException } from '@nestjs/websockets';
import type { Namespace, Server, Socket } from 'socket.io';
import { AccessTokenService } from '../auth/access-token.service.js';
import { AuthService } from '../auth/auth.service.js';
import { ChatService } from '../chat/chat.service.js';
import type { CreateChatMessageDto, MarkChatReadDto, UpdateChatMessageDto } from '../chat/chat.dto.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PlacesRepository } from '../places/places.repository.js';
import { PresenceService } from './presence.service.js';
import { RealtimePublisher } from './realtime.publisher.js';

type RealtimeSocket = Socket<Record<string, (...args: never[]) => void>, Record<string, (...args: unknown[]) => void>, Record<string, (...args: unknown[]) => void>, { sessionId: string; userId: string; places: Set<string> }>;

@Injectable()
@WebSocketGateway({ namespace: '/realtime', transports: ['websocket'] })
export class RealtimeGateway implements OnGatewayInit {
  @WebSocketServer()
  private server!: Server | Namespace;

  constructor(
    private readonly accessTokens: AccessTokenService,
    private readonly auth: AuthService,
    private readonly chat: ChatService,
    private readonly notifications: NotificationsService,
    private readonly places: PlacesRepository,
    private readonly presence: PresenceService,
    private readonly publisher: RealtimePublisher,
  ) {}

  afterInit(server: Server | Namespace): void {
    this.publisher.attach(server as Server);
    server.use((socket, next) => {
      void this.authenticate(socket as RealtimeSocket).then(() => next()).catch(() => next(new Error('Authentication is required.')));
    });
  }

  async handleConnection(client: RealtimeSocket): Promise<void> {
    await client.join(`user:${client.data.userId}`);
  }

  @SubscribeMessage('place.join')
  async joinPlace(@ConnectedSocket() client: RealtimeSocket, @MessageBody() body: { placeId?: string }) {
    const place = await this.requireMembership(client, body.placeId);
    await client.join(`place:${place.id}`);
    client.data.places.add(place.id);
    await this.presence.heartbeat(place.id, client.data.userId);
    client.to(`place:${place.id}`).emit('place.presence', { userId: client.data.userId, status: 'online' });
    return { placeId: place.id };
  }

  @SubscribeMessage('chat.join')
  async joinChannel(@ConnectedSocket() client: RealtimeSocket, @MessageBody() body: { channelId?: string; placeId?: string }) {
    const place = await this.requireMembership(client, body.placeId);
    if (!body.channelId) throw new WsException('Chat channel is required.');
    const channel = await this.chat.getChannel(place.id, body.channelId, client.data.userId);
    await client.join(`chat:${channel.id}`);
    return { channelId: channel.id };
  }

  @SubscribeMessage('chat.send')
  async sendMessage(@ConnectedSocket() client: RealtimeSocket, @MessageBody() body: { channelId?: string; message?: CreateChatMessageDto; placeId?: string }) {
    const place = await this.requireMembership(client, body.placeId);
    if (!body.channelId || !body.message) throw new WsException('Chat channel and message are required.');
    return this.chat.sendMessage(place.id, body.channelId, client.data.userId, body.message);
  }

  @SubscribeMessage('chat.edit')
  async editMessage(@ConnectedSocket() client: RealtimeSocket, @MessageBody() body: { message?: UpdateChatMessageDto; messageId?: string; placeId?: string }) {
    const place = await this.requireMembership(client, body.placeId);
    if (!body.messageId || !body.message) throw new WsException('Chat message is required.');
    return this.chat.editMessage(place.id, body.messageId, client.data.userId, body.message);
  }

  @SubscribeMessage('chat.delete')
  async deleteMessage(@ConnectedSocket() client: RealtimeSocket, @MessageBody() body: { messageId?: string; placeId?: string }) {
    const place = await this.requireMembership(client, body.placeId);
    if (!body.messageId) throw new WsException('Chat message is required.');
    await this.chat.deleteMessage(place.id, body.messageId, client.data.userId);
    return { messageId: body.messageId };
  }

  @SubscribeMessage('chat.read')
  async markRead(@ConnectedSocket() client: RealtimeSocket, @MessageBody() body: { channelId?: string; placeId?: string; read?: MarkChatReadDto }) {
    const place = await this.requireMembership(client, body.placeId);
    if (!body.channelId || !body.read) throw new WsException('Chat channel and read state are required.');
    return this.chat.markRead(place.id, body.channelId, client.data.userId, body.read.messageId);
  }

  @SubscribeMessage('presence.heartbeat')
  async heartbeat(@ConnectedSocket() client: RealtimeSocket, @MessageBody() body: { placeId?: string }) {
    const place = await this.requireMembership(client, body.placeId);
    await this.presence.heartbeat(place.id, client.data.userId);
    return { placeId: place.id };
  }

  @SubscribeMessage('chat.typing')
  async typing(@ConnectedSocket() client: RealtimeSocket, @MessageBody() body: { active?: boolean; channelId?: string; placeId?: string }) {
    const place = await this.requireMembership(client, body.placeId);
    if (!body.channelId) throw new WsException('Chat channel is required.');
    const channel = await this.chat.getChannel(place.id, body.channelId, client.data.userId);
    await this.presence.setTyping(channel.id, client.data.userId, Boolean(body.active));
    client.to(`chat:${channel.id}`).emit('chat.typing', { active: Boolean(body.active), channelId: channel.id, userId: client.data.userId });
    return { active: Boolean(body.active), channelId: channel.id };
  }

  @SubscribeMessage('notifications.sync')
  syncNotifications(@ConnectedSocket() client: RealtimeSocket) {
    return this.notifications.list(client.data.userId, undefined, 25);
  }

  private async authenticate(client: RealtimeSocket): Promise<void> {
    const token = client.handshake.auth.token;
    if (typeof token !== 'string') throw new Error('Missing access token.');
    const claims = await this.accessTokens.verify(token);
    if (!(await this.auth.isSessionActive(claims.sessionId, claims.userId))) throw new Error('Inactive session.');
    client.data = { places: new Set(), sessionId: claims.sessionId, userId: claims.userId };
  }

  private async requireMembership(client: RealtimeSocket, identifier: string | undefined) {
    if (!identifier) throw new WsException('Place is required.');
    const place = await this.places.findByIdentifier(identifier);
    if (!place || place.archivedAt) throw new WsException('Place was not found.');
    const authorization = await this.places.getAuthorization(place.id, client.data.userId);
    if (!authorization) throw new WsException('Place membership is required.');
    return place;
  }
}