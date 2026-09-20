import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gt, inArray, or } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import {
  auditLog,
  invites,
  memberRoles,
  placeMembers,
  rolePermissions,
  roles,
} from '../database/schema/index.js';
import type { PlacePermission } from './place-permissions.js';
import {
  canManageRole,
  loadPlaceMutationPolicy,
} from './place-mutation-policy.js';

export interface RoleRecord {
  id: string;
  isSystem: boolean;
  name: string;
  permissions: string[];
  position: number;
}

export interface RoleCursor {
  id: string;
  position: number;
}

@Injectable()
export class RolesRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async list(
    placeId: string,
    options: { cursor?: RoleCursor; limit: number },
  ): Promise<RoleRecord[]> {
    const cursor = options.cursor
      ? or(
          gt(roles.position, options.cursor.position),
          and(
            eq(roles.position, options.cursor.position),
            gt(roles.id, options.cursor.id),
          ),
        )
      : undefined;
    const placeRoles = await this.database
      .select({
        id: roles.id,
        isSystem: roles.isSystem,
        name: roles.name,
        position: roles.position,
      })
      .from(roles)
      .where(and(eq(roles.placeId, placeId), cursor))
      .orderBy(asc(roles.position), asc(roles.id))
      .limit(Math.min(Math.max(options.limit, 1), 100) + 1);
    return this.attachPermissions(placeRoles);
  }

  async find(placeId: string, roleId: string): Promise<RoleRecord | undefined> {
    const [role] = await this.database
      .select({
        id: roles.id,
        isSystem: roles.isSystem,
        name: roles.name,
        position: roles.position,
      })
      .from(roles)
      .where(and(eq(roles.placeId, placeId), eq(roles.id, roleId)))
      .limit(1);
    return role ? (await this.attachPermissions([role]))[0] : undefined;
  }

  async create(
    placeId: string,
    actorUserId: string,
    input: { name: string; permissions: PlacePermission[]; position: number },
  ): Promise<RoleRecord> {
    return this.database.transaction(async (transaction) => {
      const actor = await loadPlaceMutationPolicy(
        transaction,
        placeId,
        actorUserId,
      );
      if (!canManageRole(actor, input.position, input.permissions)) {
        throw new ForbiddenException(
          'A role cannot exceed your position or permissions.',
        );
      }
      const [role] = await transaction
        .insert(roles)
        .values({ name: input.name.trim(), placeId, position: input.position })
        .returning({
          id: roles.id,
          isSystem: roles.isSystem,
          name: roles.name,
          position: roles.position,
        });
      if (!role) {
        throw new Error('Role creation did not return a role.');
      }
      if (input.permissions.length) {
        await transaction.insert(rolePermissions).values(
          input.permissions.map((permission) => ({
            permission,
            roleId: role.id,
          })),
        );
      }
      await transaction.insert(auditLog).values({
        action: 'role.created',
        actorUserId,
        metadata: { name: role.name, position: role.position },
        placeId,
        targetId: role.id,
        targetType: 'role',
      });
      return { ...role, permissions: input.permissions };
    });
  }

  async update(
    placeId: string,
    roleId: string,
    actorUserId: string,
    input: {
      name?: string;
      permissions?: PlacePermission[];
      position?: number;
    },
    now: Date,
  ): Promise<RoleRecord | undefined> {
    return this.database.transaction(async (transaction) => {
      const actor = await loadPlaceMutationPolicy(
        transaction,
        placeId,
        actorUserId,
      );
      const [current] = await transaction
        .select({
          id: roles.id,
          isSystem: roles.isSystem,
          position: roles.position,
        })
        .from(roles)
        .where(and(eq(roles.placeId, placeId), eq(roles.id, roleId)))
        .for('update')
        .limit(1);
      if (!current || current.isSystem) {
        return undefined;
      }
      const currentPermissions = (
        await transaction
          .select({ permission: rolePermissions.permission })
          .from(rolePermissions)
          .where(eq(rolePermissions.roleId, roleId))
      ).map((grant) => grant.permission);
      const desiredPermissions = input.permissions ?? currentPermissions;
      if (
        !canManageRole(actor, current.position, currentPermissions) ||
        !canManageRole(
          actor,
          input.position ?? current.position,
          desiredPermissions,
        )
      ) {
        throw new ForbiddenException(
          'A role cannot exceed your position or permissions.',
        );
      }
      const [role] = await transaction
        .update(roles)
        .set({
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.position === undefined ? {} : { position: input.position }),
          updatedAt: now,
        })
        .where(
          and(
            eq(roles.placeId, placeId),
            eq(roles.id, roleId),
            eq(roles.isSystem, false),
          ),
        )
        .returning({
          id: roles.id,
          isSystem: roles.isSystem,
          name: roles.name,
          position: roles.position,
        });
      if (!role) {
        return undefined;
      }
      if (input.permissions) {
        await transaction
          .delete(rolePermissions)
          .where(eq(rolePermissions.roleId, roleId));
        if (input.permissions.length) {
          await transaction.insert(rolePermissions).values(
            input.permissions.map((permission) => ({ permission, roleId })),
          );
        }
      }
      await transaction.insert(auditLog).values({
        action: 'role.updated',
        actorUserId,
        metadata: input,
        placeId,
        targetId: roleId,
        targetType: 'role',
      });
      const permissions = input.permissions ?? currentPermissions;
      return { ...role, permissions };
    });
  }

  async delete(
    placeId: string,
    roleId: string,
    actorUserId: string,
  ): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const actor = await loadPlaceMutationPolicy(
        transaction,
        placeId,
        actorUserId,
      );
      const [current] = await transaction
        .select({
          id: roles.id,
          isSystem: roles.isSystem,
          position: roles.position,
        })
        .from(roles)
        .where(and(eq(roles.placeId, placeId), eq(roles.id, roleId)))
        .for('update')
        .limit(1);
      if (!current || current.isSystem) {
        return false;
      }
      const permissions = (
        await transaction
          .select({ permission: rolePermissions.permission })
          .from(rolePermissions)
          .where(eq(rolePermissions.roleId, roleId))
      ).map((grant) => grant.permission);
      if (!canManageRole(actor, current.position, permissions)) {
        throw new ForbiddenException(
          'A role cannot exceed your position or permissions.',
        );
      }
      await transaction
        .update(invites)
        .set({ roleId: null })
        .where(and(eq(invites.placeId, placeId), eq(invites.roleId, roleId)));
      const [role] = await transaction
        .delete(roles)
        .where(
          and(
            eq(roles.placeId, placeId),
            eq(roles.id, roleId),
            eq(roles.isSystem, false),
          ),
        )
        .returning({ id: roles.id });
      if (!role) {
        return false;
      }
      await transaction.insert(auditLog).values({
        action: 'role.deleted',
        actorUserId,
        placeId,
        targetId: roleId,
        targetType: 'role',
      });
      return true;
    });
  }

  async assign(
    placeId: string,
    memberId: string,
    roleId: string,
    actorUserId: string,
  ): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const actor = await loadPlaceMutationPolicy(
        transaction,
        placeId,
        actorUserId,
      );
      const [target] = await transaction
        .select({
          memberId: placeMembers.id,
          roleId: roles.id,
          rolePosition: roles.position,
        })
        .from(placeMembers)
        .innerJoin(
          roles,
          and(eq(roles.placeId, placeMembers.placeId), eq(roles.id, roleId)),
        )
        .where(
          and(
            eq(placeMembers.placeId, placeId),
            eq(placeMembers.id, memberId),
            eq(placeMembers.status, 'active'),
          ),
        )
        .for('update')
        .limit(1);
      if (!target) {
        return false;
      }
      const roleGrants = (
        await transaction
          .select({ permission: rolePermissions.permission })
          .from(rolePermissions)
          .where(eq(rolePermissions.roleId, roleId))
      ).map((grant) => grant.permission);
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
        !canManageRole(actor, target.rolePosition, roleGrants) ||
        Math.max(0, ...targetPositions.map((item) => item.position)) >=
          (actor?.position ?? 0)
      ) {
        throw new ForbiddenException('A higher role position is required.');
      }
      await transaction
        .insert(memberRoles)
        .values({ memberId, placeId, roleId })
        .onConflictDoNothing();
      await transaction.insert(auditLog).values({
        action: 'member.role.assigned',
        actorUserId,
        metadata: { roleId },
        placeId,
        targetId: memberId,
        targetType: 'place_member',
      });
      return true;
    });
  }

  async remove(
    placeId: string,
    memberId: string,
    roleId: string,
    actorUserId: string,
  ): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const actor = await loadPlaceMutationPolicy(
        transaction,
        placeId,
        actorUserId,
      );
      const [role] = await transaction
        .select({ name: roles.name, position: roles.position })
        .from(roles)
        .where(and(eq(roles.placeId, placeId), eq(roles.id, roleId)))
        .for('update')
        .limit(1);
      if (!role || role.name === 'Owner') {
        return false;
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
        !actor?.permissions.has('role.manage') ||
        role.position >= actor.position ||
        Math.max(0, ...targetPositions.map((item) => item.position)) >=
          actor.position
      ) {
        throw new ForbiddenException('A higher role position is required.');
      }
      const [assignment] = await transaction
        .delete(memberRoles)
        .where(
          and(
            eq(memberRoles.placeId, placeId),
            eq(memberRoles.memberId, memberId),
            eq(memberRoles.roleId, roleId),
          ),
        )
        .returning({ memberId: memberRoles.memberId });
      if (!assignment) {
        return false;
      }
      await transaction.insert(auditLog).values({
        action: 'member.role.removed',
        actorUserId,
        metadata: { roleId },
        placeId,
        targetId: memberId,
        targetType: 'place_member',
      });
      return true;
    });
  }

  private async attachPermissions(
    placeRoles: Array<Omit<RoleRecord, 'permissions'>>,
  ): Promise<RoleRecord[]> {
    if (!placeRoles.length) {
      return [];
    }
    const grants = await this.database
      .select()
      .from(rolePermissions)
      .where(
        inArray(
          rolePermissions.roleId,
          placeRoles.map((role) => role.id),
        ),
      );
    return placeRoles.map((role) => ({
      ...role,
      permissions: grants
        .filter((grant) => grant.roleId === role.id)
        .map((grant) => grant.permission),
    }));
  }
}