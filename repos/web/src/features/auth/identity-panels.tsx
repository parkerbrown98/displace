"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { FormField } from "@/components/ui/form-field";
import { routes } from "@/lib/routes";
import { forgotPassword, registerAccount, resetPassword, verifyEmail } from "./auth-client";
import { authErrorMessage } from "./auth-error-message";
import { useSession } from "./session-provider";

export function RegisterPanel() {
  const [state, setState] = useState<"editing" | "pending" | "sent">("editing");
  const [error, setError] = useState<string>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState("pending"); setError(undefined);
    try {
      await registerAccount({
        displayName: String(form.get("displayName") ?? ""), email: String(form.get("email") ?? ""),
        handle: String(form.get("handle") ?? ""), password: String(form.get("password") ?? ""),
      });
      setState("sent");
    } catch (cause) { setError(authErrorMessage(cause, "Registration could not be completed. Review the form and try again.")); setState("editing"); }
  }
  if (state === "sent") return <AuthSuccess title="Check your email">If registration can proceed, a verification message has been sent.</AuthSuccess>;
  return <form className="auth-form" method="post" onSubmit={submit}>
    <FormField autoComplete="name" label="Display name" maxLength={100} name="displayName" required />
    <FormField autoComplete="username" hint="3-32 lowercase letters, numbers, or underscores." label="Handle" minLength={3} maxLength={32} name="handle" pattern="[a-z0-9_]{3,32}" required />
    <FormField autoComplete="email" label="Email" maxLength={320} name="email" type="email" required />
    <FormField autoComplete="new-password" hint="Use at least 12 characters." label="Password" minLength={12} maxLength={256} name="password" type="password" required />
    <FormMessage error={error} />
    <button className="primary-button" disabled={state === "pending"} type="submit">{state === "pending" ? "Creating..." : "Create account"}</button>
    <p className="auth-switch">Already registered? <Link href={routes.signIn}>Sign in</Link></p>
  </form>;
}

export function ForgotPasswordPanel() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(undefined);
    const form = new FormData(event.currentTarget);
    try { await forgotPassword(String(form.get("email") ?? "")); setSent(true); }
    catch (cause) { setError(authErrorMessage(cause, "The request could not be sent. Try again.")); }
    finally { setPending(false); }
  }
  if (sent) return <AuthSuccess title="Check your email">If the account exists, a password reset message has been sent.</AuthSuccess>;
  return <form className="auth-form" method="post" onSubmit={submit}>
    <p className="auth-intro">Enter your account email to request a reset link.</p>
    <FormField autoComplete="email" label="Email" name="email" type="email" required />
    <FormMessage error={error} />
    <button className="primary-button" disabled={pending} type="submit">{pending ? "Sending..." : "Send reset link"}</button>
    <p className="auth-switch"><Link href={routes.signIn}>Return to sign in</Link></p>
  </form>;
}

export function ResetPasswordPanel({ token }: { token?: string }) {
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) { setError("This reset link is incomplete or expired."); return; }
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirmation") ?? "")) { setError("Passwords do not match."); return; }
    setPending(true); setError(undefined);
    try { await resetPassword(token, password); setComplete(true); }
    catch (cause) { setError(authErrorMessage(cause, "This reset link is invalid or expired.")); setPending(false); }
  }
  if (complete) return <AuthSuccess title="Password updated">Your password has been changed. <Link href={routes.signIn}>Sign in</Link>.</AuthSuccess>;
  return <form className="auth-form" method="post" onSubmit={submit}>
    <FormField autoComplete="new-password" hint="Use at least 12 characters." label="New password" minLength={12} maxLength={256} name="password" type="password" required />
    <FormField autoComplete="new-password" label="Confirm password" minLength={12} maxLength={256} name="confirmation" type="password" required />
    <FormMessage error={error} />
    <button className="primary-button" disabled={pending || !token} type="submit">{pending ? "Updating..." : "Update password"}</button>
  </form>;
}

export function VerifyEmailPanel({ token }: { token?: string }) {
  const [state, setState] = useState<"invalid" | "pending" | "success">(token ? "pending" : "invalid");
  useEffect(() => {
    if (!token) return;
    let active = true;
    void verifyEmail(token).then(() => { if (active) setState("success"); }).catch(() => { if (active) setState("invalid"); });
    return () => { active = false; };
  }, [token]);
  if (state === "pending") return <p className="form-message" role="status">Verifying your email...</p>;
  if (state === "success") return <AuthSuccess title="Email verified">Your account is ready. <Link href={routes.signIn}>Sign in</Link>.</AuthSuccess>;
  return <p className="form-message form-message-error" role="alert">This verification link is invalid or expired.</p>;
}

export function OidcCallbackPanel() {
  const router = useRouter();
  const { status } = useSession();
  useEffect(() => {
    if (status === "authenticated") router.replace(routes.home);
  }, [router, status]);
  if (status === "loading" || status === "authenticated") {
    return <p className="form-message" role="status">Completing sign in...</p>;
  }
  return <div className="auth-form"><p className="form-message form-message-error" role="alert">Sign-in could not be completed. The response may have expired.</p><Link className="primary-button" href={routes.signIn}>Return to sign in</Link></div>;
}

export function SessionExpiredPanel() {
  return <div className="auth-form"><p className="auth-intro">Your session ended. Sign in again to continue without losing your destination.</p><Link className="primary-button" href={`${routes.signIn}?returnTo=${encodeURIComponent(routes.accountSettingsSection("sessions"))}`}>Sign in again</Link></div>;
}

function AuthSuccess({ children, title }: { children: React.ReactNode; title: string }) {
  return <div className="auth-success" role="status"><strong>{title}</strong><p>{children}</p></div>;
}

function FormMessage({ error }: { error?: string }) {
  return error ? <p className="form-message form-message-error" role="alert">{error}</p> : null;
}