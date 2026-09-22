import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell/public-shell";
import { VoiceExperience } from "@/features/voice/voice-experience";

export const metadata: Metadata = { title: "Voice", robots: { follow: false, index: false } };

export default async function VoicePage({ params }: PageProps<"/places/[placeSlug]/voice">) {
  const { placeSlug } = await params;
  return <PublicShell><VoiceExperience placeSlug={placeSlug} /></PublicShell>;
}