import { authenticatedRead } from "@/features/auth/auth-client";
import { browserRead } from "@/lib/api/browser";
import type { HomeFeedPageContract, HomeFeedSort } from "./home-feed-contract";

export function listHomeFeed(
  sort: HomeFeedSort,
  cursor: string | undefined,
  authenticated: boolean,
): Promise<HomeFeedPageContract> {
  const query = new URLSearchParams({ limit: "15", sort });
  if (cursor) query.set("cursor", cursor);
  const path = `/feed?${query}`;
  return authenticated
    ? authenticatedRead<HomeFeedPageContract>(path)
    : browserRead<HomeFeedPageContract>(path);
}