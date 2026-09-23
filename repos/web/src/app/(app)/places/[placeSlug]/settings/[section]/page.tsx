import { notFound } from "next/navigation";
import { PlaceSettingsSectionContent } from "@/features/places/place-settings";
import type { PlaceSettingsSection } from "@/lib/routes";

const sections: PlaceSettingsSection[] = ["archive", "chat", "forums", "identity", "preferences", "roles", "voice"];

export default async function PlaceSettingsSectionPage({ params }: PageProps<"/places/[placeSlug]/settings/[section]">) {
  const { section } = await params;
  if (!isPlaceSettingsSection(section)) notFound();
  return <PlaceSettingsSectionContent section={section} />;
}

function isPlaceSettingsSection(value: string): value is PlaceSettingsSection {
  return sections.includes(value as PlaceSettingsSection);
}