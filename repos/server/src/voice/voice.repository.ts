import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { voiceRooms } from '../database/schema/index.js';
import type { CreateVoiceRoomDto, UpdateVoiceRoomDto } from './voice.dto.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class VoiceRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  listRooms(placeId: string) {
    return this.database
      .select()
      .from(voiceRooms)
      .where(and(eq(voiceRooms.placeId, placeId), isNull(voiceRooms.archivedAt)))
      .orderBy(asc(voiceRooms.position), asc(voiceRooms.id));
  }

  async findRoom(placeId: string, identifier: string) {
    const identifierFilter = UUID_PATTERN.test(identifier)
      ? eq(voiceRooms.id, identifier)
      : eq(voiceRooms.slug, identifier);
    const [room] = await this.database
      .select()
      .from(voiceRooms)
      .where(
        and(
          eq(voiceRooms.placeId, placeId),
          isNull(voiceRooms.archivedAt),
          identifierFilter,
        ),
      )
      .limit(1);
    return room;
  }

  async createRoom(placeId: string, input: CreateVoiceRoomDto) {
    const [room] = await this.database
      .insert(voiceRooms)
      .values({
        capacity: input.capacity,
        listenPermission: input.listenPermission,
        name: input.name.trim(),
        placeId,
        position: input.position,
        slug: input.slug.toLowerCase(),
        speakPermission: input.speakPermission,
      })
      .returning();
    if (!room) throw new Error('Voice room creation returned no record.');
    return room;
  }

  async updateRoom(
    placeId: string,
    roomId: string,
    input: UpdateVoiceRoomDto,
    now: Date,
  ) {
    const [room] = await this.database
      .update(voiceRooms)
      .set({ ...input, name: input.name?.trim(), updatedAt: now })
      .where(
        and(
          eq(voiceRooms.placeId, placeId),
          eq(voiceRooms.id, roomId),
          isNull(voiceRooms.archivedAt),
        ),
      )
      .returning();
    return room;
  }

  async archiveRoom(placeId: string, roomId: string, now: Date) {
    const [room] = await this.database
      .update(voiceRooms)
      .set({ archivedAt: now, updatedAt: now })
      .where(
        and(
          eq(voiceRooms.placeId, placeId),
          eq(voiceRooms.id, roomId),
          isNull(voiceRooms.archivedAt),
        ),
      )
      .returning();
    return room;
  }
}