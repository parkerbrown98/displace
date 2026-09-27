import type { components } from '@displace/api-client';
import { PLACE_PERMISSIONS } from '@displace/api-client/domain-values';

export type PlaceContract = components['schemas']['PlaceDto'];
export type PlacePageContract = components['schemas']['PlacePageDto'];
export type PlaceTagFacetContract = components['schemas']['PlaceTagFacetDto'];

export function placeDiscoveryTags(place: PlaceContract): string[] {
  return Array.isArray(place.settings.tags)
    ? place.settings.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
}

export const placePermissions = PLACE_PERMISSIONS;

export type PlacePermission = components['schemas']['PlaceViewerDto']['permissions'][number];
export type PlaceContextContract = components['schemas']['PlaceContextDto'];
export type PlaceRoleContract = components['schemas']['RoleDto'];
export type PlaceMemberContract = components['schemas']['MemberDto'];
export type PlaceMemberPageContract = components['schemas']['MemberPageDto'];
export type PlaceRolePageContract = components['schemas']['RolePageDto'];
export type PlaceInviteContract = components['schemas']['InviteSummaryDto'] & { token?: string };
export type PlaceInvitePageContract = components['schemas']['InvitePageDto'];

export interface PlaceWriteInput {
  name: string;
  slug?: string;
  description: string;
  visibility: PlaceContract["visibility"];
  joinPolicy: PlaceContract["joinPolicy"];
}

export type RoleWriteInput = components['schemas']['CreateRoleDto'];