import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell/app-shell";
import { AccountSettingsLayout } from "@/features/auth/account-settings";

export const metadata: Metadata = { title: "Settings", robots: { follow: false, index: false } };

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return <AppShell activeNavigation={null}><AccountSettingsLayout>{children}</AccountSettingsLayout></AppShell>;
}