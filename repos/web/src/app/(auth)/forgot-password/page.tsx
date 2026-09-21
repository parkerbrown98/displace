import type { Metadata } from "next";
import { AuthPage } from "@/features/auth/auth-page";
import { ForgotPasswordPanel } from "@/features/auth/identity-panels";

export const metadata: Metadata = { title: "Reset your password" };
export default function ForgotPasswordPage() {
  return <AuthPage eyebrow="Account recovery" title="Reset your password"><ForgotPasswordPanel /></AuthPage>;
}