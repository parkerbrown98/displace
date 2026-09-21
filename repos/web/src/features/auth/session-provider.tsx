"use client";

import { createContext, startTransition, use, useEffect, useState, type ReactNode } from "react";
import type { SignInInput, UserProfile } from "./auth-contracts";
import { getCurrentProfile, refreshAuthentication, signIn, signOut } from "./auth-client";

type SessionStatus = "anonymous" | "authenticated" | "loading" | "unavailable";

interface SessionContextValue {
  refreshProfile: () => Promise<void>;
  signInAccount: (input: SignInInput) => Promise<void>;
  signOutAccount: (all?: boolean) => Promise<void>;
  status: SessionStatus;
  user: UserProfile | null;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    let active = true;
    void refreshAuthentication().then((result) => {
      if (!active) return;
      startTransition(() => {
        setUser(result?.user ?? null);
        setStatus(result ? "authenticated" : "anonymous");
      });
    }).catch(() => {
      if (active) setStatus("unavailable");
    });
    return () => { active = false; };
  }, []);

  async function signInAccount(input: SignInInput): Promise<void> {
    const result = await signIn(input);
    setUser(result.user);
    setStatus("authenticated");
  }

  async function signOutAccount(all = false): Promise<void> {
    await signOut(all);
    setUser(null);
    setStatus("anonymous");
  }

  async function refreshProfile(): Promise<void> {
    const profile = await getCurrentProfile();
    setUser(profile);
    setStatus("authenticated");
  }

  return (
    <SessionContext value={{ refreshProfile, signInAccount, signOutAccount, status, user }}>
      {children}
    </SessionContext>
  );
}

export function useSession(): SessionContextValue {
  const context = use(SessionContext);
  if (!context) throw new Error("useSession must be used within SessionProvider.");
  return context;
}