import { createContext, startTransition, use, useEffect, useState, type ReactNode } from 'react';
import { NativeAuthClient, type SignInInput, type UserProfile } from './auth-client';

export type SessionStatus = 'anonymous' | 'authenticated' | 'loading' | 'unavailable';

interface SessionContextValue {
  beginOidcSignIn(): Promise<void>;
  client: NativeAuthClient;
  oidcError: string | null;
  refreshProfile(): Promise<void>;
  signIn(input: SignInInput, persist?: boolean): Promise<void>;
  signOut(all?: boolean): Promise<void>;
  status: SessionStatus;
  sessionExpired: boolean;
  user: UserProfile | null;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children, client }: { children: ReactNode; client: NativeAuthClient }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [oidcError, setOidcError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => client.onSessionInvalidated(() => {
    setUser(null);
    setStatus('anonymous');
    setSessionExpired(true);
  }), [client]);

  useEffect(() => {
    let active = true;
    void client.initialize().then((authentication) => {
      if (!active) return;
      startTransition(() => {
        setUser(authentication?.user ?? null);
        setStatus(authentication ? 'authenticated' : 'anonymous');
      });
    }).catch(() => {
      if (active) setStatus('unavailable');
    });
    return () => { active = false; };
  }, [client]);

  useEffect(() => {
    let active = true;
    let stopListening: (() => void) | undefined;
    void client.listenForOidcCallbacks((callbackUrl) => {
      if (!active) return;
      setOidcError(null);
      void client.completeOidcSignIn(callbackUrl).then((authentication) => {
        if (!active) return;
        setSessionExpired(false);
        setUser(authentication.user);
        setStatus('authenticated');
      }).catch(() => {
        if (active) setOidcError('The sign-in response is invalid or expired.');
      });
    }).then((unlisten) => {
      if (active) stopListening = unlisten;
      else unlisten();
    });
    return () => {
      active = false;
      stopListening?.();
    };
  }, [client]);

  async function beginOidcSignIn(): Promise<void> {
    setOidcError(null);
    try {
      await client.beginOidcSignIn();
    } catch (error) {
      setOidcError('External sign-in could not be started.');
      throw error;
    }
  }

  async function signIn(input: SignInInput, persist = true): Promise<void> {
    const authentication = await client.signIn(input, persist);
    setSessionExpired(false);
    setUser(authentication.user);
    setStatus('authenticated');
  }

  async function signOut(all = false): Promise<void> {
    await client.signOut(all);
    setSessionExpired(false);
    setUser(null);
    setStatus('anonymous');
  }

  async function refreshProfile(): Promise<void> {
    const profile = await client.getCurrentProfile();
    setUser(profile);
    setStatus('authenticated');
  }

  return (
    <SessionContext value={{ beginOidcSignIn, client, oidcError, refreshProfile, sessionExpired, signIn, signOut, status, user }}>
      {children}
    </SessionContext>
  );
}

export function useSession(): SessionContextValue {
  const context = use(SessionContext);
  if (!context) throw new Error('useSession must be used within SessionProvider.');
  return context;
}