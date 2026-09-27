import type { components } from '@displace/api-client';

export type HomeFeedSort = "best" | "hot" | "new" | "top";
export type HomeFeedItemContract = components['schemas']['FeedItemDto'];
export type HomeFeedSource = HomeFeedItemContract['sources'][number];
export type HomeFeedPageContract = components['schemas']['FeedPageDto'];