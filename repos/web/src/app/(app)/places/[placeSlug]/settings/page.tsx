import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell/public-shell";
import { PlaceSettings } from "@/features/places/place-settings";

export const metadata: Metadata = { title: "Place settings", robots: { follow: false, index: false } };

export default async function PlaceSettingsPage({ params }: { params: Promise<{ placeSlug: string }> }) {
  const { placeSlug } = await params;
  return <PublicShell><PlaceSettings placeId={placeSlug} /></PublicShell>;
}