import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell/app-shell";
import { PlaceMemberProfile } from "@/features/places/place-members";

export const metadata: Metadata = { title: "Member profile", robots: { follow: false, index: false } };

export default async function PlaceMemberPage({ params }: { params: Promise<{ memberId: string; placeSlug: string }> }) {
  const { memberId, placeSlug } = await params;
  return <AppShell activeNavigation={null} activePlaceSlug={placeSlug}><PlaceMemberProfile memberId={memberId} placeId={placeSlug} /></AppShell>;
}