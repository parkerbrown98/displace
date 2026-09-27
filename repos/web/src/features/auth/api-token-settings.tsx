'use client';

import { Copy, KeyRound, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { FormField } from '@/components/ui/form-field';
import { SettingsDialog } from '@/components/ui/settings-dialog';
import { LoadingPanel } from '@/components/ui/status-panel';
import { toast } from '@/components/ui/toast';
import { authErrorMessage } from './auth-error-message';
import {
  createApiToken,
  listApiTokens,
  revokeApiToken,
  rotateApiToken,
  type ApiToken,
  type ApiTokenScope,
  type IssuedApiToken,
} from './api-token-client';

const scopeOptions: Array<{ description: string; label: string; value: ApiTokenScope }> = [
  { description: 'Read resources visible to your account.', label: 'Read', value: 'read' },
  { description: 'Create and change resources as your account.', label: 'Write', value: 'write' },
  { description: 'Use operations requiring your moderation permissions.', label: 'Moderation', value: 'moderation' },
  { description: 'Use operations requiring instance administrator access.', label: 'Administration', value: 'administration' },
];

type TokenDialog =
  | { kind: 'create' }
  | { kind: 'reveal'; token: IssuedApiToken }
  | { kind: 'revoke'; token: ApiToken }
  | { kind: 'rotate'; token: ApiToken }
  | null;

export function ApiTokenSettings() {
  const [tokens, setTokens] = useState<ApiToken[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [dialog, setDialog] = useState<TokenDialog>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    void listApiTokens()
      .then((items) => { if (active) setTokens(items); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  async function refreshTokens() {
    setTokens(await listApiTokens());
    setFailed(false);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const issued = await createApiToken({
        expiresAt: endOfDay(String(form.get('expiresAt') ?? '')),
        name: String(form.get('name') ?? ''),
        scopes: form.getAll('scopes') as ApiTokenScope[],
      });
      await refreshTokens();
      setDialog({ kind: 'reveal', token: issued });
    } catch (cause) {
      toast.error(authErrorMessage(cause, 'API token could not be created.'));
    } finally {
      setPending(false);
    }
  }

  async function rotate(event: FormEvent<HTMLFormElement>, token: ApiToken) {
    event.preventDefault();
    setPending(true);
    const value = String(new FormData(event.currentTarget).get('expiresAt') ?? '');
    try {
      const issued = await rotateApiToken(token.id, value ? endOfDay(value) : undefined);
      await refreshTokens();
      setDialog({ kind: 'reveal', token: issued });
    } catch (cause) {
      toast.error(authErrorMessage(cause, 'API token could not be rotated.'));
    } finally {
      setPending(false);
    }
  }

  async function revoke(token: ApiToken) {
    setPending(true);
    try {
      await revokeApiToken(token.id);
      await refreshTokens();
      setDialog(null);
      toast.success('API token revoked.');
    } catch (cause) {
      toast.error(authErrorMessage(cause, 'API token could not be revoked.'));
    } finally {
      setPending(false);
    }
  }

  const title = dialogTitle(dialog);
  return (
    <section className="settings-section" id="tokens">
      <div className="settings-section-heading">
        <div><p className="eyebrow">Developer access</p><h2>API tokens</h2></div>
        <SettingsDialog
          description={title.description}
          onOpenChange={(open) => { if (!open) setDialog(null); }}
          open={dialog !== null}
          title={title.title}
          trigger={<button className="primary-button" onClick={() => setDialog({ kind: 'create' })} type="button"><Plus aria-hidden="true" size={16} /> Create token</button>}
        >
          {dialog?.kind === 'create' ? <CreateTokenForm pending={pending} onSubmit={create} /> : null}
          {dialog?.kind === 'rotate' ? <RotateTokenForm pending={pending} token={dialog.token} onSubmit={rotate} /> : null}
          {dialog?.kind === 'revoke' ? <RevokeTokenForm pending={pending} token={dialog.token} onRevoke={revoke} /> : null}
          {dialog?.kind === 'reveal' ? <TokenReveal token={dialog.token} /> : null}
        </SettingsDialog>
      </div>
      <p className="settings-muted">Use scoped tokens for scripts and integrations. Tokens act as your account and cannot exceed your current permissions.</p>
      {failed ? (
        <div className="token-load-error"><p className="form-message form-message-error" role="alert">API tokens could not be loaded.</p><button className="secondary-button" onClick={() => void refreshTokens()} type="button">Try again</button></div>
      ) : tokens === null ? (
        <LoadingPanel label="Loading API tokens" />
      ) : (
        <TokenList tokens={tokens} onAction={setDialog} />
      )}
    </section>
  );
}

function CreateTokenForm({ onSubmit, pending }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; pending: boolean }) {
  return <form className="settings-form" method="post" onSubmit={onSubmit}>
    <FormField autoComplete="off" label="Token name" maxLength={100} name="name" placeholder="Deploy automation" required />
    <ScopePicker />
    <FormField defaultValue={defaultExpiryDate()} label="Expiration date" max={maximumExpiryDate()} min={tomorrowDate()} name="expiresAt" required type="date" />
    <button className="primary-button" disabled={pending} type="submit"><KeyRound aria-hidden="true" size={16} /> {pending ? 'Creating...' : 'Create token'}</button>
  </form>;
}

function ScopePicker() {
  return <fieldset className="token-scope-picker"><legend>Scopes</legend>{scopeOptions.map((scope) => <label key={scope.value}>
    <input defaultChecked={scope.value === 'read'} name="scopes" type="checkbox" value={scope.value} />
    <span><strong>{scope.label}</strong><small>{scope.description}</small></span>
  </label>)}</fieldset>;
}

function RotateTokenForm({ onSubmit, pending, token }: { onSubmit: (event: FormEvent<HTMLFormElement>, token: ApiToken) => void; pending: boolean; token: ApiToken }) {
  return <form className="settings-form" method="post" onSubmit={(event) => onSubmit(event, token)}>
    <p className="settings-muted">The current token will stop working immediately. The replacement keeps the same name and scopes.</p>
    <FormField hint="Leave blank to keep the current expiration date." label="New expiration date" max={maximumExpiryDate()} min={tomorrowDate()} name="expiresAt" type="date" />
    <button className="danger-button" disabled={pending} type="submit"><RefreshCw aria-hidden="true" size={16} /> {pending ? 'Rotating...' : 'Rotate token'}</button>
  </form>;
}

function RevokeTokenForm({ onRevoke, pending, token }: { onRevoke: (token: ApiToken) => Promise<void>; pending: boolean; token: ApiToken }) {
  return <div className="settings-form">
    <p className="settings-muted"><strong>{token.name}</strong> will stop working immediately. This action cannot be undone.</p>
    <button className="danger-button" disabled={pending} onClick={() => void onRevoke(token)} type="button"><Trash2 aria-hidden="true" size={16} /> {pending ? 'Revoking...' : 'Revoke token'}</button>
  </div>;
}

function TokenReveal({ token }: { token: IssuedApiToken }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(token.token);
      toast.success('Token copied.');
    } catch {
      toast.error('Token could not be copied. Select it manually.');
    }
  }
  return <div className="settings-form token-reveal">
    <p className="form-message">This secret will not be shown again. Store it somewhere secure before closing this dialog.</p>
    <div className="token-secret"><code>{token.token}</code><button className="icon-button" onClick={() => void copy()} title="Copy token" type="button"><Copy aria-hidden="true" size={17} /><span className="sr-only">Copy token</span></button></div>
  </div>;
}

