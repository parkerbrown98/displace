import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell/public-shell";
import { SearchResultsView } from "@/features/public-content/search-results-view";
import { PublicResourceError, searchPublicContent } from "@/features/public-content/public-data";
import { queryValue } from "@/features/public-content/public-query";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const parameters = await searchParams;
  const query = queryValue(parameters.q)?.trim();
  const type = searchType(queryValue(parameters.type));
  const placeId = queryValue(parameters.placeId);
  const result = query && query.length >= 2 ? await loadSearch({
    cursor: queryValue(parameters.cursor),
    placeId,
    query,
    type,
  }) : undefined;

  return <PublicShell><SearchResultsView placeId={placeId} query={query} type={type} {...result} /></PublicShell>;
}

function searchType(value?: string): "place" | "post" | "topic" | undefined {
  return value === "place" || value === "post" || value === "topic" ? value : undefined;
}

async function loadSearch(parameters: { cursor?: string; placeId?: string; query: string; type?: "place" | "post" | "topic" }) {
  try {
    return { page: await searchPublicContent(parameters) };
  } catch (error) {
    if (error instanceof PublicResourceError) return { unavailable: true };
    throw error;
  }
}