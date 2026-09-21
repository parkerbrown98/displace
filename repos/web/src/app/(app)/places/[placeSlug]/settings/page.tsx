import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell/app-shell";
import { createCommunityFixture } from "@/features/community/community-fixtures";
import { PlaceSettings } from "@/features/places/place-settings";

export const metadata: Metadata = { title: "Place settings", robots: { follow: false, index: false } };

export default async function PlaceSettingsPage({ params }: { params: Promise<{ placeSlug: string }> }) {
  const { placeSlug } = await params;
  return <AppShell activeNavigation={null} fixture={createCommunityFixture()}><PlaceSettings placeId={placeSlug} /></AppShell>;
}