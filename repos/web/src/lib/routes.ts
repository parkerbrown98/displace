export const routes = {
  home: "/",
  discover: "/discover",
  saved: "/saved",
  search: "/search",
  signIn: "/sign-in",
  settings: "/settings",
  notifications: "/notifications",
  moderation: "/moderation",
  administration: "/admin",
  createPlace: "/places/new",
  member: (username: string) => `/members/${username}`,
  place: (placeSlug: string) => `/places/${placeSlug}`,
  forum: (placeSlug: string, forumSlug: string) =>
    `/places/${placeSlug}/forums/${forumSlug}`,
  topic: (placeSlug: string, topicSlug: string) =>
    `/places/${placeSlug}/topics/${topicSlug}`,
  createTopic: (placeSlug: string) => `/places/${placeSlug}/topics/new`,
  chat: (placeSlug: string, channelSlug: string) =>
    `/places/${placeSlug}/chat/${channelSlug}`,
} as const;