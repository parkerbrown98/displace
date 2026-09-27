import { TOPIC_FEEDS, type TopicFeed } from "@displace/api-client/domain-values";

export type PublicFeed = TopicFeed;

export function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function publicFeed(value: string | string[] | undefined): PublicFeed {
  const candidate = queryValue(value);
  return TOPIC_FEEDS.includes(candidate as PublicFeed) ? candidate as PublicFeed : "latest";
}