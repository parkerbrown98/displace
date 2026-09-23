import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell/public-shell";
import { PlaceSettingsLayout } from "@/features/places/place-settings";

export const metadata: Metadata = { title: "Place settings", robots: { follow: false, index: false } };

export default async function SettingsLayout({ children, params }: LayoutProps<"/places/[placeSlug]/settings">) {
  const { placeSlug } = await params;
  return <PublicShell><PlaceSettingsLayout placeId={placeSlug}>{children}</PlaceSettingsLayout></PublicShell>;
}