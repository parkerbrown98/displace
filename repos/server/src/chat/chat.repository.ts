import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import {
  chatChannels,
  chatMessageRevisions,
  chatMessages,
  chatReadState,
  notifications,
  placeMembers,
  users,
} from '../database/schema/index.js';
import type { CreateChatChannelDto, UpdateChatChannelDto } from './chat.dto.js';

export interface ChatMessageCursor {
  createdAt: Date;
  id: string;
}

@Injectable()
export class ChatRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  listChannels(placeId: string) {
    return this.database
      .select()
      .from(chatChannels)
      .where(and(eq(chatChannels.placeId, placeId), isNull(chatChannels.archivedAt)))
      .orderBy(asc(chatChannels.position), asc(chatChannels.id));
  }

  async findChannel(placeId: string, identifier: string) {
    const [channel] = await this.database
      .select()
      .from(chatChannels)
      .where(
        and(
          eq(chatChannels.placeId, placeId),
          isNull(chatChannels.archivedAt),
          or(eq(chatChannels.id, identifier), eq(chatChannels.slug, identifier)),
        ),
      )
      .limit(1);
    return channel;
  }

  async createChannel(placeId: string, input: CreateChatChannelDto) {
    const [channel] = await this.database
      .insert(chatChannels)
      .values({
        name: input.name,
        placeId,
        position: input.position,
        readPermission: input.readPermission,
        sendPermission: input.sendPermission,
        slug: input.slug.toLowerCase(),
        visibility: input.visibility,
      })
      .returning();
    if (!channel) throw new Error('Chat channel creation returned no record.');
    return channel;
  }

  async updateChannel(
    placeId: string,
    channelId: string,
    input: UpdateChatChannelDto,
    now: Date,
  ) {
    const [channel] = await this.database
      .update(chatChannels)
      .set({
        name: input.name,
        position: input.position,
        readPermission: input.readPermission,
        sendPermission: input.sendPermission,
        updatedAt: now,
        visibility: input.visibility,
      })
      .where(
        and(
          eq(chatChannels.placeId, placeId),
          eq(chatChannels.id, channelId),
          isNull(chatChannels.archivedAt),
        ),
      )
      .returning();
    return channel;
  }

  async archiveChannel(placeId: string, channelId: string, now: Date) {
    const [channel] = await this.database
      .update(chatChannels)
      .set({ archivedAt: now, updatedAt: now })
      .where(
        and(
          eq(chatChannels.placeId, placeId),
          eq(chatChannels.id, channelId),
          isNull(chatChannels.archivedAt),
        ),
      )
      .returning();
    return channel;
  }

  listMessages(placeId: string, channelId: string, cursor: ChatMessageCursor | undefined, limit: number) {
    const before = cursor
      ? or(
          lt(chatMessages.createdAt, cursor.createdAt),
          and(eq(chatMessages.createdAt, cursor.createdAt), lt(chatMessages.id, cursor.id)),
        )
      : undefined;
    return this.database
      .select({
        authorDisplayName: users.displayName,
        authorHandle: users.handle,
        authorUserId: chatMessages.authorUserId,
        body: chatMessages.body,
        channelId: chatMessages.channelId,
        createdAt: chatMessages.createdAt,
        deletedAt: chatMessages.deletedAt,
        id: chatMessages.id,
        updatedAt: chatMessages.updatedAt,
      })
      .from(chatMessages)
      .innerJoin(users, eq(users.id, chatMessages.authorUserId))
      .where(and(eq(chatMessages.placeId, placeId), eq(chatMessages.channelId, channelId), before))
      .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
      .limit(limit + 1);
  }

  async findMessage(placeId: string, messageId: string) {
    const [message] = await this.database
      .select({
        authorDisplayName: users.displayName,
        authorHandle: users.handle,
        authorUserId: chatMessages.authorUserId,
        body: chatMessages.body,
        channelId: chatMessages.channelId,
        createdAt: chatMessages.createdAt,
        deletedAt: chatMessages.deletedAt,
        id: chatMessages.id,
        updatedAt: chatMessages.updatedAt,
      })
      .from(chatMessages)
      .innerJoin(users, eq(users.id, chatMessages.authorUserId))
      .where(and(eq(chatMessages.placeId, placeId), eq(chatMessages.id, messageId)))
      .limit(1);
    return message;
  }

  async createMessage(
    placeId: string,
    channelId: string,
    authorUserId: string,
    body: string,
    clientCommandId: string,
    now: Date,
  ) {
    return this.database.transaction(async (transaction) => {
      const [existing] = await transaction
        .select()
        .from(chatMessages)
        .where(and(eq(chatMessages.authorUserId, authorUserId), eq(chatMessages.clientCommandId, clientCommandId)))
        .limit(1);
      if (existing) return { message: existing, replayed: true, notifications: [] };
      const [message] = await transaction
        .insert(chatMessages)
        .values({ authorUserId, body, channelId, clientCommandId, placeId, updatedAt: now })
        .returning();
      if (!message) throw new Error('Chat message creation returned no record.');
      const handles = [...new Set([...body.matchAll(/(?:^|\s)@([a-z0-9_]{3,32})\b/gi)].map((match) => match[1]!.toLowerCase()))];
      const recipients = handles.length === 0 ? [] : await transaction
        .select({ userId: users.id })
        .from(users)
        .innerJoin(placeMembers, and(eq(placeMembers.userId, users.id), eq(placeMembers.placeId, placeId), eq(placeMembers.status, 'active')))
        .where(and(inArray(users.handle, handles), eq(users.status, 'active')));
      const mentionedUserIds = recipients.map((recipient) => recipient.userId).filter((userId) => userId !== authorUserId);
      const createdNotifications = mentionedUserIds.length === 0 ? [] : await transaction
        .insert(notifications)
        .values(mentionedUserIds.map((userId) => ({
          placeId,
          payload: { channelId, messageId: message.id },
          type: 'chat.mention',
          userId,
        })))
        .returning();
      return { message, replayed: false, notifications: createdNotifications };
    });
  }

  async updateMessage(placeId: string, messageId: string, editorUserId: string, body: string, now: Date) {
    return this.database.transaction(async (transaction) => {
      const [message] = await transaction
        .select()
        .from(chatMessages)
        .where(and(eq(chatMessages.placeId, placeId), eq(chatMessages.id, messageId), isNull(chatMessages.deletedAt)))
        .limit(1)
        .for('update');
      if (!message) return undefined;
      const [updated] = await transaction
        .update(chatMessages)
        .set({ body, updatedAt: now })
        .where(eq(chatMessages.id, messageId))
        .returning();
      await transaction.insert(chatMessageRevisions).values({ body: message.body, editorUserId, messageId, placeId });
      return updated;
    });
  }

  async deleteMessage(placeId: string, messageId: string, deletedByUserId: string, now: Date) {
    const [message] = await this.database
      .update(chatMessages)
      .set({ deletedAt: now, deletedByUserId, updatedAt: now })
      .where(and(eq(chatMessages.placeId, placeId), eq(chatMessages.id, messageId), isNull(chatMessages.deletedAt)))
      .returning();
    return message;
  }

  async markRead(placeId: string, channelId: string, userId: string, messageId: string, now: Date) {
    const [state] = await this.database
      .insert(chatReadState)
      .values({ channelId, lastReadMessageId: messageId, placeId, updatedAt: now, userId })
      .onConflictDoUpdate({
        target: [chatReadState.placeId, chatReadState.channelId, chatReadState.userId],
        set: { lastReadMessageId: messageId, updatedAt: now },
      })
      .returning();
    return state;
  }
}