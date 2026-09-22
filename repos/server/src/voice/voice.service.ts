import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CLOCK, type Clock } from '../platform/clock/clock.js';
import type { PlacePermission } from '../places/place-permissions.js';
import { PlacesRepository } from '../places/places.repository.js';
import { RealtimePublisher } from '../realtime/realtime.publisher.js';
import type { CreateVoiceRoomDto, UpdateVoiceRoomDto } from './voice.dto.js';
import { VoiceLiveKitService } from './voice-livekit.service.js';
import { VoiceRepository } from './voice.repository.js';

type VoiceRoomRecord = NonNullable<Awaited<ReturnType<VoiceRepository['findRoom']>>>;

@Injectable()
export class VoiceService {
  constructor(
    private readonly voice: VoiceRepository,
    private readonly livekit: VoiceLiveKitService,
    private readonly places: PlacesRepository,
    private readonly realtime: RealtimePublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async listRooms(placeId: string, userId: string) {
    const permissions = await this.requireMembership(placeId, userId);
    const rooms = await this.voice.listRooms(placeId);
    return Promise.all(
      rooms
        .filter((room) => permissions.has(room.listenPermission))
        .map(async (room) => this.roomResponse(
          room,
          permissions,
          await this.livekit.listParticipants(placeId, room.id),
        )),
    );
  }

  async getRoom(placeId: string, roomIdentifier: string, userId: string) {
    const permissions = await this.requireMembership(placeId, userId);
    const room = await this.requireRoom(placeId, roomIdentifier);
    if (!permissions.has(room.listenPermission)) {
      throw new NotFoundException('Voice room was not found.');
    }
    return this.roomResponse(
      room,
      permissions,
      await this.livekit.listParticipants(placeId, room.id),
    );
  }

  async createRoom(placeId: string, userId: string, input: CreateVoiceRoomDto) {
    await this.requirePermission(placeId, userId, 'voice.manage');
    try {
      const room = await this.voice.createRoom(placeId, input);
      const response = await this.roomForManager(room);
      this.realtime.publishVoiceRoomUpdated(placeId, room.id);
      return response;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Voice room slug is already in use.');
      }
      throw error;
    }
  }

  async updateRoom(
    placeId: string,
    roomId: string,
    userId: string,
    input: UpdateVoiceRoomDto,
  ) {
    await this.requirePermission(placeId, userId, 'voice.manage');
    const room = await this.voice.updateRoom(placeId, roomId, input, this.clock.now());
    if (!room) throw new NotFoundException('Voice room was not found.');
    await this.reconcileParticipantPermissions(room);
    const response = await this.roomForManager(room);
    this.realtime.publishVoiceRoomUpdated(placeId, room.id);
    return response;
  }

  async archiveRoom(placeId: string, roomId: string, userId: string) {
    await this.requirePermission(placeId, userId, 'voice.manage');
    const room = await this.voice.archiveRoom(placeId, roomId, this.clock.now());
    if (!room) throw new NotFoundException('Voice room was not found.');
    this.realtime.publishVoiceRoomUpdated(placeId, room.id);
  }

  async createJoinToken(placeId: string, roomIdentifier: string, userId: string) {
    const permissions = await this.requireMembership(placeId, userId);
    const room = await this.requireRoom(placeId, roomIdentifier);
    if (!permissions.has(room.listenPermission)) {
      throw new ForbiddenException('Voice room listening is not permitted.');
    }
    const member = await this.places.findMemberByUserId(placeId, userId);
    if (!member || member.status !== 'active') {
      throw new ForbiddenException('Active place membership is required.');
    }
    const participants = await this.livekit.listParticipants(placeId, room.id);
    if (
      participants.length >= room.capacity &&
      !participants.some((participant) => participant.identity === userId)
    ) {
      throw new ConflictException('Voice room is full.');
    }
    const roomName = await this.livekit.ensureRoom(placeId, room.id);
    const canPublish = permissions.has(room.speakPermission);
    const token = await this.livekit.createJoinToken({
      canPublish,
      displayName: member.displayName,
      identity: userId,
      placeId,
      roomId: room.id,
    });
    return {
      canPublish,
      expiresAt: new Date(this.clock.now().getTime() + 600_000),
      roomName,
      serverUrl: this.livekit.serverUrl,
      token,
    };
  }

  async reconcileWebhook(rawBody: string, authorization: string | undefined) {
    const event = await this.livekit.receiveWebhook(rawBody, authorization);
    const name = event.room?.name;
    const identifiers = name ? this.livekit.parseRoomName(name) : undefined;
    if (!identifiers) return;
    const room = await this.voice.findRoom(identifiers.placeId, identifiers.roomId);
    if (!room) return;
    this.realtime.publishVoiceRoomUpdated(room.placeId, room.id);
  }

  private async roomForManager(room: VoiceRoomRecord) {
    return this.roomResponse(
      room,
      new Set<string>([
        room.listenPermission,
        room.speakPermission,
        'voice.manage',
      ]),
      await this.livekit.listParticipants(room.placeId, room.id),
    );
  }

  private async reconcileParticipantPermissions(room: VoiceRoomRecord) {
    const participants = await this.livekit.listParticipants(room.placeId, room.id);
    await Promise.all(participants.map(async (participant) => {
      const authorization = await this.places.getAuthorization(
        room.placeId,
        participant.identity,
      );
      if (!authorization?.permissions.has(room.listenPermission)) {
        await this.livekit.removeParticipant(room.placeId, room.id, participant.identity);
        return;
      }
      await this.livekit.updateParticipantPermissions(
        room.placeId,
        room.id,
        participant.identity,
        authorization.permissions.has(room.speakPermission),
      );
    }));
  }

  private roomResponse(
    room: VoiceRoomRecord,
    permissions: ReadonlySet<string>,
    participants: Awaited<ReturnType<VoiceLiveKitService['listParticipants']>>,
  ) {
    return {
      archived: Boolean(room.archivedAt),
      canJoin: permissions.has(room.listenPermission),
      canManage: permissions.has('voice.manage'),
      canSpeak: permissions.has(room.speakPermission),
      capacity: room.capacity,
      id: room.id,
      listenPermission: room.listenPermission,
      name: room.name,
      participants,
      placeId: room.placeId,
      position: room.position,
      slug: room.slug,
      speakPermission: room.speakPermission,
    };
  }

  private async requireRoom(placeId: string, identifier: string) {
    const room = await this.voice.findRoom(placeId, identifier);
    if (!room) throw new NotFoundException('Voice room was not found.');
    return room;
  }

  private async requireMembership(placeId: string, userId: string) {
    const authorization = await this.places.getAuthorization(placeId, userId);
    if (!authorization) throw new ForbiddenException('Place membership is required.');
    return authorization.permissions;
  }

  private async requirePermission(
    placeId: string,
    userId: string,
    permission: PlacePermission,
  ) {
    const permissions = await this.requireMembership(placeId, userId);
    if (!permissions.has(permission)) {
      throw new ForbiddenException('The required place permission is missing.');
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error &&
      (error as { code?: string }).code === '23505';
  }
}