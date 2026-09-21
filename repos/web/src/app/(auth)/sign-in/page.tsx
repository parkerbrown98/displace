import type { Metadata } from "next";
import { AuthPage } from "@/features/auth/auth-page";
import { SignInPanel } from "@/features/auth/sign-in-panel";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const query = await searchParams;
  const returnTo = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  return <AuthPage eyebrow="Account" title="Sign in"><SignInPanel returnTo={returnTo} /></AuthPage>;
}