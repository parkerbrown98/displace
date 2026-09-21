import type { Metadata } from "next";
import Link from "next/link";
import { SignInPanel } from "@/features/auth/sign-in-panel";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="auth-page" id="main-content">
      <Link className="brand" href={routes.home} aria-label="Displace home">
        <span className="brand-mark">D</span>
        <span>Displace</span>
      </Link>
      <section className="auth-panel">
        <p className="eyebrow">Account</p>
        <h1>Sign in</h1>
        <SignInPanel />
      </section>
    </main>
  );
}