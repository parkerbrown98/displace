import { Laptop, LogOut, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RouteState } from '../../components/route-state/route-state';
import { useConfirmation, useToast } from '../../components/ui/feedback-context';
import { authErrorMessage, type AccountSession } from './auth-client';
import { FormField } from './identity-routes';
import { useSession } from './session-provider';

export function AccountSettingsRoute() {
  const session = useSession();
  if (session.status === 'loading') return <RouteState state="loading" title="Loading account" />;
  if (session.status === 'unavailable') return <RouteState state="error" title="Account unavailable" />;
  if (!session.user) return <section className="settings-gate"><h2>Sign in required</h2><p>Sign in to manage your account and active sessions.</p><Link className="button primary" to="/sign-in?returnTo=%2Fsettings">Sign in</Link></section>;

  return <div className="account-settings">
    <header className="settings-heading"><span className="eyebrow">Account</span><h2>Settings</h2><p>Manage your identity, credentials, and signed-in devices.</p></header>
    <ProfileSettings />
    <EmailSettings />
    <PasswordSettings />
    <SessionSettings />
  </div>;
}

function ProfileSettings() {
  const { client, refreshProfile, user } = useSession();
  const notify = useToast();
  const [pending, setPending] = useState(false);
  if (!user) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      await client.updateProfile({ displayName: String(form.get('displayName') ?? ''), handle: String(form.get('handle') ?? '') });
      await refreshProfile();
      notify('Profile saved.');
    } catch (error) {
      notify(authErrorMessage(error, 'Profile could not be saved.'));
    } finally {
      setPending(false);
    }
  }

  return <SettingsSection eyebrow="Public identity" title="Profile"><form className="settings-form" onSubmit={submit}>
    <FormField defaultValue={user.displayName} label="Display name" maxLength={100} name="displayName" required />
    <FormField defaultValue={user.handle} hint="3-32 lowercase letters, numbers, or underscores." label="Handle" maxLength={32} minLength={3} name="handle" pattern="[a-z0-9_]{3,32}" required />
    <button className="button primary" disabled={pending} type="submit">{pending ? 'Saving...' : 'Save profile'}</button>
  </form></SettingsSection>;
}

function EmailSettings() {
  const { client, user } = useSession();
  const notify = useToast();
  const [pending, setPending] = useState(false);
  if (!user) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      await client.changeEmail(String(new FormData(event.currentTarget).get('email') ?? ''));
      notify('Verification email sent.');
    } catch (error) {
      notify(authErrorMessage(error, 'Email could not be changed.'));
    } finally {
      setPending(false);
    }
  }

  return <SettingsSection eyebrow="Contact" title="Email" action={<span className={`verification-state${user.emailVerified ? ' verified' : ''}`}><ShieldCheck aria-hidden="true" size={14} />{user.emailVerified ? 'Verified' : 'Pending'}</span>}><form className="settings-form" onSubmit={submit}>
    <FormField autoComplete="email" defaultValue={user.email} label="Email address" name="email" required type="email" />
    <button className="button primary" disabled={pending} type="submit">{pending ? 'Sending...' : 'Change email'}</button>
  </form></SettingsSection>;
}

function PasswordSettings() {
  const { client } = useSession();
  const notify = useToast();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      await client.changePassword(String(form.get('currentPassword') ?? ''), String(form.get('newPassword') ?? ''));
      event.currentTarget.reset();
      notify('Password changed.');
    } catch (error) {
      notify(authErrorMessage(error, 'Password could not be changed. Check your current password.'));
    } finally {
      setPending(false);
    }
  }

  return <SettingsSection eyebrow="Credentials" title="Password"><form className="settings-form" onSubmit={submit}>
    <FormField autoComplete="current-password" label="Current password" name="currentPassword" required type="password" />
    <FormField autoComplete="new-password" hint="Use at least 12 characters." label="New password" maxLength={256} minLength={12} name="newPassword" required type="password" />
    <button className="button primary" disabled={pending} type="submit">{pending ? 'Updating...' : 'Change password'}</button>
  </form></SettingsSection>;
}

function SessionSettings() {
  const { client, signOut } = useSession();
  const confirm = useConfirmation();
  const navigate = useNavigate();
  const notify = useToast();
  const [sessions, setSessions] = useState<AccountSession[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void client.listSessions().then((result) => { if (active) setSessions(result); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [client]);

  async function leave(all: boolean) {
    if (all && !await confirm({ title: 'Sign out everywhere?', message: 'Every active Displace session will need to sign in again.', confirmLabel: 'Sign out all' })) return;
    await signOut(all);
    navigate('/', { replace: true });
  }

  async function revoke(sessionId: string) {
    try {
      await client.revokeSession(sessionId);
      setSessions((items) => items?.filter((item) => item.id !== sessionId) ?? []);
      notify('Session revoked.');
    } catch (error) {
      notify(authErrorMessage(error, 'The session could not be revoked.'));
    }
  }

  return <SettingsSection eyebrow="Security" title="Active sessions" action={<button className="button danger" onClick={() => void leave(true)} type="button"><LogOut aria-hidden="true" size={16} /> Sign out all</button>}>
    {failed ? <p className="form-message error" role="alert">Sessions could not be loaded.</p> : null}
    {!failed && sessions === null ? <p className="form-message" role="status">Loading sessions...</p> : null}
    {sessions?.length === 0 ? <p className="form-message">No active sessions were returned.</p> : null}
    <div className="session-list">{sessions?.map((item) => <article className="session-row" key={item.id}>
      <Laptop aria-hidden="true" size={20} />
      <div><strong>{item.userAgent ?? 'Unknown device'}{item.current ? ' (current)' : ''}</strong><span>Last active {formatDate(item.lastSeenAt)}{item.ipAddress ? ` · ${item.ipAddress}` : ''}</span></div>
      {!item.current ? <button aria-label={`Revoke ${item.userAgent ?? 'session'}`} className="icon-button" onClick={() => void revoke(item.id)} title="Revoke session" type="button"><Trash2 aria-hidden="true" size={17} /></button> : null}
    </article>)}</div>
    <button className="button secondary" onClick={() => void leave(false)} type="button">Sign out on this device</button>
  </SettingsSection>;
}

function SettingsSection({ action, children, eyebrow, title }: { action?: ReactNode; children: ReactNode; eyebrow: string; title: string }) {
  return <section className="settings-section"><div className="settings-section-heading"><div><span className="eyebrow">{eyebrow}</span><h3>{title}</h3></div>{action}</div>{children}</section>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}