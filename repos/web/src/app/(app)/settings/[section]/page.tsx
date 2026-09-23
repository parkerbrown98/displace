import { notFound } from "next/navigation";
import { AccountSettingsSectionContent } from "@/features/auth/account-settings";
import type { AccountSettingsSection } from "@/lib/routes";

const sections: AccountSettingsSection[] = ["email", "password", "profile", "profile-image", "sessions"];

export default async function AccountSettingsSectionPage({ params }: PageProps<"/settings/[section]">) {
  const { section } = await params;
  if (!isAccountSettingsSection(section)) notFound();
  return <AccountSettingsSectionContent section={section} />;
}

function isAccountSettingsSection(value: string): value is AccountSettingsSection {
  return sections.includes(value as AccountSettingsSection);
}