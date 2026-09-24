export interface PlaceContract {
  id: string;
  ownerUserId: string;
  slug: string;
  name: string;
  description: string;
  memberCount: number;
  visibility: "private" | "public" | "unlisted";
  joinPolicy: "approval" | "invite_only" | "open";
  settings: Record<string, unknown>;
  hasBanner?: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlacePageContract {
  items: PlaceContract[];
  nextCursor?: string;
  tags?: PlaceTagFacetContract[];
}

export interface PlaceTagFacetContract {
  count: number;
  name: string;
}

export function placeDiscoveryTags(place: PlaceContract): string[] {
  return Array.isArray(place.settings.tags)
    ? place.settings.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
}

export const placePermissions = [
  "place.manage",
  "role.manage",
  "member.manage",
  "forum.manage",
  "topic.create",
  "post.create",
  "chat.manage",
  "chat.send",
  "voice.manage",
  "voice.join",
  "upload.read",
  "upload.create",
  "moderation.manage",
] as const;

export type PlacePermission = (typeof placePermissions)[number];

export interface PlaceContextContract {
  place: PlaceContract;
  viewer: {
    isOwner: boolean;
    memberId: string;
    permissions: PlacePermission[];
  };
}

export interface PlaceRoleContract {
  id: string;
  name: string;
  position: number;
  isSystem: boolean;
  permissions: PlacePermission[];
}

export interface PlaceMemberContract {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  status: "pending" | "active" | "left";
  joinedAt: string | null;
  lastSeenAt?: string | null;
  roles: PlaceRoleContract[];
}

export interface PlaceMemberPageContract {
  items: PlaceMemberContract[];
  nextCursor?: string;
}

export interface PlaceRolePageContract {
  items: PlaceRoleContract[];
  nextCursor?: string;
}

export interface PlaceInviteContract {
  id: string;
  email: string | null;
  roleId: string | null;
  maxUses: number;
  useCount: number;
  expiresAt: string;
  createdAt: string;
  token?: string;
}

export interface PlaceInvitePageContract {
  items: PlaceInviteContract[];
  nextCursor?: string;
}

export interface PlaceWriteInput {
  name: string;
  slug?: string;
  description: string;
  visibility: PlaceContract["visibility"];
  joinPolicy: PlaceContract["joinPolicy"];
}

export interface RoleWriteInput {
  name: string;
  position: number;
  permissions: PlacePermission[];
}