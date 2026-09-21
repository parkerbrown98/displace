import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell/public-shell";
import {
  getForumNavigation,
  getPublicPlace,
  getPublicTopic,
  listPublicPosts,
  PublicResourceError,
} from "@/features/public-content/public-data";
import { handlePublicResourceError } from "@/features/public-content/public-errors";
import { queryValue } from "@/features/public-content/public-query";
import { findForum, PublicUnavailableView, TopicView } from "@/features/public-content/public-views";
import { createPublicMetadata, unavailableMetadata } from "@/lib/metadata";
import { routes } from "@/lib/routes";

export async function generateMetadata({ params }: PageProps<"/places/[placeSlug]/topics/[topicSlug]">): Promise<Metadata> {
  const { placeSlug, topicSlug } = await params;
  try {
    const [place, topic] = await Promise.all([getPublicPlace(placeSlug), getPublicTopic(placeSlug, topicSlug)]);
    return createPublicMetadata({
      description: `Read ${topic.title} in ${place.name} on Displace.`,
      path: routes.topic(place.slug, topic.id),
      title: topic.title,
    });
  } catch (error) {
    if (error instanceof PublicResourceError && error.reason === "unavailable") return unavailableMetadata;
    handlePublicResourceError(error);
  }
}

export default async function TopicPage({ params, searchParams }: PageProps<"/places/[placeSlug]/topics/[topicSlug]">) {
  const { placeSlug, topicSlug } = await params;
  const query = await searchParams;
  const cursor = queryValue(query.cursor);
  const result = await loadTopic(placeSlug, topicSlug, cursor);
  return (
    <PublicShell>
      {result ? (
        <TopicView cursor={cursor} forum={findForum(result.navigation, result.topic.forumId)} place={result.place} posts={result.posts} topic={result.topic} />
      ) : <PublicUnavailableView />}
    </PublicShell>
  );
}

async function loadTopic(placeSlug: string, topicId: string, cursor?: string) {
  try {
    const [place, navigation, topic, posts] = await Promise.all([
      getPublicPlace(placeSlug),
      getForumNavigation(placeSlug),
      getPublicTopic(placeSlug, topicId),
      listPublicPosts(placeSlug, topicId, cursor),
    ]);
    return { navigation, place, posts, topic };
  } catch (error) {
    if (error instanceof PublicResourceError && error.reason === "unavailable") {
      return undefined;
    }
    handlePublicResourceError(error);
  }
}