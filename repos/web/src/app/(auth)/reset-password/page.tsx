import type { Metadata } from "next";
import { AuthPage } from "@/features/auth/auth-page";
import { ResetPasswordPanel } from "@/features/auth/identity-panels";

export const metadata: Metadata = { title: "Choose a new password" };
export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const query = await searchParams;
  const token = Array.isArray(query.token) ? query.token[0] : query.token;
  return <AuthPage eyebrow="Account recovery" title="Choose a new password"><ResetPasswordPanel token={token} /></AuthPage>;
}