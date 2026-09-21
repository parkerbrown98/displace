import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicShell } from "@/components/public-shell/public-shell";
import { listPublicPlaces, PublicResourceError } from "@/features/public-content/public-data";
import { queryValue } from "@/features/public-content/public-query";
import { DiscoveryView, PublicUnavailableView } from "@/features/public-content/public-views";
import { createPublicMetadata, unavailableMetadata } from "@/lib/metadata";
import { routes } from "@/lib/routes";

export async function generateMetadata({ searchParams }: PageProps<"/discover">): Promise<Metadata> {
  const query = await searchParams;
  const page = await loadDiscovery({ cursor: queryValue(query.cursor) });
  return page ? createPublicMetadata({
    description: "Browse public places and find durable conversations on Displace.",
    path: routes.discover,
    title: "Discover communities",
  }) : unavailableMetadata;
}

export default async function DiscoverPage({ searchParams }: PageProps<"/discover">) {
  const configuredSlug = process.env.NEXT_PUBLIC_SINGLE_PLACE_SLUG;
  if (configuredSlug) redirect(routes.place(configuredSlug));
  const query = await searchParams;
  const joinPolicy = queryValue(query.join);
  const search = queryValue(query.q);
  const page = await loadDiscovery({ cursor: queryValue(query.cursor), joinPolicy, query: search });
  return <PublicShell>{page ? <DiscoveryView joinPolicy={joinPolicy} page={page} query={search} /> : <PublicUnavailableView />}</PublicShell>;
}

async function loadDiscovery(parameters: { cursor?: string; joinPolicy?: string; query?: string }) {
  try {
    return await listPublicPlaces(parameters);
  } catch (error) {
    if (error instanceof PublicResourceError && error.reason === "unavailable") {
      return undefined;
    }
    throw error;
  }
}