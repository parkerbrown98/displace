import type { Metadata } from "next";
import { AuthPage } from "@/features/auth/auth-page";
import { RegisterPanel } from "@/features/auth/identity-panels";

export const metadata: Metadata = { title: "Create account" };
export default function RegisterPage() {
  return <AuthPage eyebrow="Join Displace" title="Create account"><RegisterPanel /></AuthPage>;
}