function TokenList({ onAction, tokens }: { onAction: (dialog: TokenDialog) => void; tokens: ApiToken[] }) {
  if (!tokens.length) return <p className="settings-muted">No API tokens have been created.</p>;
  return <div className="token-list">{tokens.map((token) => {
    const inactive = Boolean(token.revokedAt) || new Date(token.expiresAt) <= new Date();
    return <article className="token-row" key={token.id}>
      <KeyRound aria-hidden="true" size={18} />
      <div className="token-row-copy"><strong>{token.name}</strong><code>{token.prefix}...</code><span>{token.scopes.join(' / ')}</span><small>Expires {formatDate(token.expiresAt)} / Last used {token.lastUsedAt ? formatDate(token.lastUsedAt) : 'never'}</small></div>
      <span className={`token-state ${inactive ? 'inactive' : ''}`}>{token.revokedAt ? 'Revoked' : new Date(token.expiresAt) <= new Date() ? 'Expired' : 'Active'}</span>
      {!inactive ? <div className="token-actions"><button className="icon-button" onClick={() => onAction({ kind: 'rotate', token })} title={`Rotate ${token.name}`} type="button"><RefreshCw aria-hidden="true" size={16} /><span className="sr-only">Rotate {token.name}</span></button><button className="icon-button" onClick={() => onAction({ kind: 'revoke', token })} title={`Revoke ${token.name}`} type="button"><Trash2 aria-hidden="true" size={16} /><span className="sr-only">Revoke {token.name}</span></button></div> : null}
    </article>;
  })}</div>;
}

function dialogTitle(dialog: TokenDialog): { description: string; title: string } {
  if (dialog?.kind === 'reveal') return { description: 'Copy this secret before closing.', title: 'Save your API token' };
  if (dialog?.kind === 'rotate') return { description: `Replace ${dialog.token.name} with a new secret.`, title: 'Rotate API token' };
  if (dialog?.kind === 'revoke') return { description: `Permanently revoke ${dialog.token.name}.`, title: 'Revoke API token' };
  return { description: 'Choose the minimum access your integration needs.', title: 'Create API token' };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function dateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function tomorrowDate(): string {
  return dateInputValue(new Date(Date.now() + 24 * 60 * 60 * 1_000));
}

function defaultExpiryDate(): string {
  return dateInputValue(new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000));
}

function maximumExpiryDate(): string {
  return dateInputValue(new Date(Date.now() + 365 * 24 * 60 * 60 * 1_000));
}

function endOfDay(value: string): string {
  return new Date(`${value}T23:59:59.000Z`).toISOString();
}