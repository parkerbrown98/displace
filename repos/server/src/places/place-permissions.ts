export const PLACE_PERMISSIONS = [
  'place.manage',
  'role.manage',
  'member.manage',
  'forum.manage',
  'topic.create',
  'post.create',
  'chat.manage',
  'chat.send',
  'voice.manage',
  'voice.join',
  'upload.read',
  'upload.create',
  'moderation.manage',
] as const;

export type PlacePermission = (typeof PLACE_PERMISSIONS)[number];

export const DEFAULT_PLACE_ROLES = [
  {
    isSystem: true,
    name: 'Owner',
    permissions: PLACE_PERMISSIONS,
    position: 100,
  },
  {
    isSystem: true,
    name: 'Admin',
    permissions: PLACE_PERMISSIONS.filter(
      (permission) => permission !== 'place.manage',
    ),
    position: 80,
  },
  {
    isSystem: true,
    name: 'Moderator',
    permissions: [
      'member.manage',
      'forum.manage',
      'topic.create',
      'post.create',
      'chat.manage',
      'chat.send',
      'voice.manage',
      'voice.join',
      'upload.read',
      'upload.create',
      'moderation.manage',
    ] satisfies PlacePermission[],
    position: 50,
  },
  {
    isSystem: true,
    name: 'Member',
    permissions: [
      'topic.create',
      'post.create',
      'chat.send',
      'voice.join',
      'upload.read',
      'upload.create',
    ] satisfies PlacePermission[],
    position: 10,
  },
] as const;
