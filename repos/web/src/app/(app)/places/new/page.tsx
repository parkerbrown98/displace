import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell/public-shell";
import { CreatePlacePanel } from "@/features/places/place-settings";

export const metadata: Metadata = { title: "Create a place", robots: { follow: false, index: false } };

export default function CreatePlacePage() {
  return <PublicShell><CreatePlacePanel /></PublicShell>;
}