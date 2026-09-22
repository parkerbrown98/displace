import type { Metadata } from "next";
import { AdminDashboard } from "@/features/moderation/admin-dashboard";

export const metadata: Metadata = { title: "Administration", robots: { follow: false, index: false } };

export default function AdminPage() {
  return <AdminDashboard />;
}