export type PlaceSettingsSection = "archive" | "chat" | "forums" | "identity" | "preferences" | "roles" | "voice";
export type AccountSettingsSection = "email" | "password" | "profile" | "profile-image" | "sessions";

export const routes = {
  home: "/",
  discover: "/discover",
  saved: "/saved",
  search: "/search",
  signIn: "/sign-in",
  register: "/register",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",
  oidcCallback: "/auth/callback",
  sessionExpired: "/session-expired",
  settings: "/settings",
  accountSettingsSection: (section: AccountSettingsSection) => `/settings/${section}`,
  notifications: "/notifications",
  moderation: "/moderation",
  administration: "/admin",
  createPlace: "/places/new",
  discoverInPlace: (placeId: string) =>
    `/discover?placeId=${encodeURIComponent(placeId)}`,
  member: (username: string) => `/members/${username}`,
  place: (placeSlug: string) => `/places/${placeSlug}`,
  placeSettings: (placeSlug: string) => `/places/${placeSlug}/settings`,
  placeSettingsSection: (placeSlug: string, section: PlaceSettingsSection) =>
    `/places/${placeSlug}/settings/${section}`,
  placeModeration: (placeSlug: string) => `/places/${placeSlug}/moderation`,
  placeMembers: (placeSlug: string) => `/places/${placeSlug}/members`,
  placeMember: (placeSlug: string, memberId: string) => `/places/${placeSlug}/members/${memberId}`,
  acceptPlaceInvite: (placeSlug: string) => `/places/${placeSlug}/invites/accept`,
  forum: (placeSlug: string, forumSlug: string) =>
    `/places/${placeSlug}/forums/${forumSlug}`,
  topic: (placeSlug: string, topicSlug: string) =>
    `/places/${placeSlug}/topics/${topicSlug}`,
  createTopic: (placeSlug: string) => `/places/${placeSlug}/topics/new`,
  chat: (placeSlug: string, channelSlug: string) =>
    `/places/${placeSlug}/chat/${channelSlug}`,
  voice: (placeSlug: string) => `/places/${placeSlug}/voice`,
} as const;