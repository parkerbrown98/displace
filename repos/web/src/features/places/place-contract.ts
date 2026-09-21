export interface PlaceContract {
  id: string;
  ownerUserId: string;
  slug: string;
  name: string;
  description: string;
  visibility: "private" | "public" | "unlisted";
  joinPolicy: "approval" | "invite_only" | "open";
  settings: Record<string, unknown>;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlacePageContract {
  items: PlaceContract[];
  nextCursor?: string;
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

export const placeContractFixture: PlaceContract = {
  id: "0199-0000-7000-8000-000000000001",
  ownerUserId: "0199-0000-7000-8000-000000000002",
  slug: "game-makers",
  name: "Game Makers",
  description: "Thoughtful discussion for people making games at every scale.",
  visibility: "public",
  joinPolicy: "open",
  settings: {},
  archivedAt: null,
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-20T00:00:00.000Z",
};

export const openSourcePlaceContractFixture: PlaceContract = {
  ...placeContractFixture,
  id: "01990000-7000-8000-8000-000000000003",
  ownerUserId: "01990000-7000-8000-8000-000000000004",
  slug: "open-source",
  name: "Open Source",
  description: "Maintainers and contributors building software in the open.",
};

export const soundDesignPlaceContractFixture: PlaceContract = {
  ...placeContractFixture,
  id: "01990000-7000-8000-8000-000000000005",
  ownerUserId: "01990000-7000-8000-8000-000000000006",
  slug: "sound-design",
  name: "Sound Design",
  description: "Recording, synthesis, implementation, and critical listening.",
};