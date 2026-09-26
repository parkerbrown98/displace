import type { TopicContract } from "@/features/public-content/public-contracts";

export type HomeFeedSort = "best" | "hot" | "new" | "top";
export type HomeFeedSource = "following" | "joined" | "trending";

export interface HomeFeedItemContract {
  excerpt: string;
  forum: { id: string; name: string };
  isFollowing: boolean;
  isSaved: boolean;
  originalPostId: string;
  place: { id: string; name: string; slug: string };
  reactionCount: number;
  sources: HomeFeedSource[];
  topic: TopicContract;
  viewerHasReacted: boolean;
}

export interface HomeFeedPageContract {
  items: HomeFeedItemContract[];
  nextCursor?: string;
}