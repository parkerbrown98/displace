import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell/public-shell";
import {
  getForumNavigation,
  getPublicPlace,
  listPublicTopics,
  PublicResourceError,
} from "@/features/public-content/public-data";
import { handlePublicResourceError } from "@/features/public-content/public-errors";
import { publicFeed, queryValue } from "@/features/public-content/public-query";
import { PlaceView, PublicUnavailableView } from "@/features/public-content/public-views";
import { createPublicMetadata, unavailableMetadata } from "@/lib/metadata";
import { routes } from "@/lib/routes";

export async function generateMetadata({ params }: PageProps<"/places/[placeSlug]">): Promise<Metadata> {
  const { placeSlug } = await params;
  try {
    const place = await getPublicPlace(placeSlug);
    return createPublicMetadata({ description: place.description, path: routes.place(place.slug), title: place.name });
  } catch (error) {
    if (error instanceof PublicResourceError && error.reason === "unavailable") return unavailableMetadata;
    handlePublicResourceError(error);
  }
}

export default async function PlacePage({ params, searchParams }: PageProps<"/places/[placeSlug]">) {
  const { placeSlug } = await params;
  const query = await searchParams;
  const feed = publicFeed(query.feed);
  const tag = queryValue(query.tag);
  const result = await loadPlace(placeSlug, queryValue(query.cursor), feed, tag);
  return (
    <PublicShell>
      {result ? <PlaceView feed={feed} navigation={result.navigation} place={result.place} tag={tag} topics={result.topics} /> : <PublicUnavailableView />}
    </PublicShell>
  );
}

async function loadPlace(placeSlug: string, cursor: string | undefined, feed: "following" | "latest" | "popular", tag: string | undefined) {
  try {
    const [place, navigation, topics] = await Promise.all([
      getPublicPlace(placeSlug),
      getForumNavigation(placeSlug),
      listPublicTopics(placeSlug, { cursor, feed, tag }),
    ]);
    return { navigation, place, topics };
  } catch (error) {
    if (error instanceof PublicResourceError && error.reason === "unavailable") {
      return undefined;
    }
    handlePublicResourceError(error);
  }
}