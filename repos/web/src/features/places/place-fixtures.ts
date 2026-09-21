import type { PlaceContextContract, PlaceContract, PlaceInviteContract, PlaceMemberContract, PlaceRoleContract } from "./place-contract";
import { placePermissions } from "./place-contract";

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

const ownerRole: PlaceRoleContract = {
  id: "01990000-7000-8000-8000-000000000010",
  isSystem: true,
  name: "Owner",
  permissions: [...placePermissions],
  position: 100,
};

const moderatorRole: PlaceRoleContract = {
  id: "01990000-7000-8000-8000-000000000011",
  isSystem: true,
  name: "Moderator",
  permissions: ["member.manage", "forum.manage", "topic.create", "post.create", "chat.manage", "chat.send", "voice.manage", "voice.join", "upload.create", "moderation.manage"],
  position: 50,
};

const memberRole: PlaceRoleContract = {
  id: "01990000-7000-8000-8000-000000000012",
  isSystem: true,
  name: "Member",
  permissions: ["topic.create", "post.create", "chat.send", "voice.join", "upload.create"],
  position: 10,
};

export const placeRolesFixture: PlaceRoleContract[] = [memberRole, moderatorRole, ownerRole];

export const memberFixture: PlaceMemberContract = {
  id: "01990000-7000-8000-8000-000000000020",
  userId: "01990000-7000-8000-8000-000000000021",
  handle: "mara",
  displayName: "Mara V.",
  status: "active",
  joinedAt: "2024-02-12T00:00:00.000Z",
  roles: [moderatorRole],
};

export const pendingMemberFixture: PlaceMemberContract = {
  id: "01990000-7000-8000-8000-000000000022",
  userId: "01990000-7000-8000-8000-000000000023",
  handle: "noah",
  displayName: "Noah Park",
  status: "pending",
  joinedAt: null,
  roles: [],
};

export const placeMembersFixture: PlaceMemberContract[] = [
  {
    id: "01990000-7000-8000-8000-000000000024",
    userId: placeContractFixture.ownerUserId,
    handle: "parker",
    displayName: "Parker",
    status: "active",
    joinedAt: "2024-01-18T00:00:00.000Z",
    roles: [ownerRole],
  },
  memberFixture,
];

export const placeContextFixture: PlaceContextContract = {
  place: placeContractFixture,
  viewer: {
    isOwner: true,
    memberId: placeMembersFixture[0].id,
    permissions: [...placePermissions],
  },
};

export const placeInvitesFixture: PlaceInviteContract[] = [{
  id: "01990000-7000-8000-8000-000000000030",
  email: "new-member@example.com",
  roleId: memberRole.id,
  maxUses: 1,
  useCount: 0,
  expiresAt: "2026-09-27T00:00:00.000Z",
  createdAt: "2026-09-20T00:00:00.000Z",
}];