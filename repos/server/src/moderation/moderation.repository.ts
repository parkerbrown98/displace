import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  desc,
  eq,
  gt,
  isNull,
  lt,
  max,
  or,
} from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type {
  Database,
  DatabaseTransaction,
} from '../database/database.types.js';
import {
  auditLog,
  bans,
  chatMessages,
  forums,
  memberRoles,
  memberSanctions,
  moderationActions,
  moderationReports,
  moderationSignals,
  moderatorNotes,
  notifications,
  outboxEvents,
  placeMembers,
  places,
  posts,
  roles,
  topics,
  users,
} from '../database/schema/index.js';
import { loadPlaceMutationPolicy } from '../places/place-mutation-policy.js';
import {
  ModerationActionDto,
  ReportTargetTypeDto,
  type CreateModerationActionDto,
  type CreateReportDto,
  type ReportStatusDto,
} from './moderation.dto.js';
import { ModerationPolicy } from './moderation.policy.js';

export interface ModerationCursor {
  createdAt: Date;
  id: string;
}

export interface ActionResult {
  actionId: string;
  targetUserId?: string;
}

@Injectable()
export class ModerationRepository {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly policy: ModerationPolicy,
  ) {}

  async createReport(
    placeId: string,
    reporterUserId: string,
    input: CreateReportDto,
    signalHash: string,
    now: Date,
  ) {
    return this.database.transaction(async (transaction) => {
      const reporter = await loadPlaceMutationPolicy(
        transaction,
        placeId,
        reporterUserId,
      );
      if (!reporter) {
        throw new ForbiddenException('Active place membership is required.');
      }
      const evidence = await this.snapshot(
        transaction,
        placeId,
        input.targetType,
        input.targetId,
      );
      if (!evidence) {
        throw new NotFoundException('The reported resource was not found.');
      }
      const [report] = await transaction
        .insert(moderationReports)
        .values({
          details: input.details.trim(),
          evidence,
          placeId,
          reasonCode: input.reasonCode,
          reporterUserId,
          targetId: input.targetId,
          targetType: input.targetType,
        })
        .returning();
      if (!report) throw new Error('Report creation returned no report.');

      await transaction.insert(moderationSignals).values({
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1_000),
        reportId: report.id,
        type: 'network',
        valueHash: signalHash,
      });
      await transaction.insert(auditLog).values({
        action: 'report.created',
        actorUserId: reporterUserId,
        metadata: { reasonCode: input.reasonCode, targetType: input.targetType },
        placeId,
        targetId: report.id,
        targetType: 'report',
      });
      await this.emit(transaction, 'report.created', report.id, {
        placeId,
        reportId: report.id,
        targetType: input.targetType,
      });
      return report;
    });
  }

  async listReports(
    placeId: string,
    actorUserId: string,
    options: {
      assigneeUserId?: string;
      cursor?: ModerationCursor;
      limit: number;
      status?: ReportStatusDto;
    },
  ) {
    return this.database.transaction(async (transaction) => {
      this.policy.requireModerator(
        await loadPlaceMutationPolicy(transaction, placeId, actorUserId),
      );
      const cursor = options.cursor
        ? or(
            lt(moderationReports.createdAt, options.cursor.createdAt),
            and(
              eq(moderationReports.createdAt, options.cursor.createdAt),
              lt(moderationReports.id, options.cursor.id),
            ),
          )
        : undefined;
      return transaction
        .select()
        .from(moderationReports)
        .where(
          and(
            eq(moderationReports.placeId, placeId),
            options.status
              ? eq(moderationReports.status, options.status)
              : undefined,
            options.assigneeUserId
              ? eq(
                  moderationReports.assignedToUserId,
                  options.assigneeUserId,
                )
              : undefined,
            cursor,
          ),
        )
        .orderBy(desc(moderationReports.createdAt), desc(moderationReports.id))
        .limit(Math.min(Math.max(options.limit, 1), 100) + 1);
    });
  }

  async getReport(placeId: string, reportId: string, actorUserId: string) {
    return this.database.transaction(async (transaction) => {
      this.policy.requireModerator(
        await loadPlaceMutationPolicy(transaction, placeId, actorUserId),
      );
      const [report] = await transaction
        .select()
        .from(moderationReports)
        .where(
          and(
            eq(moderationReports.placeId, placeId),
            eq(moderationReports.id, reportId),
          ),
        )
        .limit(1);
      if (!report) return undefined;
      const notes = await transaction
        .select()
        .from(moderatorNotes)
        .where(
          and(
            eq(moderatorNotes.placeId, placeId),
            eq(moderatorNotes.reportId, reportId),
          ),
        )
        .orderBy(moderatorNotes.createdAt, moderatorNotes.id);
      const actions = await transaction
        .select()
        .from(moderationActions)
        .where(
          and(
            eq(moderationActions.placeId, placeId),
            eq(moderationActions.reportId, reportId),
          ),
        )
        .orderBy(moderationActions.createdAt, moderationActions.id);
      return { ...report, actions, notes };
    });
  }

  async assignReport(
    placeId: string,
    reportId: string,
    actorUserId: string,
    assigneeUserId: string,
    now: Date,
  ) {
    return this.database.transaction(async (transaction) => {
      this.policy.requireModerator(
        await loadPlaceMutationPolicy(transaction, placeId, actorUserId),
      );
      this.policy.requireModerator(
        await loadPlaceMutationPolicy(transaction, placeId, assigneeUserId),
      );
      const [report] = await transaction
        .update(moderationReports)
        .set({
          assignedToUserId: assigneeUserId,
          status: 'in_review',
          updatedAt: now,
        })
        .where(
          and(
            eq(moderationReports.placeId, placeId),
            eq(moderationReports.id, reportId),
            or(
              eq(moderationReports.status, 'open'),
              eq(moderationReports.status, 'in_review'),
            ),
          ),
        )
        .returning();
      if (!report) return undefined;
      await this.audit(transaction, placeId, actorUserId, 'report.assigned', reportId, {
        assigneeUserId,
      });
      await this.emit(transaction, 'report.updated', reportId, {
        assigneeUserId,
        placeId,
        reportId,
        status: report.status,
      });
      return report;
    });
  }

  async resolveReport(
    placeId: string,
    reportId: string,
    actorUserId: string,
    status: 'resolved' | 'dismissed',
    resolution: string,
    now: Date,
  ) {
    return this.database.transaction(async (transaction) => {
      this.policy.requireModerator(
        await loadPlaceMutationPolicy(transaction, placeId, actorUserId),
      );
      const [report] = await transaction
        .update(moderationReports)
        .set({
          resolution: resolution.trim(),
          resolvedAt: now,
          resolvedByUserId: actorUserId,
          status,
          updatedAt: now,
        })
        .where(
          and(
            eq(moderationReports.placeId, placeId),
            eq(moderationReports.id, reportId),
            or(
              eq(moderationReports.status, 'open'),
              eq(moderationReports.status, 'in_review'),
            ),
          ),
        )
        .returning();
      if (!report) return undefined;
      await this.audit(transaction, placeId, actorUserId, `report.${status}`, reportId, {
        resolution: resolution.trim(),
      });
      await transaction.insert(notifications).values({
        placeId,
        type: 'report.resolved',
        userId: report.reporterUserId,
        payload: { reportId, status },
      });
      await this.emit(transaction, 'report.updated', reportId, {
        placeId,
        reportId,
        status,
      });
      return report;
    });
  }

  async addNote(
    placeId: string,
    reportId: string,
    actorUserId: string,
    body: string,
  ) {
    return this.database.transaction(async (transaction) => {
      this.policy.requireModerator(
        await loadPlaceMutationPolicy(transaction, placeId, actorUserId),
      );
      const [report] = await transaction
        .select({ id: moderationReports.id })
        .from(moderationReports)
        .where(
          and(
            eq(moderationReports.placeId, placeId),
            eq(moderationReports.id, reportId),
          ),
        )
        .limit(1);
      if (!report) return undefined;
      const [note] = await transaction
        .insert(moderatorNotes)
        .values({
          authorUserId: actorUserId,
          body: body.trim(),
          placeId,
          reportId,
        })
        .returning();
      if (!note) throw new Error('Moderator note creation returned no note.');
      await this.audit(transaction, placeId, actorUserId, 'report.note.created', note.id, {
        reportId,
      });
      return note;
    });
  }

  async executeAction(
    placeId: string,
    actorUserId: string,
    input: CreateModerationActionDto,
    now: Date,
  ): Promise<ActionResult> {
    return this.database.transaction(async (transaction) => {
      const actor = this.policy.requireModerator(
        await loadPlaceMutationPolicy(transaction, placeId, actorUserId),
      );
      this.policy.validateAction(input);
      if (input.reportId) {
        const [report] = await transaction
          .select({ id: moderationReports.id })
          .from(moderationReports)
          .where(
            and(
              eq(moderationReports.placeId, placeId),
              eq(moderationReports.id, input.reportId),
            ),
          )
          .limit(1);
        if (!report) throw new NotFoundException('Report was not found.');
      }

      let result: { after: Record<string, unknown>; before: Record<string, unknown>; targetUserId?: string };
      if (input.targetType === ReportTargetTypeDto.Member) {
        result = await this.applyMemberAction(transaction, placeId, actorUserId, actor, input, now);
      } else if (input.targetType === ReportTargetTypeDto.Topic) {
        result = await this.applyTopicAction(transaction, placeId, actorUserId, input, now);
      } else if (input.targetType === ReportTargetTypeDto.Post) {
        result = await this.applyPostAction(transaction, placeId, actorUserId, input, now);
      } else if (input.targetType === ReportTargetTypeDto.ChatMessage) {
        result = await this.applyChatAction(transaction, placeId, actorUserId, input, now);
      } else {
        throw new ConflictException('This resource does not support moderation actions.');
      }

      const [action] = await transaction
        .insert(moderationActions)
        .values({
          action: input.action,
          actorUserId,
          after: result.after,
          before: result.before,
          placeId,
          reason: input.reason.trim(),
          reasonCode: input.reasonCode,
          reportId: input.reportId,
          targetId: input.targetId,
          targetType: input.targetType,
        })
        .returning({ id: moderationActions.id });
      if (!action) throw new Error('Moderation action returned no record.');
      await this.audit(transaction, placeId, actorUserId, input.action, input.targetId, {
        actionId: action.id,
        after: result.after,
        before: result.before,
        reason: input.reason.trim(),
        reasonCode: input.reasonCode,
        reportId: input.reportId,
      });
      if (result.targetUserId) {
        await transaction.insert(notifications).values({
          placeId,
          type: 'moderation.action',
          userId: result.targetUserId,
          payload: {
            action: input.action,
            actionId: action.id,
            reasonCode: input.reasonCode,
          },
        });
      }
      await this.emit(transaction, 'moderation.action.created', action.id, {
        action: input.action,
        actionId: action.id,
        placeId,
        reportId: input.reportId,
        targetId: input.targetId,
        targetType: input.targetType,
      });
      return { actionId: action.id, targetUserId: result.targetUserId };
    });
  }

  async revokeSanction(
    placeId: string,
    sanctionId: string,
    actorUserId: string,
    now: Date,
  ): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      this.policy.requireModerator(
        await loadPlaceMutationPolicy(transaction, placeId, actorUserId),
      );
      const [sanction] = await transaction
        .update(memberSanctions)
        .set({ revokedAt: now, revokedByUserId: actorUserId })
        .where(
          and(
            eq(memberSanctions.placeId, placeId),
            eq(memberSanctions.id, sanctionId),
            isNull(memberSanctions.revokedAt),
          ),
        )
        .returning({ id: memberSanctions.id });
      if (!sanction) return false;
      await this.audit(transaction, placeId, actorUserId, 'member.sanction.revoked', sanctionId);
      return true;
    });
  }

  async deleteExpiredSignals(now: Date): Promise<number> {
    const deleted = await this.database
      .delete(moderationSignals)
      .where(lt(moderationSignals.expiresAt, now))
      .returning({ reportId: moderationSignals.reportId });
    return deleted.length;
  }

  private async applyMemberAction(
    transaction: DatabaseTransaction,
    placeId: string,
    actorUserId: string,
    actor: ReturnType<ModerationPolicy['requireModerator']>,
    input: CreateModerationActionDto,
    now: Date,
  ) {
    const [member] = await transaction
      .select({
        isOwner: places.ownerUserId,
        position: max(roles.position),
        status: placeMembers.status,
        userId: placeMembers.userId,
      })
      .from(placeMembers)
      .innerJoin(places, eq(places.id, placeMembers.placeId))
      .leftJoin(
        memberRoles,
        and(
          eq(memberRoles.placeId, placeMembers.placeId),
          eq(memberRoles.memberId, placeMembers.id),
        ),
      )
      .leftJoin(roles, eq(roles.id, memberRoles.roleId))
      .where(
        and(
          eq(placeMembers.placeId, placeId),
          eq(placeMembers.id, input.targetId),
        ),
      )
      .groupBy(places.ownerUserId, placeMembers.status, placeMembers.userId)
      .limit(1);
    if (!member) throw new NotFoundException('Member was not found.');
    this.policy.requireTargetBelowActor(actor, {
      isOwner: member.isOwner === member.userId,
      position: Number(member.position ?? 0),
    });
    const before = { status: member.status };

    if (input.action === ModerationActionDto.Ban) {
      const [activeBan] = await transaction
        .select({ id: bans.id })
        .from(bans)
        .where(
          and(
            eq(bans.placeId, placeId),
            eq(bans.userId, member.userId),
            isNull(bans.revokedAt),
            or(isNull(bans.expiresAt), gt(bans.expiresAt, now)),
          ),
        )
        .limit(1);
      if (activeBan) throw new ConflictException('The member already has an active ban.');
      const expiresAt = input.durationHours
        ? new Date(now.getTime() + input.durationHours * 60 * 60 * 1_000)
        : undefined;
      const [ban] = await transaction
        .insert(bans)
        .values({
          createdByUserId: actorUserId,
          expiresAt,
          placeId,
          reason: input.reason.trim(),
          userId: member.userId,
        })
        .returning({ id: bans.id });
      await transaction
        .update(placeMembers)
        .set({ status: 'left', updatedAt: now })
        .where(
          and(
            eq(placeMembers.placeId, placeId),
            eq(placeMembers.id, input.targetId),
          ),
        );
      await transaction
        .delete(memberRoles)
        .where(
          and(
            eq(memberRoles.placeId, placeId),
            eq(memberRoles.memberId, input.targetId),
          ),
        );
      return {
        after: { banId: ban?.id, expiresAt, status: 'left' },
        before,
        targetUserId: member.userId,
      };
    }

    const type = input.action === ModerationActionDto.Timeout ? 'timeout' : 'warning';
    const expiresAt = input.action === ModerationActionDto.Timeout
      ? new Date(now.getTime() + input.durationHours! * 60 * 60 * 1_000)
      : undefined;
    const [sanction] = await transaction
      .insert(memberSanctions)
      .values({
        createdByUserId: actorUserId,
        expiresAt,
        placeId,
        reason: input.reason.trim(),
        reasonCode: input.reasonCode,
        type,
        userId: member.userId,
      })
      .returning({ id: memberSanctions.id });
    return {
      after: { expiresAt, sanctionId: sanction?.id, type },
      before,
      targetUserId: member.userId,
    };
  }

  private async applyTopicAction(
    transaction: DatabaseTransaction,
    placeId: string,
    actorUserId: string,
    input: CreateModerationActionDto,
    now: Date,
  ) {
    const [topic] = await transaction
      .select({
        authorUserId: topics.authorUserId,
        deletedAt: topics.deletedAt,
        forumId: topics.forumId,
        isPinned: topics.isPinned,
        status: topics.status,
      })
      .from(topics)
      .where(and(eq(topics.placeId, placeId), eq(topics.id, input.targetId)))
      .limit(1);
    if (!topic) throw new NotFoundException('Topic was not found.');
    const before = {
      deletedAt: topic.deletedAt,
      forumId: topic.forumId,
      isPinned: topic.isPinned,
      status: topic.status,
    };
    const changes: Partial<typeof topics.$inferInsert> = { updatedAt: now };
    if (input.action === ModerationActionDto.ContentHide) changes.deletedAt = now;
    if (input.action === ModerationActionDto.ContentRestore) changes.deletedAt = null;
    if (input.action === ModerationActionDto.TopicLock) changes.status = 'locked';
    if (input.action === ModerationActionDto.TopicUnlock) changes.status = 'open';
    if (input.action === ModerationActionDto.TopicPin) changes.isPinned = true;
    if (input.action === ModerationActionDto.TopicUnpin) changes.isPinned = false;
    if (input.action === ModerationActionDto.TopicMove) {
      const [destination] = await transaction
        .select({ id: forums.id })
        .from(forums)
        .where(
          and(eq(forums.placeId, placeId), eq(forums.id, input.targetForumId!)),
        )
        .limit(1);
      if (!destination) throw new NotFoundException('Destination forum was not found.');
      changes.forumId = destination.id;
    }
    const [updated] = await transaction
      .update(topics)
      .set(changes)
      .where(and(eq(topics.placeId, placeId), eq(topics.id, input.targetId)))
      .returning({
        deletedAt: topics.deletedAt,
        forumId: topics.forumId,
        isPinned: topics.isPinned,
        status: topics.status,
      });
    return { after: updated ?? {}, before, targetUserId: topic.authorUserId };
  }

  private async applyPostAction(
    transaction: DatabaseTransaction,
    placeId: string,
    actorUserId: string,
    input: CreateModerationActionDto,
    now: Date,
  ) {
    const [post] = await transaction
      .select({ authorUserId: posts.authorUserId, deletedAt: posts.deletedAt })
      .from(posts)
      .where(and(eq(posts.placeId, placeId), eq(posts.id, input.targetId)))
      .limit(1);
    if (!post) throw new NotFoundException('Post was not found.');
    const deletedAt = input.action === ModerationActionDto.ContentHide ? now : null;
    await transaction
      .update(posts)
      .set({ deletedAt, deletedByUserId: deletedAt ? actorUserId : null, updatedAt: now })
      .where(and(eq(posts.placeId, placeId), eq(posts.id, input.targetId)));
    return {
      after: { deletedAt },
      before: { deletedAt: post.deletedAt },
      targetUserId: post.authorUserId,
    };
  }

  private async applyChatAction(
    transaction: DatabaseTransaction,
    placeId: string,
    actorUserId: string,
    input: CreateModerationActionDto,
    now: Date,
  ) {
    const [message] = await transaction
      .select({ authorUserId: chatMessages.authorUserId, deletedAt: chatMessages.deletedAt })
      .from(chatMessages)
      .where(
        and(eq(chatMessages.placeId, placeId), eq(chatMessages.id, input.targetId)),
      )
      .limit(1);
    if (!message) throw new NotFoundException('Chat message was not found.');
    await transaction
      .update(chatMessages)
      .set({ deletedAt: now, deletedByUserId: actorUserId, updatedAt: now })
      .where(
        and(eq(chatMessages.placeId, placeId), eq(chatMessages.id, input.targetId)),
      );
    return {
      after: { deletedAt: now },
      before: { deletedAt: message.deletedAt },
      targetUserId: message.authorUserId,
    };
  }

  private async snapshot(
    transaction: DatabaseTransaction,
    placeId: string,
    targetType: ReportTargetTypeDto,
    targetId: string,
  ): Promise<Record<string, unknown> | undefined> {
    if (targetType === ReportTargetTypeDto.Place) {
      const [place] = await transaction
        .select({ description: places.description, name: places.name, slug: places.slug })
        .from(places)
        .where(and(eq(places.id, placeId), eq(places.id, targetId)))
        .limit(1);
      return place;
    }
    if (targetType === ReportTargetTypeDto.Member) {
      const [member] = await transaction
        .select({ displayName: users.displayName, handle: users.handle, status: placeMembers.status })
        .from(placeMembers)
        .innerJoin(users, eq(users.id, placeMembers.userId))
        .where(and(eq(placeMembers.placeId, placeId), eq(placeMembers.id, targetId)))
        .limit(1);
      return member;
    }
    if (targetType === ReportTargetTypeDto.Topic) {
      const [topic] = await transaction
        .select({ authorUserId: topics.authorUserId, status: topics.status, title: topics.title })
        .from(topics)
        .where(and(eq(topics.placeId, placeId), eq(topics.id, targetId)))
        .limit(1);
      return topic;
    }
    if (targetType === ReportTargetTypeDto.Post) {
      const [post] = await transaction
        .select({ authorUserId: posts.authorUserId, plainText: posts.plainText, topicId: posts.topicId })
        .from(posts)
        .where(and(eq(posts.placeId, placeId), eq(posts.id, targetId)))
        .limit(1);
      return post ? { ...post, plainText: post.plainText.slice(0, 4_000) } : undefined;
    }
    const [message] = await transaction
      .select({ authorUserId: chatMessages.authorUserId, body: chatMessages.body, channelId: chatMessages.channelId })
      .from(chatMessages)
      .where(and(eq(chatMessages.placeId, placeId), eq(chatMessages.id, targetId)))
      .limit(1);
    return message;
  }

  private async audit(
    transaction: DatabaseTransaction,
    placeId: string,
    actorUserId: string,
    action: string,
    targetId: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await transaction.insert(auditLog).values({
      action,
      actorUserId,
      metadata,
      placeId,
      targetId,
      targetType: action.split('.')[0],
    });
  }

  private async emit(
    transaction: DatabaseTransaction,
    eventType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await transaction.insert(outboxEvents).values({
      aggregateId,
      aggregateType: eventType.split('.')[0]!,
      eventType,
      payload,
    });
  }
}