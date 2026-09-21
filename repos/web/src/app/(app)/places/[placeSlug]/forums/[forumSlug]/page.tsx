import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public-shell/public-shell";
import {
  getForumNavigation,
  getPublicPlace,
  listPublicTopics,
  PublicResourceError,
} from "@/features/public-content/public-data";
import { handlePublicResourceError } from "@/features/public-content/public-errors";
import { publicFeed, queryValue } from "@/features/public-content/public-query";
import { findForum, ForumView, PublicUnavailableView } from "@/features/public-content/public-views";
import { createPublicMetadata, unavailableMetadata } from "@/lib/metadata";
import { routes } from "@/lib/routes";

export async function generateMetadata({ params }: PageProps<"/places/[placeSlug]/forums/[forumSlug]">): Promise<Metadata> {
  const { forumSlug, placeSlug } = await params;
  try {
    const [place, navigation] = await Promise.all([getPublicPlace(placeSlug), getForumNavigation(placeSlug)]);
    const forum = findForum(navigation, forumSlug);
    if (!forum) notFound();
    return createPublicMetadata({
      description: forum.description,
      path: routes.forum(place.slug, forum.id),
      title: `${forum.name} - ${place.name}`,
    });
  } catch (error) {
    if (error instanceof PublicResourceError && error.reason === "unavailable") return unavailableMetadata;
    handlePublicResourceError(error);
  }
}

export default async function ForumPage({ params, searchParams }: PageProps<"/places/[placeSlug]/forums/[forumSlug]">) {
  const { forumSlug, placeSlug } = await params;
  const query = await searchParams;
  const feed = publicFeed(query.feed);
  const result = await loadForum(placeSlug, forumSlug, queryValue(query.cursor), feed);
  return (
    <PublicShell>
      {result ? <ForumView feed={feed} forum={result.forum} place={result.place} topics={result.topics} /> : <PublicUnavailableView />}
    </PublicShell>
  );
}

async function loadForum(placeSlug: string, forumId: string, cursor: string | undefined, feed: "following" | "latest" | "popular") {
  try {
    const [place, navigation, topics] = await Promise.all([
      getPublicPlace(placeSlug),
      getForumNavigation(placeSlug),
      listPublicTopics(placeSlug, { cursor, feed, forumId }),
    ]);
    const forum = findForum(navigation, forumId);
    if (!forum) notFound();
    return { forum, place, topics };
  } catch (error) {
    if (error instanceof PublicResourceError && error.reason === "unavailable") {
      return undefined;
    }
    handlePublicResourceError(error);
  }
}