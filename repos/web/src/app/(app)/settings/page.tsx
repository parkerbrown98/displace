import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell/app-shell";
import { AccountSettings } from "@/features/auth/account-settings";

export const metadata: Metadata = { title: "Settings", robots: { follow: false, index: false } };

export default function SettingsPage() {
  return <AppShell activeNavigation={null}><AccountSettings /></AppShell>;
}