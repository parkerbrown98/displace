import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  or,
} from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import {
  auditLog,
  memberRoles,
  placeMembers,
  places,
  rolePermissions,
  roles,
  users,
} from '../database/schema/index.js';
import { DEFAULT_PLACE_ROLES } from './place-permissions.js';
import { loadPlaceMutationPolicy } from './place-mutation-policy.js';

export interface PlaceCursor {
  createdAt: Date;
  id: string;
}

export interface PlaceWriteInput {
  description: string;
  joinPolicy: 'open' | 'approval' | 'invite_only';
  name: string;
  slug: string;
  visibility: 'public' | 'unlisted' | 'private';
}

export interface PlaceAuthorizationRecord {
  isOwner: boolean;
  memberId: string;
  permissions: Set<string>;
  position: number;
}

export interface MemberRecord {
  createdAt: Date;
  displayName: string;
  handle: string;
  id: string;
  joinedAt: Date | null;
  roles: Array<{
    id: string;
    isSystem: boolean;
    name: string;
    permissions: string[];
    position: number;
  }>;
  status: 'pending' | 'active' | 'left';
  userId: string;
}

@Injectable()
export class PlacesRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async create(
    ownerUserId: string,
    input: PlaceWriteInput,
    now: Date,
  ) {
    return this.database.transaction(async (transaction) => {
      const [place] = await transaction
        .insert(places)
        .values({ ...input, ownerUserId })
        .returning();
      if (!place) {
        throw new Error('Place creation did not return a place.');
      }
      const [member] = await transaction
        .insert(placeMembers)
        .values({
          joinedAt: now,
          placeId: place.id,
          status: 'active',
          userId: ownerUserId,
        })
        .returning({ id: placeMembers.id });
      if (!member) {
        throw new Error('Owner membership creation did not return a member.');
      }
      const createdRoles = await transaction
        .insert(roles)
        .values(
          DEFAULT_PLACE_ROLES.map((role) => ({
            isSystem: role.isSystem,
            name: role.name,
            placeId: place.id,
            position: role.position,
          })),
        )
        .returning({ id: roles.id, name: roles.name });
      const roleIds = new Map(createdRoles.map((role) => [role.name, role.id]));
      await transaction.insert(rolePermissions).values(
        DEFAULT_PLACE_ROLES.flatMap((role) =>
          role.permissions.map((permission) => ({
            permission,
            roleId: roleIds.get(role.name)!,
          })),
        ),
      );
      await transaction.insert(memberRoles).values({
        memberId: member.id,
        placeId: place.id,
        roleId: roleIds.get('Owner')!,
      });
      await transaction.insert(auditLog).values({
        action: 'place.created',
        actorUserId: ownerUserId,
        placeId: place.id,
        targetId: place.id,
        targetType: 'place',
      });
      return place;
    });
  }

  async findByIdentifier(identifier: string) {
    const isId =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        identifier,
      );
    if (isId) {
      const [place] = await this.database
        .select()
        .from(places)
        .where(eq(places.id, identifier))
        .limit(1);
      if (place) {
        return place;
      }
    }
    const [place] = await this.database
      .select()
      .from(places)
      .where(eq(places.slug, identifier))
      .limit(1);
    return place;
  }

  async listPublic(options: {
    cursor?: PlaceCursor;
    limit: number;
    singlePlaceSlug?: string;
  }) {
    const cursor = options.cursor
      ? or(
          lt(places.createdAt, options.cursor.createdAt),
          and(
            eq(places.createdAt, options.cursor.createdAt),
            lt(places.id, options.cursor.id),
          ),
        )
      : undefined;
    return this.database
      .select()
      .from(places)
      .where(
        and(
          eq(places.visibility, 'public'),
          isNull(places.archivedAt),
          options.singlePlaceSlug
            ? eq(places.slug, options.singlePlaceSlug)
            : undefined,
          cursor,
        ),
      )
      .orderBy(desc(places.createdAt), desc(places.id))
      .limit(Math.min(Math.max(options.limit, 1), 100) + 1);
  }

  async update(
    placeId: string,
    values: Partial<
      Pick<
        PlaceWriteInput,
        'description' | 'joinPolicy' | 'name' | 'visibility'
      >
    >,
    actorUserId: string,
    now: Date,
  ) {
    return this.database.transaction(async (transaction) => {
      const actor = await loadPlaceMutationPolicy(
        transaction,
        placeId,
        actorUserId,
      );
      if (!actor?.permissions.has('place.manage')) {
        throw new ForbiddenException('Place management is required.');
      }
      const [place] = await transaction
        .update(places)
        .set({ ...values, updatedAt: now })
        .where(eq(places.id, placeId))
        .returning();
      await transaction.insert(auditLog).values({
        action: 'place.updated',
        actorUserId,
        metadata: values,
        placeId,
        targetId: placeId,
        targetType: 'place',
      });
      return place;
    });
  }

  async updateSettings(
    placeId: string,
    settings: Record<string, unknown>,
    actorUserId: string,
    now: Date,
  ) {
    return this.database.transaction(async (transaction) => {
      const actor = await loadPlaceMutationPolicy(
        transaction,
        placeId,
        actorUserId,
      );
      if (!actor?.permissions.has('place.manage')) {
        throw new ForbiddenException('Place management is required.');
      }
      const [place] = await transaction
        .update(places)
        .set({ settings, updatedAt: now })
        .where(eq(places.id, placeId))
        .returning();
      await transaction.insert(auditLog).values({
        action: 'place.settings.updated',
        actorUserId,
        placeId,
        targetId: placeId,
        targetType: 'place',
      });
      return place;
    });
  }

  async archive(placeId: string, actorUserId: string, now: Date) {
    return this.database.transaction(async (transaction) => {
      const actor = await loadPlaceMutationPolicy(
        transaction,
        placeId,
        actorUserId,
      );
      if (!actor?.permissions.has('place.manage')) {
        throw new ForbiddenException('Place management is required.');
      }
      const [place] = await transaction
        .update(places)
        .set({ archivedAt: now, updatedAt: now })
        .where(and(eq(places.id, placeId), isNull(places.archivedAt)))
        .returning();
      if (place) {
        await transaction.insert(auditLog).values({
          action: 'place.archived',
          actorUserId,
          placeId,
          targetId: placeId,
          targetType: 'place',
        });
      }
      return place;
    });
  }

  async getAuthorization(
    placeId: string,
    userId: string,
  ): Promise<PlaceAuthorizationRecord | undefined> {
    const [membership] = await this.database
      .select({
        isOwner: places.ownerUserId,
        memberId: placeMembers.id,
      })
      .from(placeMembers)
      .innerJoin(places, eq(places.id, placeMembers.placeId))
      .where(
        and(
          eq(placeMembers.placeId, placeId),
          eq(placeMembers.userId, userId),
          eq(placeMembers.status, 'active'),
          isNull(places.archivedAt),
        ),
      )
      .limit(1);
    if (!membership) {
      return undefined;
    }
    const grants = await this.database
      .select({ permission: rolePermissions.permission, position: roles.position })
      .from(memberRoles)
      .innerJoin(roles, eq(roles.id, memberRoles.roleId))
      .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .where(
        and(
          eq(memberRoles.placeId, placeId),
          eq(memberRoles.memberId, membership.memberId),
        ),
      );
    return {
      isOwner: membership.isOwner === userId,
      memberId: membership.memberId,
      permissions: new Set(
        grants.flatMap((grant) =>
          grant.permission === null ? [] : [grant.permission],
        ),
      ),
      position: Math.max(0, ...grants.map((grant) => grant.position)),
    };
  }

  async listMembers(
    placeId: string,
    options: {
      cursor?: PlaceCursor;
      limit: number;
      status?: 'pending' | 'active';
    },
  ): Promise<MemberRecord[]> {
    const cursor = options.cursor
      ? or(
          lt(placeMembers.createdAt, options.cursor.createdAt),
          and(
            eq(placeMembers.createdAt, options.cursor.createdAt),
            lt(placeMembers.id, options.cursor.id),
          ),
        )
      : undefined;
    const members = await this.database
      .select({
        createdAt: placeMembers.createdAt,
        displayName: users.displayName,
        handle: users.handle,
        id: placeMembers.id,
        joinedAt: placeMembers.joinedAt,
        status: placeMembers.status,
        userId: placeMembers.userId,
      })
      .from(placeMembers)
      .innerJoin(users, eq(users.id, placeMembers.userId))
      .where(
        and(
          eq(placeMembers.placeId, placeId),
          options.status ? eq(placeMembers.status, options.status) : undefined,
          cursor,
        ),
      )
      .orderBy(desc(placeMembers.createdAt), desc(placeMembers.id))
      .limit(Math.min(Math.max(options.limit, 1), 100) + 1);
    return this.attachRoles(placeId, members);
  }

  async findMember(placeId: string, memberId: string): Promise<MemberRecord | undefined> {
    const [member] = await this.database
      .select({
        createdAt: placeMembers.createdAt,
        displayName: users.displayName,
        handle: users.handle,
        id: placeMembers.id,
        joinedAt: placeMembers.joinedAt,
        status: placeMembers.status,
        userId: placeMembers.userId,
      })
      .from(placeMembers)
      .innerJoin(users, eq(users.id, placeMembers.userId))
      .where(and(eq(placeMembers.placeId, placeId), eq(placeMembers.id, memberId)))
      .limit(1);
    if (!member) {
      return undefined;
    }
    return (await this.attachRoles(placeId, [member]))[0];
  }

  async findMemberByUserId(
    placeId: string,
    userId: string,
  ): Promise<MemberRecord | undefined> {
    const [member] = await this.database
      .select({
        createdAt: placeMembers.createdAt,
        displayName: users.displayName,
        handle: users.handle,
        id: placeMembers.id,
        joinedAt: placeMembers.joinedAt,
        status: placeMembers.status,
        userId: placeMembers.userId,
      })
      .from(placeMembers)
      .innerJoin(users, eq(users.id, placeMembers.userId))
      .where(
        and(
          eq(placeMembers.placeId, placeId),
          eq(placeMembers.userId, userId),
        ),
      )
      .limit(1);
    if (!member) {
      return undefined;
    }
    return (await this.attachRoles(placeId, [member]))[0];
  }

  private async attachRoles(
    placeId: string,
    members: Array<Omit<MemberRecord, 'roles'>>,
  ): Promise<MemberRecord[]> {
    if (members.length === 0) {
      return [];
    }
    const assignments = await this.database
      .select({
        isSystem: roles.isSystem,
        memberId: memberRoles.memberId,
        name: roles.name,
        position: roles.position,
        roleId: roles.id,
      })
      .from(memberRoles)
      .innerJoin(roles, eq(roles.id, memberRoles.roleId))
      .where(
        and(
          eq(memberRoles.placeId, placeId),
          inArray(
            memberRoles.memberId,
            members.map((member) => member.id),
          ),
        ),
      );
    const roleIds = assignments.map((assignment) => assignment.roleId);
    const grants = roleIds.length
      ? await this.database
          .select()
          .from(rolePermissions)
          .where(inArray(rolePermissions.roleId, roleIds))
      : [];
    return members.map((member) => ({
      ...member,
      roles: assignments
        .filter((assignment) => assignment.memberId === member.id)
        .map((assignment) => ({
          id: assignment.roleId,
          isSystem: assignment.isSystem,
          name: assignment.name,
          permissions: grants
            .filter((grant) => grant.roleId === assignment.roleId)
            .map((grant) => grant.permission),
          position: assignment.position,
        })),
    }));
  }
}