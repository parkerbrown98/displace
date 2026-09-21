import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell/public-shell";
import { PlaceMemberProfile } from "@/features/places/place-members";

export const metadata: Metadata = { title: "Member profile", robots: { follow: false, index: false } };

export default async function PlaceMemberPage({ params }: { params: Promise<{ memberId: string; placeSlug: string }> }) {
  const { memberId, placeSlug } = await params;
  return <PublicShell><PlaceMemberProfile memberId={memberId} placeId={placeSlug} /></PublicShell>;
}