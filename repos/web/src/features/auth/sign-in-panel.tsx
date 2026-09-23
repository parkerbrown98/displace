"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/ui/form-field";
import { toast } from "@/components/ui/toast";
import { routes } from "@/lib/routes";
import { oidcAuthorizeUrl } from "./auth-client";
import { authErrorMessage } from "./auth-error-message";
import { useSession } from "./session-provider";

export function SignInPanel({ returnTo = routes.home }: { returnTo?: string }) {
  const router = useRouter();
  const { signInAccount } = useSession();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      await signInAccount({
        identifier: String(form.get("identifier") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      router.replace(safeReturnTo(returnTo));
      router.refresh();
    } catch (cause) {
      toast.error(authErrorMessage(cause, "Sign-in failed. Check your details and try again."));
      setPending(false);
    }
  }

  return (
    <form className="auth-form" method="post" onSubmit={submit}>
      <FormField autoComplete="username" label="Email or handle" name="identifier" required />
      <FormField autoComplete="current-password" label="Password" name="password" type="password" required />
      <button className="primary-button" disabled={pending} type="submit">{pending ? "Signing in..." : "Sign in"}</button>
      <a className="secondary-button" href={oidcAuthorizeUrl()}>Continue with identity provider</a>
      <div className="auth-links">
        <Link href={routes.forgotPassword}>Forgot password?</Link>
        <Link href={routes.register}>Create account</Link>
      </div>
    </form>
  );
}

function safeReturnTo(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : routes.home;
}