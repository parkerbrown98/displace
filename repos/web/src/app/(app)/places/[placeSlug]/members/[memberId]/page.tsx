import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell/app-shell";
import { createCommunityFixture } from "@/features/community/community-fixtures";
import { PlaceMemberProfile } from "@/features/places/place-members";

export const metadata: Metadata = { title: "Member profile", robots: { follow: false, index: false } };

export default async function PlaceMemberPage({ params }: { params: Promise<{ memberId: string; placeSlug: string }> }) {
  const { memberId, placeSlug } = await params;
  return <AppShell activeNavigation={null} fixture={createCommunityFixture()}><PlaceMemberProfile memberId={memberId} placeId={placeSlug} /></AppShell>;
}