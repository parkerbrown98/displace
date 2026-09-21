import { authenticatedMutation, authenticatedRead } from "@/features/auth/auth-client";
import { ApiError } from "@/lib/api/problem-details";
import type {
  PlaceContextContract,
  PlaceContract,
  PlaceInviteContract,
  PlaceInvitePageContract,
  PlaceMemberContract,
  PlaceMemberPageContract,
  PlacePageContract,
  PlaceRoleContract,
  PlaceRolePageContract,
  PlaceWriteInput,
  RoleWriteInput,
} from "./place-contract";
import {
  memberFixture,
  pendingMemberFixture,
  placeContextFixture,
  placeInvitesFixture,
  placeMembersFixture,
  placeRolesFixture,
} from "./place-fixtures";
import { openSourcePlaceContractFixture, placeContractFixture, soundDesignPlaceContractFixture } from "./place-contract";

function usesFixtures(): boolean {
  return process.env.NEXT_PUBLIC_WEB_DATA_SOURCE !== "api";
}

export function singlePlaceSlug(): string | undefined {
  return process.env.NEXT_PUBLIC_SINGLE_PLACE_SLUG || undefined;
}

export async function listMyPlaces(): Promise<PlacePageContract> {
  if (usesFixtures()) {
    const items = [placeContractFixture, openSourcePlaceContractFixture, soundDesignPlaceContractFixture];
    const configured = singlePlaceSlug();
    return { items: structuredClone(configured ? items.filter((place) => place.slug === configured) : items) };
  }
  return authenticatedRead<PlacePageContract>("/places/mine");
}

export async function getPlaceContext(placeId: string): Promise<PlaceContextContract> {
  if (usesFixtures()) return structuredClone({ ...placeContextFixture, place: fixturePlace(placeId) });
  return authenticatedRead<PlaceContextContract>(`/places/${encodeURIComponent(placeId)}/context`);
}

