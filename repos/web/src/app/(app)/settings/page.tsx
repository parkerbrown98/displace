import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell/app-shell";
import { AccountSettings } from "@/features/auth/account-settings";
import { createCommunityFixture } from "@/features/community/community-fixtures";

export const metadata: Metadata = { title: "Settings", robots: { follow: false, index: false } };

export default function SettingsPage() {
  return <AppShell activeNavigation={null} fixture={createCommunityFixture()}><AccountSettings /></AppShell>;
}