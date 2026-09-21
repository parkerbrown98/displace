import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell/app-shell";
import { PlaceSettings } from "@/features/places/place-settings";

export const metadata: Metadata = { title: "Place settings", robots: { follow: false, index: false } };

export default async function PlaceSettingsPage({ params }: { params: Promise<{ placeSlug: string }> }) {
  const { placeSlug } = await params;
  return <AppShell activeNavigation={null} activePlaceSlug={placeSlug}><PlaceSettings placeId={placeSlug} /></AppShell>;
}