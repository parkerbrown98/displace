import { ArrowLeft, KeyRound, LogIn, UserPlus } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Checkbox } from '../../components/ui/checkbox';
import { useToast } from '../../components/ui/feedback-context';
import { authErrorMessage } from './auth-client';
import { useSession } from './session-provider';

export function SignInRoute() {
  const { beginOidcSignIn, oidcError, signIn, status } = useSession();
  const navigate = useNavigate();
  const notify = useToast();
  const [search] = useSearchParams();
  const [pending, setPending] = useState(false);

  if (status === 'authenticated') return <Navigate replace to={safeReturnTo(search.get('returnTo'))} />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      await signIn({
        identifier: String(form.get('identifier') ?? ''),
        password: String(form.get('password') ?? ''),
      }, form.get('persist') === 'on');
      navigate(safeReturnTo(search.get('returnTo')), { replace: true });
    } catch (error) {
      notify(authErrorMessage(error, 'Sign-in could not be completed. Check your details and try again.'));
      setPending(false);
    }
  }

  return (
    <AuthFrame icon={<LogIn aria-hidden="true" />} title="Sign in" description="Continue to your places and conversations.">
      <form className="auth-form" onSubmit={submit}>
        <FormField autoComplete="username" label="Email or handle" name="identifier" required />
        <FormField autoComplete="current-password" label="Password" name="password" required type="password" />
        <Checkbox defaultChecked name="persist" value="on">Keep me signed in on this device</Checkbox>
        <button className="button primary" disabled={pending} type="submit">{pending ? 'Signing in...' : 'Sign in'}</button>
        <div className="auth-divider"><span>or</span></div>
        <button className="button secondary" onClick={() => void beginOidcSignIn().catch(() => undefined)} type="button">Continue with identity provider</button>
        {oidcError ? <p className="form-message error" role="alert">{oidcError}</p> : null}
        <div className="auth-links"><Link to="/forgot-password">Forgot password?</Link><Link to="/register">Create an account</Link></div>
      </form>
    </AuthFrame>
  );
}

