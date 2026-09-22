import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  RoomServiceClient,
  WebhookReceiver,
  type WebhookEvent,
} from 'livekit-server-sdk';
import type { AppEnvironment } from '../config/environment.js';

export interface VoiceParticipant {
  canPublish: boolean;
  displayName: string;
  identity: string;
  joinedAt: string;
  microphoneMuted: boolean;
}

@Injectable()
export class VoiceLiveKitService {
  readonly serverUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly rooms: RoomServiceClient;
  private readonly webhooks: WebhookReceiver;

  constructor(config: ConfigService<AppEnvironment, true>) {
    const configuredUrl = config.get('LIVEKIT_URL', { infer: true });
    this.serverUrl = config.get('LIVEKIT_PUBLIC_URL', { infer: true });
    this.apiKey = config.get('LIVEKIT_API_KEY', { infer: true });
    this.apiSecret = config.get('LIVEKIT_API_SECRET', { infer: true });
    this.rooms = new RoomServiceClient(
      configuredUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:'),
      this.apiKey,
      this.apiSecret,
    );
    this.webhooks = new WebhookReceiver(this.apiKey, this.apiSecret);
  }

  roomName(placeId: string, roomId: string): string {
    return `voice:${placeId}:${roomId}`;
  }

  parseRoomName(name: string): { placeId: string; roomId: string } | undefined {
    const match = /^voice:([0-9a-f-]{36}):([0-9a-f-]{36})$/i.exec(name);
    return match ? { placeId: match[1]!, roomId: match[2]! } : undefined;
  }

  async ensureRoom(
    placeId: string,
    roomId: string,
  ): Promise<string> {
    const name = this.roomName(placeId, roomId);
    const [existing] = await this.rooms.listRooms([name]);
    if (!existing) {
      await this.rooms.createRoom({
        departureTimeout: 20,
        emptyTimeout: 300,
        metadata: JSON.stringify({ placeId, roomId }),
        name,
      });
    }
    return name;
  }

  async createJoinToken(input: {
    canPublish: boolean;
    displayName: string;
    identity: string;
    placeId: string;
    roomId: string;
  }): Promise<string> {
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: input.identity,
      metadata: JSON.stringify({ placeId: input.placeId, roomId: input.roomId }),
      name: input.displayName,
      ttl: 600,
    });
    token.addGrant({
      canPublish: input.canPublish,
      canPublishData: false,
      canSubscribe: true,
      room: this.roomName(input.placeId, input.roomId),
      roomJoin: true,
    });
    return token.toJwt();
  }

  async listParticipants(placeId: string, roomId: string): Promise<VoiceParticipant[]> {
    const name = this.roomName(placeId, roomId);
    const [activeRoom] = await this.rooms.listRooms([name]);
    if (!activeRoom) return [];
    const participants = await this.rooms.listParticipants(name);
    return participants.map((participant) => ({
      canPublish: participant.permission?.canPublish ?? false,
      displayName: participant.name || participant.identity,
      identity: participant.identity,
      joinedAt: new Date(Number(participant.joinedAt) * 1000).toISOString(),
      microphoneMuted:
        participant.tracks.length === 0 ||
        participant.tracks
          .filter((track) => track.source === 2)
          .every((track) => track.muted),
    }));
  }

  async updateParticipantPermissions(
    placeId: string,
    roomId: string,
    identity: string,
    canPublish: boolean,
  ): Promise<void> {
    await this.rooms.updateParticipant(this.roomName(placeId, roomId), identity, {
      permission: {
        canPublish,
        canPublishData: false,
        canSubscribe: true,
      },
    });
  }

  async removeParticipant(placeId: string, roomId: string, identity: string): Promise<void> {
    await this.rooms.removeParticipant(this.roomName(placeId, roomId), identity);
  }

  receiveWebhook(body: string, authorization: string | undefined): Promise<WebhookEvent> {
    return this.webhooks.receive(body, authorization);
  }
}