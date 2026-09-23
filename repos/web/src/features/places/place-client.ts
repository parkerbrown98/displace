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

export function singlePlaceSlug(): string | undefined {
  return process.env.NEXT_PUBLIC_SINGLE_PLACE_SLUG || undefined;
}

export async function listMyPlaces(): Promise<PlacePageContract> {
  return authenticatedRead<PlacePageContract>("/places/mine");
}

export async function getPlaceContext(placeId: string): Promise<PlaceContextContract> {
  return authenticatedRead<PlaceContextContract>(`/places/${encodeURIComponent(placeId)}/context`);
}

export async function createPlace(input: PlaceWriteInput & { slug: string }): Promise<PlaceContract> {
  return authenticatedMutation<PlaceContract>("/places", { body: input, method: "POST" });
}

export async function updatePlace(placeId: string, input: PlaceWriteInput): Promise<PlaceContract> {
  return authenticatedMutation<PlaceContract>(`/places/${encodeURIComponent(placeId)}`, { body: input, method: "PATCH" });
}

export async function updatePlaceSettings(placeId: string, settings: Record<string, unknown>): Promise<PlaceContract> {
  return authenticatedMutation<PlaceContract>(`/places/${encodeURIComponent(placeId)}/settings`, { body: { settings }, method: "PATCH" });
}

export async function archivePlace(placeId: string): Promise<void> {
  return authenticatedMutation<void>(`/places/${encodeURIComponent(placeId)}`, { method: "DELETE" });
}

export async function joinPlace(placeId: string): Promise<{ memberId: string; status: "active" | "pending" }> {
  return authenticatedMutation(`/places/${encodeURIComponent(placeId)}/join`, { body: {}, method: "POST" });
}

export async function acceptPlaceInvite(placeId: string, token: string): Promise<{ memberId: string; status: "active" | "pending" }> {
  return authenticatedMutation(`/places/${encodeURIComponent(placeId)}/invites/accept`, { body: { token }, method: "POST" });
}

export async function leavePlace(placeId: string): Promise<void> {
  return authenticatedMutation<void>(`/places/${encodeURIComponent(placeId)}/members/me`, { method: "DELETE" });
}

export async function listPlaceMembers(placeId: string, status: "active" | "pending" = "active", query?: string, options?: { limit?: number; sort?: "joined" | "last_seen" }): Promise<PlaceMemberPageContract> {
  const parameters = new URLSearchParams({ status });
  if (query) parameters.set("q", query);
  if (options?.limit) parameters.set("limit", String(options.limit));
  if (options?.sort) parameters.set("sort", options.sort);
  return authenticatedRead<PlaceMemberPageContract>(`/places/${encodeURIComponent(placeId)}/members?${parameters}`);
}

export async function getPlaceMember(placeId: string, memberId: string): Promise<PlaceMemberContract> {
  return authenticatedRead<PlaceMemberContract>(`/places/${encodeURIComponent(placeId)}/members/${encodeURIComponent(memberId)}`);
}

export async function approvePlaceMember(placeId: string, memberId: string): Promise<PlaceMemberContract> {
  return authenticatedMutation(`/places/${encodeURIComponent(placeId)}/members/${encodeURIComponent(memberId)}/approve`, { method: "POST" });
}

export async function removePlaceMember(placeId: string, memberId: string): Promise<void> {
  return authenticatedMutation<void>(`/places/${encodeURIComponent(placeId)}/members/${encodeURIComponent(memberId)}`, { method: "DELETE" });
}

export async function transferPlaceOwnership(placeId: string, userId: string): Promise<void> {
  return authenticatedMutation<void>(`/places/${encodeURIComponent(placeId)}/ownership`, { body: { userId }, method: "POST" });
}

export async function listPlaceRoles(placeId: string): Promise<PlaceRolePageContract> {
  return authenticatedRead<PlaceRolePageContract>(`/places/${encodeURIComponent(placeId)}/roles`);
}

export async function createPlaceRole(placeId: string, input: RoleWriteInput): Promise<PlaceRoleContract> {
  return authenticatedMutation<PlaceRoleContract>(`/places/${encodeURIComponent(placeId)}/roles`, { body: input, method: "POST" });
}

export async function updatePlaceRole(placeId: string, roleId: string, input: Partial<RoleWriteInput>): Promise<PlaceRoleContract> {
  return authenticatedMutation<PlaceRoleContract>(`/places/${encodeURIComponent(placeId)}/roles/${encodeURIComponent(roleId)}`, { body: input, method: "PATCH" });
}

export async function deletePlaceRole(placeId: string, roleId: string): Promise<void> {
  return authenticatedMutation<void>(`/places/${encodeURIComponent(placeId)}/roles/${encodeURIComponent(roleId)}`, { method: "DELETE" });
}

export async function assignPlaceRole(placeId: string, memberId: string, roleId: string): Promise<PlaceMemberContract> {
  return authenticatedMutation(`/places/${encodeURIComponent(placeId)}/members/${encodeURIComponent(memberId)}/roles`, { body: { roleId }, method: "POST" });
}

export async function removePlaceRole(placeId: string, memberId: string, roleId: string): Promise<PlaceMemberContract> {
  return authenticatedMutation(`/places/${encodeURIComponent(placeId)}/members/${encodeURIComponent(memberId)}/roles/${encodeURIComponent(roleId)}`, { method: "DELETE" });
}

export async function listPlaceInvites(placeId: string): Promise<PlaceInvitePageContract> {
  return authenticatedRead<PlaceInvitePageContract>(`/places/${encodeURIComponent(placeId)}/invites`);
}

export async function createPlaceInvite(placeId: string, input: { email?: string; roleId?: string }): Promise<PlaceInviteContract> {
  return authenticatedMutation<PlaceInviteContract>(`/places/${encodeURIComponent(placeId)}/invites`, { body: { ...input, expiresInHours: 168, maxUses: 1 }, method: "POST" });
}

export async function revokePlaceInvite(placeId: string, inviteId: string): Promise<void> {
  return authenticatedMutation<void>(`/places/${encodeURIComponent(placeId)}/invites/${encodeURIComponent(inviteId)}`, { method: "DELETE" });
}

export function isForbiddenPlaceError(error: unknown): boolean {
  return error instanceof ApiError && error.problem.status === 403;
}