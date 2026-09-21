import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell/app-shell";
import { CreatePlacePanel } from "@/features/places/place-settings";

export const metadata: Metadata = { title: "Create a place", robots: { follow: false, index: false } };

export default function CreatePlacePage() {
  return <AppShell activeNavigation={null}><CreatePlacePanel /></AppShell>;
}