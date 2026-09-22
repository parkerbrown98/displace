import type { Metadata } from "next";
import { ModerationDashboard } from "@/features/moderation/moderation-dashboard";

export const metadata: Metadata = { title: "Moderation", robots: { follow: false, index: false } };

export default function ModerationPage() {
  return <ModerationDashboard />;
}