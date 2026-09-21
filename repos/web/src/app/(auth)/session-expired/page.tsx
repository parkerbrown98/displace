import type { Metadata } from "next";
import { AuthPage } from "@/features/auth/auth-page";
import { SessionExpiredPanel } from "@/features/auth/identity-panels";

export const metadata: Metadata = { title: "Session expired" };
export default function SessionExpiredPage() {
  return <AuthPage eyebrow="Account" title="Session expired"><SessionExpiredPanel /></AuthPage>;
}