export async function createPlace(input: PlaceWriteInput & { slug: string }): Promise<PlaceContract> {
  if (usesFixtures()) return structuredClone({ ...placeContractFixture, ...input, id: crypto.randomUUID(), ownerUserId: "fixture-user", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  return authenticatedMutation<PlaceContract>("/places", { body: input, method: "POST" });
}

export async function updatePlace(placeId: string, input: PlaceWriteInput): Promise<PlaceContract> {
  if (usesFixtures()) return structuredClone({ ...fixturePlace(placeId), ...input, updatedAt: new Date().toISOString() });
  return authenticatedMutation<PlaceContract>(`/places/${encodeURIComponent(placeId)}`, { body: input, method: "PATCH" });
}

export async function updatePlaceSettings(placeId: string, settings: Record<string, unknown>): Promise<PlaceContract> {
  if (usesFixtures()) return structuredClone({ ...fixturePlace(placeId), settings });
  return authenticatedMutation<PlaceContract>(`/places/${encodeURIComponent(placeId)}/settings`, { body: { settings }, method: "PATCH" });
}

export async function archivePlace(placeId: string): Promise<void> {
  if (usesFixtures()) return;
  return authenticatedMutation<void>(`/places/${encodeURIComponent(placeId)}`, { method: "DELETE" });
}

export async function joinPlace(placeId: string): Promise<{ memberId: string; status: "active" | "pending" }> {
  if (usesFixtures()) return { memberId: memberFixture.id, status: fixturePlace(placeId).joinPolicy === "approval" ? "pending" : "active" };
  return authenticatedMutation(`/places/${encodeURIComponent(placeId)}/join`, { body: {}, method: "POST" });
}

export async function acceptPlaceInvite(placeId: string, token: string): Promise<{ memberId: string; status: "active" | "pending" }> {
  if (usesFixtures()) {
    if (token.length < 32) throw new ApiError({ status: 400, title: "Invalid invite", detail: "The invite is invalid or expired." });
    return { memberId: memberFixture.id, status: "active" };
  }
  return authenticatedMutation(`/places/${encodeURIComponent(placeId)}/invites/accept`, { body: { token }, method: "POST" });
}

export async function leavePlace(placeId: string): Promise<void> {
  if (usesFixtures()) return;
  return authenticatedMutation<void>(`/places/${encodeURIComponent(placeId)}/members/me`, { method: "DELETE" });
}

export async function listPlaceMembers(placeId: string, status: "active" | "pending" = "active"): Promise<PlaceMemberPageContract> {
  if (usesFixtures()) return { items: structuredClone(status === "pending" ? [pendingMemberFixture] : placeMembersFixture) };
  return authenticatedRead<PlaceMemberPageContract>(`/places/${encodeURIComponent(placeId)}/members?status=${status}`);
}

export async function getPlaceMember(placeId: string, memberId: string): Promise<PlaceMemberContract> {
  if (usesFixtures()) {
    const member = [...placeMembersFixture, pendingMemberFixture].find((item) => item.id === memberId);
    if (!member) throw new ApiError({ status: 404, title: "Member not found" });
    return structuredClone(member);
  }
  return authenticatedRead<PlaceMemberContract>(`/places/${encodeURIComponent(placeId)}/members/${encodeURIComponent(memberId)}`);
}

export async function approvePlaceMember(placeId: string, memberId: string): Promise<PlaceMemberContract> {
  if (usesFixtures()) return structuredClone({ ...pendingMemberFixture, id: memberId, status: "active", joinedAt: new Date().toISOString() });
  return authenticatedMutation(`/places/${encodeURIComponent(placeId)}/members/${encodeURIComponent(memberId)}/approve`, { method: "POST" });
}

export async function removePlaceMember(placeId: string, memberId: string): Promise<void> {
  if (usesFixtures()) return;
  return authenticatedMutation<void>(`/places/${encodeURIComponent(placeId)}/members/${encodeURIComponent(memberId)}`, { method: "DELETE" });
}

export async function transferPlaceOwnership(placeId: string, userId: string): Promise<void> {
  if (usesFixtures()) return;
  return authenticatedMutation<void>(`/places/${encodeURIComponent(placeId)}/ownership`, { body: { userId }, method: "POST" });
}

export async function listPlaceRoles(placeId: string): Promise<PlaceRolePageContract> {
  if (usesFixtures()) return { items: structuredClone(placeRolesFixture) };
  return authenticatedRead<PlaceRolePageContract>(`/places/${encodeURIComponent(placeId)}/roles`);
}

export async function createPlaceRole(placeId: string, input: RoleWriteInput): Promise<PlaceRoleContract> {
  if (usesFixtures()) return structuredClone({ ...input, id: crypto.randomUUID(), isSystem: false });
  return authenticatedMutation<PlaceRoleContract>(`/places/${encodeURIComponent(placeId)}/roles`, { body: input, method: "POST" });
}

export async function updatePlaceRole(placeId: string, roleId: string, input: RoleWriteInput): Promise<PlaceRoleContract> {
  if (usesFixtures()) return structuredClone({ ...input, id: roleId, isSystem: false });
  return authenticatedMutation<PlaceRoleContract>(`/places/${encodeURIComponent(placeId)}/roles/${encodeURIComponent(roleId)}`, { body: input, method: "PATCH" });
}

export async function deletePlaceRole(placeId: string, roleId: string): Promise<void> {
  if (usesFixtures()) return;
  return authenticatedMutation<void>(`/places/${encodeURIComponent(placeId)}/roles/${encodeURIComponent(roleId)}`, { method: "DELETE" });
}

export async function assignPlaceRole(placeId: string, memberId: string, roleId: string): Promise<PlaceMemberContract> {
  if (usesFixtures()) return structuredClone({ ...memberFixture, id: memberId, roles: [...memberFixture.roles, placeRolesFixture.find((role) => role.id === roleId)!].filter(Boolean) });
  return authenticatedMutation(`/places/${encodeURIComponent(placeId)}/members/${encodeURIComponent(memberId)}/roles`, { body: { roleId }, method: "POST" });
}

export async function removePlaceRole(placeId: string, memberId: string, roleId: string): Promise<PlaceMemberContract> {
  if (usesFixtures()) return structuredClone({ ...memberFixture, id: memberId, roles: memberFixture.roles.filter((role) => role.id !== roleId) });
  return authenticatedMutation(`/places/${encodeURIComponent(placeId)}/members/${encodeURIComponent(memberId)}/roles/${encodeURIComponent(roleId)}`, { method: "DELETE" });
}

export async function listPlaceInvites(placeId: string): Promise<PlaceInvitePageContract> {
  if (usesFixtures()) return { items: structuredClone(placeInvitesFixture) };
  return authenticatedRead<PlaceInvitePageContract>(`/places/${encodeURIComponent(placeId)}/invites`);
}

export async function createPlaceInvite(placeId: string, input: { email?: string; roleId?: string }): Promise<PlaceInviteContract> {
  if (usesFixtures()) return { id: crypto.randomUUID(), email: input.email ?? null, roleId: input.roleId ?? null, maxUses: 1, useCount: 0, expiresAt: new Date(Date.now() + 604_800_000).toISOString(), createdAt: new Date().toISOString(), token: "fixture-invite-token-0123456789abcdef" };
  return authenticatedMutation<PlaceInviteContract>(`/places/${encodeURIComponent(placeId)}/invites`, { body: { ...input, expiresInHours: 168, maxUses: 1 }, method: "POST" });
}

export async function revokePlaceInvite(placeId: string, inviteId: string): Promise<void> {
  if (usesFixtures()) return;
  return authenticatedMutation<void>(`/places/${encodeURIComponent(placeId)}/invites/${encodeURIComponent(inviteId)}`, { method: "DELETE" });
}

export function isForbiddenPlaceError(error: unknown): boolean {
  return error instanceof ApiError && error.problem.status === 403;
}

function fixturePlace(identifier: string): PlaceContract {
  return [placeContractFixture, openSourcePlaceContractFixture, soundDesignPlaceContractFixture]
    .find((place) => place.id === identifier || place.slug === identifier) ?? placeContractFixture;
}