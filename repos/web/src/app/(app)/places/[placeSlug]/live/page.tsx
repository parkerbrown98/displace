import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell/public-shell";
import { LiveExperience } from "@/features/chat/chat-channel";

export const metadata: Metadata = { title: "Live", robots: { follow: false, index: false } };

export default async function LivePage({ params }: { params: Promise<{ placeSlug: string }> }) {
  const { placeSlug } = await params;
  return <PublicShell><LiveExperience placeSlug={placeSlug} /></PublicShell>;
}
