import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell/public-shell";
import { PlaceMembers } from "@/features/places/place-members";

export const metadata: Metadata = { title: "Place members", robots: { follow: false, index: false } };

export default async function PlaceMembersPage({ params }: { params: Promise<{ placeSlug: string }> }) {
  const { placeSlug } = await params;
  return <PublicShell><PlaceMembers placeId={placeSlug} /></PublicShell>;
}