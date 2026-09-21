import type { Metadata } from "next";
import { AuthPage } from "@/features/auth/auth-page";
import { OidcCallbackPanel } from "@/features/auth/identity-panels";

export const metadata: Metadata = { title: "Completing sign in" };
export default function AuthCallbackPage() {
  return <AuthPage eyebrow="Identity provider" title="Completing sign in"><OidcCallbackPanel /></AuthPage>;
}