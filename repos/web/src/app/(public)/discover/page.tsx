import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell/public-shell";
import { listPublicPlaces, PublicResourceError } from "@/features/public-content/public-data";
import { queryValue } from "@/features/public-content/public-query";
import { DiscoveryView, PublicUnavailableView } from "@/features/public-content/public-views";
import { createPublicMetadata, unavailableMetadata } from "@/lib/metadata";
import { routes } from "@/lib/routes";

export async function generateMetadata({ searchParams }: PageProps<"/discover">): Promise<Metadata> {
  const query = await searchParams;
  const page = await loadDiscovery(queryValue(query.cursor));
  return page ? createPublicMetadata({
    description: "Browse public places and find durable conversations on Displace.",
    path: routes.discover,
    title: "Discover communities",
  }) : unavailableMetadata;
}

export default async function DiscoverPage({ searchParams }: PageProps<"/discover">) {
  const query = await searchParams;
  const page = await loadDiscovery(queryValue(query.cursor));
  return <PublicShell>{page ? <DiscoveryView page={page} /> : <PublicUnavailableView />}</PublicShell>;
}

async function loadDiscovery(cursor?: string) {
  try {
    return await listPublicPlaces(cursor);
  } catch (error) {
    if (error instanceof PublicResourceError && error.reason === "unavailable") {
      return undefined;
    }
    throw error;
  }
}