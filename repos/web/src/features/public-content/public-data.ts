import { ApiError } from "@/lib/api/problem-details";
import { publicServerRead } from "@/lib/api/public-server";
import { withCursor } from "@/lib/api/request";
import type { PlaceContract, PlacePageContract } from "@/features/places/place-contract";
import type {
  ForumNavigationContract,
  PostPageContract,
  PublicProfileContract,
  SearchPageContract,
  TopicContract,
  TopicPageContract,
} from "./public-contracts";

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

const publicReadOptions = {
  cache: "force-cache" as const,
  next: { revalidate: PUBLIC_REVALIDATE_SECONDS },
};

export async function listPublicPlaces(parameters: { cursor?: string; joinPolicy?: string; query?: string } = {}): Promise<PlacePageContract> {
  return readPublic<PlacePageContract>(withCursor("/places", parameters.cursor, {
    joinPolicy: parameters.joinPolicy,
    q: parameters.query,
  }), ["places"]);
}

export async function getPublicPlace(placeSlug: string): Promise<PlaceContract> {
  return readPublic<PlaceContract>(`/places/${encodeURIComponent(placeSlug)}`, ["places", `place:${placeSlug}`]);
}

export async function getForumNavigation(placeSlug: string): Promise<ForumNavigationContract> {
  return readPublic<ForumNavigationContract>(`/places/${encodeURIComponent(placeSlug)}/forums`, [`place:${placeSlug}:forums`]);
}

export async function listPublicTopics(
  placeSlug: string,
  parameters: TopicListParameters = {},
): Promise<TopicPageContract> {
  const path = withCursor(`/places/${encodeURIComponent(placeSlug)}/topics`, parameters.cursor, {
    feed: parameters.feed,
    forumId: parameters.forumId,
    tag: parameters.tag,
  });
  return readPublic<TopicPageContract>(path, [`place:${placeSlug}:topics`]);
}

export async function getPublicTopic(placeSlug: string, topicId: string): Promise<TopicContract> {
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
  return readPublic<PostPageContract>(
    withCursor(`/places/${encodeURIComponent(placeSlug)}/topics/${encodeURIComponent(topicId)}/posts`, cursor),
    [`topic:${topicId}:posts`],
  );
}

export async function getPublicProfile(handle: string): Promise<PublicProfileContract> {
  return readPublic<PublicProfileContract>(`/profiles/${encodeURIComponent(handle)}`, [`profile:${handle}`]);
}

export async function searchPublicContent(parameters: {
  cursor?: string;
  placeId?: string;
  query: string;
  type?: "place" | "post" | "topic";
}): Promise<SearchPageContract> {
  try {
    return await publicServerRead<SearchPageContract>(withCursor("/search", parameters.cursor, {
      placeId: parameters.placeId,
      q: parameters.query,
      type: parameters.type,
    }), { cache: "no-store" });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.problem.status === 403) throw new PublicResourceError("private");
      if (error.problem.status === 404) throw new PublicResourceError("not-found");
    }
    throw new PublicResourceError("unavailable");
  }
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