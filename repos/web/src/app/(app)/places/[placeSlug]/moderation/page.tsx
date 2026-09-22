import type { Metadata } from "next";
import { ModerationDashboard } from "@/features/moderation/moderation-dashboard";

export const metadata: Metadata = { title: "Place moderation", robots: { follow: false, index: false } };

export default async function PlaceModerationPage({ params }: { params: Promise<{ placeSlug: string }> }) {
  const { placeSlug } = await params;
  return <ModerationDashboard initialPlaceSlug={placeSlug} />;
}