import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell/public-shell";
import { DiscoveryView } from "@/features/public-content/search-results-view";
import { getPublicPlace, listPublicPlaces, PublicResourceError, searchPublicContent } from "@/features/public-content/public-data";
import { queryValue } from "@/features/public-content/public-query";
import { createPublicMetadata } from "@/lib/metadata";
import { routes } from "@/lib/routes";

export const metadata: Metadata = createPublicMetadata({
  description: "Search public communities and conversations on Displace.",
  path: routes.discover,
  title: "Discover",
});

export default async function DiscoverPage({ searchParams }: PageProps<"/discover">) {
  const parameters = await searchParams;
  const joinPolicy = queryValue(parameters.join);
  const query = queryValue(parameters.q)?.trim();
  const type = searchType(queryValue(parameters.type));
  const placeId = queryValue(parameters.placeId) || undefined;
  const tag = discoveryTag(queryValue(parameters.tag));
  const hasQuery = Boolean(query && query.length >= 2);
  const selectedPlacePromise = placeId ? loadSelectedPlace(placeId) : Promise.resolve(undefined);

  if (hasQuery) {
    const [selectedPlace, result] = await Promise.all([
      selectedPlacePromise,
      loadSearch({ cursor: queryValue(parameters.cursor), placeId, query: query!, type }),
    ]);
    return <PublicShell><DiscoveryView placeId={placeId} query={query} selectedPlace={selectedPlace} type={type} {...result} /></PublicShell>;
  }

  const [selectedPlace, places] = await Promise.all([
    selectedPlacePromise,
    loadDiscovery({ cursor: queryValue(parameters.cursor), joinPolicy, tag }),
  ]);
  return <PublicShell><DiscoveryView joinPolicy={joinPolicy} placeId={placeId} places={places} query={query} selectedPlace={selectedPlace} tag={tag} type={type} /></PublicShell>;
}

function searchType(value?: string): "place" | "post" | "topic" | undefined {
  return value === "place" || value === "post" || value === "topic" ? value : undefined;
}

function discoveryTag(value?: string): string | undefined {
  return value && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ? value : undefined;
}

async function loadDiscovery(parameters: { cursor?: string; joinPolicy?: string; tag?: string }) {
  try {
    return await listPublicPlaces(parameters);
  } catch (error) {
    if (error instanceof PublicResourceError && error.reason === "unavailable") {
      return undefined;
    }
    throw error;
  }
}

async function loadSearch(parameters: { cursor?: string; placeId?: string; query: string; type?: "place" | "post" | "topic" }) {
  try {
    return { page: await searchPublicContent(parameters) };
  } catch (error) {
    if (error instanceof PublicResourceError) return { unavailable: true };
    throw error;
  }
}

async function loadSelectedPlace(placeId: string) {
  try {
    return await getPublicPlace(placeId);
  } catch (error) {
    if (error instanceof PublicResourceError) return undefined;
    throw error;
  }
}