import { ApiError } from "@/lib/api/problem-details";
import { publicServerRead } from "@/lib/api/public-server";
import { withCursor } from "@/lib/api/request";
import type { PlaceContract, PlacePageContract } from "@/features/places/place-contract";
import { placeContractFixture } from "@/features/places/place-contract";
import type {
  ForumNavigationContract,
  PostPageContract,
  PublicProfileFixture,
  TopicContract,
  TopicPageContract,
} from "./public-contracts";
import {
  forumNavigationFixture,
  placePageFixture,
  postPageFixture,
  publicProfilesFixture,
  topicPageFixture,
} from "./public-fixtures";

export type PublicResourceFailure = "archived" | "not-found" | "private" | "unavailable";

export class PublicResourceError extends Error {
  constructor(readonly reason: PublicResourceFailure) {
    super(reason === "unavailable" ? "Public content is temporarily unavailable." : "Public content was not found.");
    this.name = "PublicResourceError";
  }
}

export interface TopicListParameters {
  cursor?: string;
  feed?: "following" | "latest" | "popular";
  forumId?: string;
  tag?: string;
}

const PUBLIC_REVALIDATE_SECONDS = 60;

function usesFixtures(): boolean {
  return process.env.WEB_DATA_SOURCE !== "api";
}

const publicReadOptions = {
  cache: "force-cache" as const,
  next: { revalidate: PUBLIC_REVALIDATE_SECONDS },
};

export async function listPublicPlaces(parameters: { cursor?: string; joinPolicy?: string; query?: string } = {}): Promise<PlacePageContract> {
  if (usesFixtures()) {
    if (parameters.cursor) return { items: [] };
    const query = parameters.query?.trim().toLocaleLowerCase();
    return { items: structuredClone(placePageFixture.items.filter((place) =>
      (!query || `${place.name} ${place.description}`.toLocaleLowerCase().includes(query)) &&
      (!parameters.joinPolicy || place.joinPolicy === parameters.joinPolicy),
    )) };
  }
  return readPublic<PlacePageContract>(withCursor("/places", parameters.cursor, {
    joinPolicy: parameters.joinPolicy,
    q: parameters.query,
  }), ["places"]);
}

export async function getPublicPlace(placeSlug: string): Promise<PlaceContract> {
  if (usesFixtures()) {
    const place = placePageFixture.items.find((item) => item.slug === placeSlug);
    if (!place) throw new PublicResourceError("not-found");
    return structuredClone(place);
  }
  return readPublic<PlaceContract>(`/places/${encodeURIComponent(placeSlug)}`, ["places", `place:${placeSlug}`]);
}

export async function getForumNavigation(placeSlug: string): Promise<ForumNavigationContract> {
  if (usesFixtures()) {
    if (placeSlug !== placeContractFixture.slug) return { groups: [], tags: [] };
    return structuredClone(forumNavigationFixture);
  }
  return readPublic<ForumNavigationContract>(`/places/${encodeURIComponent(placeSlug)}/forums`, [`place:${placeSlug}:forums`]);
}

export async function listPublicTopics(
  placeSlug: string,
  parameters: TopicListParameters = {},
): Promise<TopicPageContract> {
  if (usesFixtures()) {
    if (parameters.cursor) return { items: [] };
    const items = topicPageFixture.items.filter((topic) =>
      (!parameters.forumId || topic.forumId === parameters.forumId) &&
      (!parameters.tag || topic.tags.some((tag) => tag.slug === parameters.tag)),
    );
    return { ...structuredClone(topicPageFixture), items };
  }
  const path = withCursor(`/places/${encodeURIComponent(placeSlug)}/topics`, parameters.cursor, {
    feed: parameters.feed,
    forumId: parameters.forumId,
    tag: parameters.tag,
  });
  return readPublic<TopicPageContract>(path, [`place:${placeSlug}:topics`]);
}

export async function getPublicTopic(placeSlug: string, topicId: string): Promise<TopicContract> {
  if (usesFixtures()) {
    const topic = topicPageFixture.items.find((item) => item.id === topicId);
    if (!topic || placeSlug !== placeContractFixture.slug) throw new PublicResourceError("not-found");
    return structuredClone(topic);
  }
  return readPublic<TopicContract>(
    `/places/${encodeURIComponent(placeSlug)}/topics/${encodeURIComponent(topicId)}`,
    [`topic:${topicId}`],
  );
}

export async function listPublicPosts(
  placeSlug: string,
  topicId: string,
  cursor?: string,
): Promise<PostPageContract> {
  if (usesFixtures()) {
    return cursor ? { items: [] } : structuredClone(postPageFixture);
  }
  return readPublic<PostPageContract>(
    withCursor(`/places/${encodeURIComponent(placeSlug)}/topics/${encodeURIComponent(topicId)}/posts`, cursor),
    [`topic:${topicId}:posts`],
  );
}

export async function getPublicProfile(handle: string): Promise<PublicProfileFixture> {
  if (!usesFixtures()) throw new PublicResourceError("unavailable");
  const profile = publicProfilesFixture[handle];
  if (!profile) throw new PublicResourceError("not-found");
  return structuredClone(profile);
}

async function readPublic<T>(path: string, tags: string[]): Promise<T> {
  try {
    return await publicServerRead<T>(path, {
      ...publicReadOptions,
      next: { ...publicReadOptions.next, tags },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.problem.status === 403) throw new PublicResourceError("private");
      if (error.problem.status === 404) throw new PublicResourceError("not-found");
      if (error.problem.status === 410) throw new PublicResourceError("archived");
    }
    throw new PublicResourceError("unavailable");
  }
}