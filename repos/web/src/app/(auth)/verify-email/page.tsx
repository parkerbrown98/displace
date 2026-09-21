import type { Metadata } from "next";
import { AuthPage } from "@/features/auth/auth-page";
import { VerifyEmailPanel } from "@/features/auth/identity-panels";

export const metadata: Metadata = { title: "Verify email" };
export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const query = await searchParams;
  const token = Array.isArray(query.token) ? query.token[0] : query.token;
  return <AuthPage eyebrow="Account" title="Verify email"><VerifyEmailPanel token={token} /></AuthPage>;
}