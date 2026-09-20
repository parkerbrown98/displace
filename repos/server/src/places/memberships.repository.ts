import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  and,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import {
  auditLog,
  bans,
  invites,
  memberRoles,
  placeMembers,
  places,
  rolePermissions,
  roles,
  userEmails,
} from '../database/schema/index.js';
import {
  canManageRole,
  loadPlaceMutationPolicy,
} from './place-mutation-policy.js';

export type JoinResult =
  | { kind: 'banned' }
  | { kind: 'invite-required' }
  | { kind: 'joined'; memberId: string; status: 'active' | 'pending' }
  | { kind: 'invalid-invite' };

interface InviteInput {
  email?: string;
  expiresAt: Date;
  maxUses: number;
  roleId?: string;
  tokenHash: string;
}

export interface MembershipResourceCursor {
  createdAt: Date;
  id: string;
}

@Injectable()
export class MembershipsRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async join(
    placeId: string,
    userId: string,
    inviteTokenHash: string | undefined,
    now: Date,
  ): Promise<JoinResult> {
    return this.database.transaction(async (transaction) => {
      const [place] = await transaction
        .select({ joinPolicy: places.joinPolicy })
        .from(places)
        .where(and(eq(places.id, placeId), isNull(places.archivedAt)))
        .for('update')
        .limit(1);
      if (!place) {
        return { kind: 'invite-required' };
      }
      const [activeBan] = await transaction
        .select({ id: bans.id })
        .from(bans)
        .where(
          and(
            eq(bans.placeId, placeId),
            eq(bans.userId, userId),
            isNull(bans.revokedAt),
            or(isNull(bans.expiresAt), gt(bans.expiresAt, now)),
          ),
        )
        .limit(1);
      if (activeBan) {
        return { kind: 'banned' };
      }
      const [existingMembership] = await transaction
        .select({ id: placeMembers.id, status: placeMembers.status })
        .from(placeMembers)
        .where(
          and(
            eq(placeMembers.placeId, placeId),
            eq(placeMembers.userId, userId),
          ),
        )
        .for('update')
        .limit(1);
      if (existingMembership?.status === 'active') {
        return {
          kind: 'joined',
          memberId: existingMembership.id,
          status: 'active',
        };
      }

      let invite:
        | {
            email: string | null;
            id: string;
            roleId: string | null;
            useCount: number;
          }
        | undefined;
      if (inviteTokenHash) {
        const verifiedEmails = await transaction
          .select({ email: userEmails.email })
          .from(userEmails)
          .where(
            and(
              eq(userEmails.userId, userId),
              isNotNull(userEmails.verifiedAt),
            ),
          );
        [invite] = await transaction
          .select({
            email: invites.email,
            id: invites.id,
            roleId: invites.roleId,
            useCount: invites.useCount,
          })
          .from(invites)
          .where(
            and(
              eq(invites.placeId, placeId),
              eq(invites.tokenHash, inviteTokenHash),
              isNull(invites.revokedAt),
              gt(invites.expiresAt, now),
              sql`${invites.useCount} < ${invites.maxUses}`,
            ),
          )
          .for('update')
          .limit(1);
        const invitedEmail = invite?.email;
        if (
          !invite ||
          (invitedEmail &&
            !verifiedEmails.some((record) => record.email === invitedEmail))
        ) {
          return { kind: 'invalid-invite' };
        }
      }
      if (place.joinPolicy === 'invite_only' && !invite) {
        return { kind: 'invite-required' };
      }

      const status =
        invite || place.joinPolicy === 'open' ? ('active' as const) : ('pending' as const);
      const [member] = await transaction
        .insert(placeMembers)
        .values({
          joinedAt: status === 'active' ? now : null,
          placeId,
          status,
          userId,
        })
        .onConflictDoUpdate({
          set: {
            joinedAt: status === 'active' ? now : null,
            status,
            updatedAt: now,
          },
          target: [placeMembers.placeId, placeMembers.userId],
        })
        .returning({ id: placeMembers.id, status: placeMembers.status });
      if (!member) {
        throw new Error('Joining did not return a membership.');
      }

      if (status === 'active') {
        const [memberRole] = await transaction
          .select({ id: roles.id })
          .from(roles)
          .where(and(eq(roles.placeId, placeId), eq(roles.name, 'Member')))
          .limit(1);
        const roleIds = [memberRole?.id, invite?.roleId].filter(
          (roleId): roleId is string => Boolean(roleId),
        );
        if (roleIds.length) {
          await transaction
            .insert(memberRoles)
            .values(
              roleIds.map((roleId) => ({
                memberId: member.id,
                placeId,
                roleId,
              })),
            )
            .onConflictDoNothing();
        }
      }
      if (invite) {
        await transaction
          .update(invites)
          .set({
            acceptedAt: now,
            acceptedByUserId: userId,
            useCount: invite.useCount + 1,
          })
          .where(eq(invites.id, invite.id));
      }
      await transaction.insert(auditLog).values({
        action: status === 'active' ? 'member.joined' : 'member.requested',
        actorUserId: userId,
        placeId,
        targetId: member.id,
        targetType: 'place_member',
      });
      return { kind: 'joined', memberId: member.id, status };
    });
  }

  async approve(
    placeId: string,
    memberId: string,
    actorUserId: string,
    now: Date,
  ): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const actor = await loadPlaceMutationPolicy(
        transaction,
        placeId,
        actorUserId,
      );
      if (!actor?.permissions.has('member.manage')) {
        throw new ForbiddenException('Member management is required.');
      }
      const [pendingMember] = await transaction
        .select({ userId: placeMembers.userId })
        .from(placeMembers)
        .where(
          and(
            eq(placeMembers.placeId, placeId),
            eq(placeMembers.id, memberId),
            eq(placeMembers.status, 'pending'),
          ),
        )
        .for('update')
        .limit(1);
      if (!pendingMember) {
        return false;
      }
      const [activeBan] = await transaction
        .select({ id: bans.id })
        .from(bans)
        .where(
          and(
            eq(bans.placeId, placeId),
            eq(bans.userId, pendingMember.userId),
            isNull(bans.revokedAt),
            or(isNull(bans.expiresAt), gt(bans.expiresAt, now)),
          ),
        )
        .limit(1);
      if (activeBan) {
        return false;
      }
      const [member] = await transaction
        .update(placeMembers)
        .set({ joinedAt: now, status: 'active', updatedAt: now })
        .where(
          and(
            eq(placeMembers.placeId, placeId),
            eq(placeMembers.id, memberId),
            eq(placeMembers.status, 'pending'),
          ),
        )
        .returning({ id: placeMembers.id });
      if (!member) {
        return false;
      }
      const [role] = await transaction
        .select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.placeId, placeId), eq(roles.name, 'Member')))
        .limit(1);
      if (role) {
        await transaction
          .insert(memberRoles)
          .values({ memberId, placeId, roleId: role.id })
          .onConflictDoNothing();
      }
      await transaction.insert(auditLog).values({
        action: 'member.approved',
        actorUserId,
        placeId,
        targetId: memberId,
        targetType: 'place_member',
      });
      return true;
    });
  }

  async leave(placeId: string, userId: string, now: Date): Promise<'left' | 'owner' | 'missing'> {
    return this.database.transaction(async (transaction) => {
      const [place] = await transaction
        .select({
          archivedAt: places.archivedAt,
          ownerUserId: places.ownerUserId,
        })
        .from(places)
        .where(eq(places.id, placeId))
        .for('update')
        .limit(1);
      if (!place || place.archivedAt) {
        return 'missing';
      }
      if (place.ownerUserId === userId) {
        return 'owner';
      }
      const [member] = await transaction
        .update(placeMembers)
        .set({ status: 'left', updatedAt: now })
        .where(
          and(
            eq(placeMembers.placeId, placeId),
            eq(placeMembers.userId, userId),
            eq(placeMembers.status, 'active'),
          ),
        )
        .returning({ id: placeMembers.id });
      if (!member) {
        return 'missing';
      }
      await transaction
        .delete(memberRoles)
        .where(
          and(
            eq(memberRoles.placeId, placeId),
            eq(memberRoles.memberId, member.id),
          ),
        );
      await transaction.insert(auditLog).values({
        action: 'member.left',
        actorUserId: userId,
        placeId,
        targetId: member.id,
        targetType: 'place_member',
      });
      return 'left';
    });
  }

  async remove(
    placeId: string,
    memberId: string,
    actorUserId: string,
    now: Date,
  ): Promise<'removed' | 'owner' | 'missing'> {
    return this.database.transaction(async (transaction) => {
      const actor = await loadPlaceMutationPolicy(
        transaction,
        placeId,
        actorUserId,
      );
      if (!actor?.permissions.has('member.manage')) {
        throw new ForbiddenException('Member management is required.');
      }
      const [member] = await transaction
        .select({ userId: placeMembers.userId })
        .from(placeMembers)
        .where(and(eq(placeMembers.placeId, placeId), eq(placeMembers.id, memberId)))
        .for('update')
        .limit(1);
      if (!member) {
        return 'missing';
      }
      if (actor.ownerUserId === member.userId) {
        return 'owner';
      }
      const targetPositions = await transaction
        .select({ position: roles.position })
        .from(memberRoles)
        .innerJoin(roles, eq(roles.id, memberRoles.roleId))
        .where(
          and(
            eq(memberRoles.placeId, placeId),
            eq(memberRoles.memberId, memberId),
          ),
        );
      if (
        Math.max(0, ...targetPositions.map((item) => item.position)) >=
        actor.position
      ) {
        throw new ForbiddenException('A higher role position is required.');
      }
      await transaction
        .update(placeMembers)
        .set({ status: 'left', updatedAt: now })
        .where(eq(placeMembers.id, memberId));
      await transaction
        .delete(memberRoles)
        .where(
          and(
            eq(memberRoles.placeId, placeId),
            eq(memberRoles.memberId, memberId),
          ),
        );
      await transaction.insert(auditLog).values({
        action: 'member.removed',
        actorUserId,
        placeId,
        targetId: memberId,
        targetType: 'place_member',
      });
      return 'removed';
    });
  }

  async transferOwnership(
    placeId: string,
    currentOwnerUserId: string,
    newOwnerUserId: string,
    now: Date,
  ): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const [place] = await transaction
        .select({
          archivedAt: places.archivedAt,
          ownerUserId: places.ownerUserId,
        })
        .from(places)
        .where(eq(places.id, placeId))
        .for('update')
        .limit(1);
      if (
        !place ||
        place.archivedAt ||
        place.ownerUserId !== currentOwnerUserId
      ) {
        return false;
      }
      const members = await transaction
        .select({ id: placeMembers.id, userId: placeMembers.userId })
        .from(placeMembers)
        .where(
          and(
            eq(placeMembers.placeId, placeId),
            eq(placeMembers.status, 'active'),
            or(
              eq(placeMembers.userId, currentOwnerUserId),
              eq(placeMembers.userId, newOwnerUserId),
            ),
          ),
        )
        .for('update');
      const oldOwner = members.find((member) => member.userId === currentOwnerUserId);
      const newOwner = members.find((member) => member.userId === newOwnerUserId);
      if (!oldOwner || !newOwner) {
        return false;
      }
      const systemRoles = await transaction
        .select({ id: roles.id, name: roles.name })
        .from(roles)
        .where(and(eq(roles.placeId, placeId), eq(roles.isSystem, true)));
      const ownerRoleId = systemRoles.find((role) => role.name === 'Owner')?.id;
      const memberRoleId = systemRoles.find((role) => role.name === 'Member')?.id;
      if (!ownerRoleId || !memberRoleId) {
        throw new Error('Required system roles are missing.');
      }
      await transaction
        .update(places)
        .set({ ownerUserId: newOwnerUserId, updatedAt: now })
        .where(eq(places.id, placeId));
      await transaction
        .delete(memberRoles)
        .where(
          and(
            eq(memberRoles.placeId, placeId),
            eq(memberRoles.memberId, oldOwner.id),
            eq(memberRoles.roleId, ownerRoleId),
          ),
        );
      await transaction
        .insert(memberRoles)
        .values([
          { memberId: oldOwner.id, placeId, roleId: memberRoleId },
          { memberId: newOwner.id, placeId, roleId: ownerRoleId },
        ])
        .onConflictDoNothing();
      await transaction.insert(auditLog).values({
        action: 'place.ownership.transferred',
        actorUserId: currentOwnerUserId,
        metadata: { newOwnerUserId },
        placeId,
        targetId: placeId,
        targetType: 'place',
      });
      return true;
    });
  }

  async createInvite(
    placeId: string,
    actorUserId: string,
    input: InviteInput,
  ) {
    return this.database.transaction(async (transaction) => {
      const actor = await loadPlaceMutationPolicy(
        transaction,
        placeId,
        actorUserId,
      );
      if (!actor?.permissions.has('member.manage')) {
        throw new ForbiddenException('Member management is required.');
      }
      if (input.roleId) {
        const [role] = await transaction
          .select({ position: roles.position })
          .from(roles)
          .where(and(eq(roles.placeId, placeId), eq(roles.id, input.roleId)))
          .for('update')
          .limit(1);
        if (!role) {
          throw new ForbiddenException('The invite role is unavailable.');
        }
        const permissions = (
          await transaction
            .select({ permission: rolePermissions.permission })
            .from(rolePermissions)
            .where(eq(rolePermissions.roleId, input.roleId))
        ).map((grant) => grant.permission);
        if (!canManageRole(actor, role.position, permissions)) {
          throw new ForbiddenException(
            'Role management is required for the invite role.',
          );
        }
      }
      const [invite] = await transaction
        .insert(invites)
        .values({
          ...input,
          email: input.email?.toLowerCase(),
          invitedByUserId: actorUserId,
          placeId,
        })
        .returning({ expiresAt: invites.expiresAt, id: invites.id });
      if (invite) {
        await transaction.insert(auditLog).values({
          action: 'invite.created',
          actorUserId,
          metadata: {
            email: input.email?.toLowerCase(),
            maxUses: input.maxUses,
            roleId: input.roleId,
          },
          placeId,
          targetId: invite.id,
          targetType: 'invite',
        });
      }
      return invite;
    });
  }

  async listInvites(
    placeId: string,
    actorUserId: string,
    now: Date,
    options: { cursor?: MembershipResourceCursor; limit: number },
  ) {
    const cursor = options.cursor
      ? or(
          lt(invites.createdAt, options.cursor.createdAt),
          and(
            eq(invites.createdAt, options.cursor.createdAt),
            lt(invites.id, options.cursor.id),
          ),
        )
      : undefined;
    return this.database.transaction(async (transaction) => {
      const actor = await loadPlaceMutationPolicy(
        transaction,
        placeId,
        actorUserId,
      );
      if (!actor?.permissions.has('member.manage')) {
        throw new ForbiddenException('Member management is required.');
      }
      return transaction
        .select({
          acceptedAt: invites.acceptedAt,
          createdAt: invites.createdAt,
          email: invites.email,
          expiresAt: invites.expiresAt,
          id: invites.id,
          maxUses: invites.maxUses,
          roleId: invites.roleId,
          useCount: invites.useCount,
        })
        .from(invites)
        .where(
          and(
            eq(invites.placeId, placeId),
            isNull(invites.revokedAt),
            gt(invites.expiresAt, now),
            cursor,
          ),
        )
        .orderBy(desc(invites.createdAt), desc(invites.id))
        .limit(Math.min(Math.max(options.limit, 1), 100) + 1);
    });
  }

  async revokeInvite(
    placeId: string,
    inviteId: string,
    actorUserId: string,
    now: Date,
  ): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const actor = await loadPlaceMutationPolicy(
        transaction,
        placeId,
        actorUserId,
      );
      if (!actor?.permissions.has('member.manage')) {
        throw new ForbiddenException('Member management is required.');
      }
      const [invite] = await transaction
        .update(invites)
        .set({ revokedAt: now })
        .where(
          and(
            eq(invites.placeId, placeId),
            eq(invites.id, inviteId),
            isNull(invites.revokedAt),
          ),
        )
        .returning({ id: invites.id });
      if (!invite) {
        return false;
      }
      await transaction.insert(auditLog).values({
        action: 'invite.revoked',
        actorUserId,
        placeId,
        targetId: inviteId,
        targetType: 'invite',
      });
      return true;
    });
  }

  async ban(
    placeId: string,
    userId: string,
    actorUserId: string,
    reason: string,
    expiresAt: Date | undefined,
    now: Date,
  ): Promise<
    | {
        kind: 'banned';
        record: {
          createdAt: Date;
          expiresAt: Date | null;
          id: string;
          reason: string;
          userId: string;
        };
      }
    | { kind: 'duplicate' }
    | { kind: 'owner' }
  > {
    return this.database.transaction(async (transaction) => {
      const actor = await loadPlaceMutationPolicy(
        transaction,
        placeId,
        actorUserId,
      );
      if (!actor?.permissions.has('moderation.manage')) {
        throw new ForbiddenException('Moderation management is required.');
      }
      if (actor.ownerUserId === userId) {
        return { kind: 'owner' };
      }
      const [targetMember] = await transaction
        .select({ id: placeMembers.id })
        .from(placeMembers)
        .where(
          and(
            eq(placeMembers.placeId, placeId),
            eq(placeMembers.userId, userId),
          ),
        )
        .for('update')
        .limit(1);
      if (targetMember) {
        const targetPositions = await transaction
          .select({ position: roles.position })
          .from(memberRoles)
          .innerJoin(roles, eq(roles.id, memberRoles.roleId))
          .where(
            and(
              eq(memberRoles.placeId, placeId),
              eq(memberRoles.memberId, targetMember.id),
            ),
          );
        if (
          Math.max(0, ...targetPositions.map((item) => item.position)) >=
          actor.position
        ) {
          throw new ForbiddenException('A higher role position is required.');
        }
      }
      const [existing] = await transaction
        .select({ id: bans.id })
        .from(bans)
        .where(
          and(
            eq(bans.placeId, placeId),
            eq(bans.userId, userId),
            isNull(bans.revokedAt),
            or(isNull(bans.expiresAt), gt(bans.expiresAt, now)),
          ),
        )
        .limit(1);
      if (existing) {
        return { kind: 'duplicate' };
      }
      const [ban] = await transaction
        .insert(bans)
        .values({
          createdByUserId: actorUserId,
          expiresAt,
          placeId,
          reason: reason.trim(),
          userId,
        })
        .returning({
          createdAt: bans.createdAt,
          expiresAt: bans.expiresAt,
          id: bans.id,
          reason: bans.reason,
          userId: bans.userId,
        });
      if (!ban) {
        throw new Error('Ban creation did not return a ban.');
      }
      const [member] = await transaction
        .update(placeMembers)
        .set({ status: 'left', updatedAt: now })
        .where(
          and(
            eq(placeMembers.placeId, placeId),
            eq(placeMembers.userId, userId),
          ),
        )
        .returning({ id: placeMembers.id });
      if (member) {
        await transaction
          .delete(memberRoles)
          .where(
            and(
              eq(memberRoles.placeId, placeId),
              eq(memberRoles.memberId, member.id),
            ),
          );
      }
      await transaction.insert(auditLog).values({
        action: 'member.banned',
        actorUserId,
        metadata: { expiresAt, reason: reason.trim(), userId },
        placeId,
        targetId: ban.id,
        targetType: 'ban',
      });
      return { kind: 'banned', record: ban };
    });
  }

  async listBans(
    placeId: string,
    actorUserId: string,
    now: Date,
    options: { cursor?: MembershipResourceCursor; limit: number },
  ) {
    const cursor = options.cursor
      ? or(
          lt(bans.createdAt, options.cursor.createdAt),
          and(
            eq(bans.createdAt, options.cursor.createdAt),
            lt(bans.id, options.cursor.id),
          ),
        )
      : undefined;
    return this.database.transaction(async (transaction) => {
      const actor = await loadPlaceMutationPolicy(
        transaction,
        placeId,
        actorUserId,
      );
      if (!actor?.permissions.has('moderation.manage')) {
        throw new ForbiddenException('Moderation management is required.');
      }
      return transaction
        .select({
          createdAt: bans.createdAt,
          expiresAt: bans.expiresAt,
          id: bans.id,
          reason: bans.reason,
          userId: bans.userId,
        })
        .from(bans)
        .where(
          and(
            eq(bans.placeId, placeId),
            isNull(bans.revokedAt),
            or(isNull(bans.expiresAt), gt(bans.expiresAt, now)),
            cursor,
          ),
        )
        .orderBy(desc(bans.createdAt), desc(bans.id))
        .limit(Math.min(Math.max(options.limit, 1), 100) + 1);
    });
  }

  async revokeBan(
    placeId: string,
    banId: string,
    actorUserId: string,
    now: Date,
  ): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const actor = await loadPlaceMutationPolicy(
        transaction,
        placeId,
        actorUserId,
      );
      if (!actor?.permissions.has('moderation.manage')) {
        throw new ForbiddenException('Moderation management is required.');
      }
      const [ban] = await transaction
        .update(bans)
        .set({ revokedAt: now, revokedByUserId: actorUserId })
        .where(
          and(
            eq(bans.placeId, placeId),
            eq(bans.id, banId),
            isNull(bans.revokedAt),
          ),
        )
        .returning({ id: bans.id });
      if (!ban) {
        return false;
      }
      await transaction.insert(auditLog).values({
        action: 'member.ban.revoked',
        actorUserId,
        placeId,
        targetId: banId,
        targetType: 'ban',
      });
      return true;
    });
  }
}