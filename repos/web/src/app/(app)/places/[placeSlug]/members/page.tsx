import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell/app-shell";
import { createCommunityFixture } from "@/features/community/community-fixtures";
import { PlaceMembers } from "@/features/places/place-members";

export const metadata: Metadata = { title: "Place members", robots: { follow: false, index: false } };

export default async function PlaceMembersPage({ params }: { params: Promise<{ placeSlug: string }> }) {
  const { placeSlug } = await params;
  return <AppShell activeNavigation={null} fixture={createCommunityFixture()}><PlaceMembers placeId={placeSlug} /></AppShell>;
}