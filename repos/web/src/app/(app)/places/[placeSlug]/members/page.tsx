import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell/app-shell";
import { PlaceMembers } from "@/features/places/place-members";

export const metadata: Metadata = { title: "Place members", robots: { follow: false, index: false } };

export default async function PlaceMembersPage({ params }: { params: Promise<{ placeSlug: string }> }) {
  const { placeSlug } = await params;
  return <AppShell activeNavigation={null} activePlaceSlug={placeSlug}><PlaceMembers placeId={placeSlug} /></AppShell>;
}