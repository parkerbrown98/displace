import { and, eq } from 'drizzle-orm';
import type { DatabaseTransaction } from '../database/database.types.js';
import {
  memberRoles,
  placeMembers,
  places,
  rolePermissions,
  roles,
} from '../database/schema/index.js';

export interface PlaceMutationPolicy {
  isOwner: boolean;
  memberId: string;
  ownerUserId: string;
  permissions: Set<string>;
  position: number;
}

export async function loadPlaceMutationPolicy(
  transaction: DatabaseTransaction,
  placeId: string,
  userId: string,
): Promise<PlaceMutationPolicy | undefined> {
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
    return undefined;
  }
  const [membership] = await transaction
    .select({ id: placeMembers.id })
    .from(placeMembers)
    .where(
      and(
        eq(placeMembers.placeId, placeId),
        eq(placeMembers.userId, userId),
        eq(placeMembers.status, 'active'),
      ),
    )
    .limit(1);
  if (!membership) {
    return undefined;
  }
  const grants = await transaction
    .select({ permission: rolePermissions.permission, position: roles.position })
    .from(memberRoles)
    .innerJoin(roles, eq(roles.id, memberRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .where(
      and(
        eq(memberRoles.placeId, placeId),
        eq(memberRoles.memberId, membership.id),
      ),
    );
  return {
    isOwner: place.ownerUserId === userId,
    memberId: membership.id,
    ownerUserId: place.ownerUserId,
    permissions: new Set(
      grants.flatMap((grant) =>
        grant.permission === null ? [] : [grant.permission],
      ),
    ),
    position: Math.max(0, ...grants.map((grant) => grant.position)),
  };
}

export function canManageRole(
  actor: PlaceMutationPolicy | undefined,
  position: number,
  permissions: readonly string[],
): boolean {
  return Boolean(
    actor?.permissions.has('role.manage') &&
      position < actor.position &&
      permissions.every((permission) => actor.permissions.has(permission)),
  );
}