export function RegisterRoute() {
  const { client } = useSession();
  const notify = useToast();
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      await client.register({
        displayName: String(form.get('displayName') ?? ''),
        email: String(form.get('email') ?? ''),
        handle: String(form.get('handle') ?? ''),
        password: String(form.get('password') ?? ''),
      });
      setSent(true);
    } catch (error) {
      notify(authErrorMessage(error, 'Registration could not be completed. Review the form and try again.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame icon={<UserPlus aria-hidden="true" />} title={sent ? 'Check your email' : 'Create account'} description={sent ? 'If registration can proceed, a verification message has been sent.' : 'Choose the identity you will use across Displace.'}>
      {sent ? <Link className="button primary" to="/sign-in">Return to sign in</Link> : (
        <form className="auth-form" onSubmit={submit}>
          <FormField autoComplete="name" label="Display name" maxLength={100} name="displayName" required />
          <FormField autoComplete="username" hint="3-32 lowercase letters, numbers, or underscores." label="Handle" maxLength={32} minLength={3} name="handle" pattern="[a-z0-9_]{3,32}" required />
          <FormField autoComplete="email" label="Email" maxLength={320} name="email" required type="email" />
          <FormField autoComplete="new-password" hint="Use at least 12 characters." label="Password" maxLength={256} minLength={12} name="password" required type="password" />
          <button className="button primary" disabled={pending} type="submit">{pending ? 'Creating...' : 'Create account'}</button>
          <Link className="back-link" to="/sign-in"><ArrowLeft aria-hidden="true" size={15} /> Back to sign in</Link>
        </form>
      )}
    </AuthFrame>
  );
}

export function ForgotPasswordRoute() {
  const { client } = useSession();
  const notify = useToast();
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      await client.forgotPassword(String(new FormData(event.currentTarget).get('email') ?? ''));
      setSent(true);
    } catch (error) {
      notify(authErrorMessage(error, 'The request could not be sent. Try again.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame icon={<KeyRound aria-hidden="true" />} title="Reset password" description={sent ? 'If the account exists, a reset message has been sent.' : 'Enter your account email to request a reset link.'}>
      {!sent ? <form className="auth-form" onSubmit={submit}>
        <FormField autoComplete="email" label="Email" name="email" required type="email" />
        <button className="button primary" disabled={pending} type="submit">{pending ? 'Sending...' : 'Send reset link'}</button>
      </form> : null}
      <Link className="back-link" to="/sign-in"><ArrowLeft aria-hidden="true" size={15} /> Back to sign in</Link>
    </AuthFrame>
  );
}

export function ResetPasswordRoute() {
  const { client } = useSession();
  const notify = useToast();
  const [search] = useSearchParams();
  const [complete, setComplete] = useState(false);
  const [pending, setPending] = useState(false);
  const token = search.get('token');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    if (password !== String(form.get('confirmation') ?? '')) {
      notify('Passwords do not match.');
      return;
    }
    if (!token) return;
    setPending(true);
    try {
      await client.resetPassword(token, password);
      setComplete(true);
    } catch (error) {
      notify(authErrorMessage(error, 'This reset link is invalid or expired.'));
      setPending(false);
    }
  }

  return (
    <AuthFrame icon={<KeyRound aria-hidden="true" />} title={complete ? 'Password updated' : 'Choose a new password'} description={complete ? 'Your password has been changed.' : 'Use a unique password of at least 12 characters.'}>
      {complete ? <Link className="button primary" to="/sign-in">Sign in</Link> : <form className="auth-form" onSubmit={submit}>
        {!token ? <p className="form-message error" role="alert">This reset link is incomplete or expired.</p> : null}
        <FormField autoComplete="new-password" label="New password" maxLength={256} minLength={12} name="password" required type="password" />
        <FormField autoComplete="new-password" label="Confirm password" maxLength={256} minLength={12} name="confirmation" required type="password" />
        <button className="button primary" disabled={pending || !token} type="submit">{pending ? 'Updating...' : 'Update password'}</button>
      </form>}
    </AuthFrame>
  );
}

export function VerifyEmailRoute() {
  const { client } = useSession();
  const [search] = useSearchParams();
  const token = search.get('token');
  const [state, setState] = useState<'invalid' | 'pending' | 'success'>(token ? 'pending' : 'invalid');

  useEffect(() => {
    if (!token) return;
    let active = true;
    void client.verifyEmail(token).then(() => { if (active) setState('success'); }).catch(() => { if (active) setState('invalid'); });
    return () => { active = false; };
  }, [client, token]);

  return <AuthFrame icon={<UserPlus aria-hidden="true" />} title="Email verification" description={state === 'success' ? 'Your account is ready.' : 'Confirming your email address.'}>
    {state === 'pending' ? <p className="form-message" role="status">Verifying your email...</p> : null}
    {state === 'invalid' ? <p className="form-message error" role="alert">This verification link is invalid or expired.</p> : null}
    {state !== 'pending' ? <Link className="button primary" to="/sign-in">Continue to sign in</Link> : null}
  </AuthFrame>;
}

export function SessionExpiredRoute() {
  const [search] = useSearchParams();
  const returnTo = safeReturnTo(search.get('returnTo'));
  return <AuthFrame icon={<KeyRound aria-hidden="true" />} title="Session ended" description="Sign in again to continue without losing your destination."><Link className="button primary" to={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}>Sign in again</Link></AuthFrame>;
}

function AuthFrame({ children, description, icon, title }: { children: ReactNode; description: string; icon: ReactNode; title: string }) {
  return <section className="auth-view"><div className="auth-heading"><span className="auth-icon">{icon}</span><div><h2>{title}</h2><p>{description}</p></div></div>{children}</section>;
}

export function FormField({ hint, label, ...input }: React.InputHTMLAttributes<HTMLInputElement> & { hint?: string; label: string }) {
  return <label className="form-field"><span>{label}</span><input {...input} />{hint ? <small>{hint}</small> : null}</label>;
}

function safeReturnTo(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/';
}