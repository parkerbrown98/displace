import type { components, HomeFeedSort } from '@displace/api-client';

export type { HomeFeedSort };
export type HomeFeedItemContract = components['schemas']['FeedItemDto'];
export type HomeFeedSource = HomeFeedItemContract['sources'][number];
export type HomeFeedPageContract = components['schemas']['FeedPageDto'];