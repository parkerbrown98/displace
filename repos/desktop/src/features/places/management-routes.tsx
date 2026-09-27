import { Archive, ChevronLeft, Copy, KeyRound, ShieldCheck, UserPlus, UsersRound } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RouteState } from '../../components/route-state/route-state';
import { useConfirmation, useToast } from '../../components/ui/feedback-context';
import { DesktopApiError } from '../../lib/api/desktop-api';
import { useRemoteResource } from '../../lib/remote-resource';
import { useSession } from '../auth/session-provider';
import type { Place } from './place-client';
import { usePlaceClient } from './use-place-client';

export function CreatePlaceRoute() {
  const session = useSession();
  const client = usePlaceClient();
  const navigate = useNavigate();
  const notify = useToast();
  const [pending, setPending] = useState(false);

  if (session.status === 'loading') return <RouteState state="loading" title="Loading workspace" />;
  if (session.status !== 'authenticated') return <SignInGate message="Sign in to create and manage a place." returnTo="/places/new" />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const place = await client.create({
        description: String(form.get('description') ?? ''),
        joinPolicy: String(form.get('joinPolicy')) as Place['joinPolicy'],
        name: String(form.get('name') ?? ''),
        slug: String(form.get('slug') ?? ''),
        visibility: String(form.get('visibility')) as Place['visibility'],
      });
      notify('Place created.');
      navigate(`/places/${place.slug}/settings`, { replace: true });
    } catch (error) {
      notify(errorMessage(error, 'The place could not be created.'));
    } finally {
      setPending(false);
    }
  }

    return <div className="community-view management-view"><header className="compact-page-heading"><span className="eyebrow">New community</span><h2>Make room for a good conversation.</h2><p>Start with the public identity and access model. Boards and roles can follow.</p></header><section className="management-section"><form className="management-form" onSubmit={submit}><TextField label="Name" maxLength={100} name="name" required /><TextField hint="Lowercase letters, numbers, and hyphens." label="URL slug" maxLength={48} name="slug" pattern="[a-z0-9-]+" required /><label className="wide-field">Description<textarea maxLength={500} name="description" rows={4} /></label><SelectField label="Visibility" name="visibility" options={[['public', 'Public'], ['unlisted', 'Unlisted'], ['private', 'Private']]} /><SelectField label="Joining" name="joinPolicy" options={[['open', 'Open to join'], ['approval', 'Requires approval'], ['invite_only', 'Invite only']]} /><button className="button primary" disabled={pending}>{pending ? 'Creating...' : 'Create place'}</button></form></section></div>;
}

export function PlaceSettingsRoute() {
  const session = useSession();
  const client = usePlaceClient();
  const { placeSlug = '' } = useParams();
  const resource = useRemoteResource(`place-settings:${placeSlug}`, async () => {
    const place = await client.get(placeSlug);
    const context = await client.context(place.id);
    const canManagePlace = context.viewer.permissions.includes('place.manage');
    const canManageMembers = context.viewer.permissions.includes('member.manage');
    const canManageRoles = context.viewer.permissions.includes('role.manage');
    const [members, roles, invites] = await Promise.all([
      canManageMembers ? client.members(place.id) : undefined,
      canManageRoles || canManageMembers ? client.roles(place.id) : undefined,
      canManageMembers ? client.invites(place.id) : undefined,
    ]);
    return { canManageMembers, canManagePlace, canManageRoles, context, invites, members, place, roles };
  });

  if (session.status === 'loading') return <RouteState state="loading" title="Loading settings" />;
  if (session.status !== 'authenticated') return <SignInGate message="Sign in to manage this place." returnTo={`/places/${placeSlug}/settings`} />;
  if (resource.state.status === 'loading') return <RouteState state="loading" title="Loading place settings" />;
  if (resource.state.status === 'error') {
    const hidden = resource.state.error instanceof DesktopApiError && ['forbidden', 'gone', 'not-found'].includes(resource.state.error.kind);
    return hidden ? <RouteState state="not-found" title="Settings unavailable" message="This place does not exist or you no longer have access." /> : <RouteState state="error" title="Settings unavailable" message={errorMessage(resource.state.error, 'Settings could not be loaded.')} onRetry={resource.reload} />;
  }

  const data = resource.state.data;
  return <div className="community-view management-view"><header className="settings-heading"><Link className="back-link" to={`/places/${data.place.slug}`}><ChevronLeft size={15} />Back to {data.place.name}</Link><span className="eyebrow">Place administration</span><h2>{data.place.name}</h2><p>Capabilities come from the server and determine which tools are available here.</p></header>{data.canManagePlace ? <PlaceIdentitySection place={data.place} reload={resource.reload} /> : <PermissionNote title="Identity settings" />}{data.canManageMembers ? <MemberSection invites={data.invites?.items ?? []} members={data.members?.items ?? []} placeId={data.place.id} reload={resource.reload} roles={data.roles?.items ?? []} /> : <PermissionNote title="Members and invitations" />}{data.canManageRoles ? <RoleSection roles={data.roles?.items ?? []} /> : <PermissionNote title="Roles" />}{data.canManagePlace ? <ArchiveSection place={data.place} reload={resource.reload} /> : null}</div>;
}

function PlaceIdentitySection({ place, reload }: { place: Place; reload(): void }) {
  const client = usePlaceClient();
  const notify = useToast();
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      await client.update(place.id, { description: String(form.get('description') ?? ''), joinPolicy: String(form.get('joinPolicy')) as Place['joinPolicy'], name: String(form.get('name') ?? ''), visibility: String(form.get('visibility')) as Place['visibility'] });
      notify('Place settings saved.');
      reload();
    } catch (error) { notify(errorMessage(error, 'Place settings could not be saved.')); if (isAuthorizationChange(error)) reload(); }
    finally { setPending(false); }
  }
  return <ManagementSection icon={<ShieldCheck />} eyebrow="Identity and access" title="Place settings"><form className="management-form" onSubmit={submit}><TextField defaultValue={place.name} label="Name" maxLength={100} name="name" required /><label className="wide-field">Description<textarea defaultValue={place.description} maxLength={500} name="description" rows={3} /></label><SelectField defaultValue={place.visibility} label="Visibility" name="visibility" options={[['public', 'Public'], ['unlisted', 'Unlisted'], ['private', 'Private']]} /><SelectField defaultValue={place.joinPolicy} label="Joining" name="joinPolicy" options={[['open', 'Open to join'], ['approval', 'Requires approval'], ['invite_only', 'Invite only']]} /><button className="button primary" disabled={pending}>{pending ? 'Saving...' : 'Save changes'}</button></form></ManagementSection>;
}

function MemberSection({ invites, members, placeId, reload, roles }: { invites: { email: string | null; expiresAt: string; id: string }[]; members: { displayName: string; handle: string; id: string; roles: { id: string; name: string }[] }[]; placeId: string; reload(): void; roles: { id: string; name: string }[] }) {
  const client = usePlaceClient();
  const notify = useToast();
  const [issuedToken, setIssuedToken] = useState<string>();
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const issued = await client.createInvite(placeId, { email: String(form.get('email') ?? '') || undefined, roleId: String(form.get('roleId') ?? '') || undefined });
      setIssuedToken(issued.token);
      notify('Invitation created.');
    } catch (error) { notify(errorMessage(error, 'The invitation could not be created.')); if (isAuthorizationChange(error)) reload(); }
  }
  async function copyToken() {
    if (!issuedToken) return;
    await navigator.clipboard.writeText(issuedToken);
    notify('Invitation token copied.');
  }
  return <ManagementSection icon={<UsersRound />} eyebrow="Access" title="Members and invitations"><div className="management-split"><div><h4>Members</h4><div className="member-list">{members.map((member) => <article key={member.id}><span className="avatar small">{initials(member.displayName)}</span><div><strong>{member.displayName}</strong><small>@{member.handle} · {member.roles.map((role) => role.name).join(', ') || 'Member'}</small></div></article>)}</div></div><div><h4>Invite someone</h4><form className="invite-form" onSubmit={invite}><TextField label="Email (optional)" name="email" type="email" /><SelectField label="Starting role" name="roleId" options={roles.map((role) => [role.id, role.name])} optional /><button className="button secondary"><UserPlus size={15} />Create invite</button></form>{issuedToken ? <div className="issued-token"><div><KeyRound size={15} /><span><strong>One-time invitation token</strong><code>{issuedToken}</code></span></div><button aria-label="Copy invitation token" className="icon-button" onClick={() => void copyToken()} title="Copy token"><Copy size={16} /></button></div> : null}{invites.length ? <div className="invite-summary">{invites.slice(0, 4).map((item) => <p key={item.id}><span>{item.email ?? 'Shareable invite'}</span><time dateTime={item.expiresAt}>Expires {formatDate(item.expiresAt)}</time></p>)}</div> : null}</div></div></ManagementSection>;
}

function RoleSection({ roles }: { roles: { id: string; isSystem?: boolean; name: string; permissions: string[] }[] }) {
  return <ManagementSection icon={<KeyRound />} eyebrow="Capabilities" title="Roles"><div className="role-grid">{roles.map((role) => <article key={role.id}><header><strong>{role.name}</strong>{role.isSystem ? <span>System</span> : null}</header><p>{role.permissions.length ? role.permissions.map((permission) => permission.split('.')[0]).filter((value, index, all) => all.indexOf(value) === index).join(' · ') : 'No elevated capabilities'}</p></article>)}</div></ManagementSection>;
}

function ArchiveSection({ place, reload }: { place: Place; reload(): void }) {
  const client = usePlaceClient();
  const confirm = useConfirmation();
  const navigate = useNavigate();
  const notify = useToast();
  async function archive() {
    if (!await confirm({ confirmLabel: 'Archive place', message: 'Members will lose access to this place and its active conversations.', title: `Archive ${place.name}?` })) return;
    try { await client.archive(place.id); notify('Place archived.'); navigate('/discover', { replace: true }); }
    catch (error) { notify(errorMessage(error, 'The place could not be archived.')); if (isAuthorizationChange(error)) reload(); }
  }
  return <ManagementSection icon={<Archive />} eyebrow="Danger zone" title="Archive place"><div className="danger-row"><p>Archive this place and remove it from active discovery.</p><button className="button danger" onClick={() => void archive()}><Archive size={15} />Archive place</button></div></ManagementSection>;
}

function ManagementSection({ children, eyebrow, icon, title }: { children: ReactNode; eyebrow: string; icon: ReactNode; title: string }) { return <section className="management-section"><header><span className="management-icon">{icon}</span><div><span className="eyebrow">{eyebrow}</span><h3>{title}</h3></div></header>{children}</section>; }
function PermissionNote({ title }: { title: string }) { return <section className="permission-note"><LockIcon /><div><strong>{title}</strong><p>Your current role does not include this capability.</p></div></section>; }
function LockIcon() { return <KeyRound aria-hidden="true" size={18} />; }
function SignInGate({ message, returnTo }: { message: string; returnTo: string }) { return <section className="settings-gate"><UserPlus size={28} /><h2>Sign in required</h2><p>{message}</p><Link className="button primary" to={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}>Sign in</Link></section>; }
function TextField(props: { defaultValue?: string; hint?: string; label: string; maxLength?: number; name: string; pattern?: string; required?: boolean; type?: string }) { return <label>{props.label}<input defaultValue={props.defaultValue} maxLength={props.maxLength} name={props.name} pattern={props.pattern} required={props.required} type={props.type ?? 'text'} />{props.hint ? <small>{props.hint}</small> : null}</label>; }
function SelectField({ defaultValue, label, name, optional, options }: { defaultValue?: string; label: string; name: string; optional?: boolean; options: [string, string][] }) { return <label>{label}<select defaultValue={defaultValue ?? ''} name={name}>{optional ? <option value="">No added role</option> : null}{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>; }
function errorMessage(error: unknown, fallback: string): string { return error instanceof DesktopApiError ? error.problem?.detail ?? error.message : fallback; }
function isAuthorizationChange(error: unknown): boolean { return error instanceof DesktopApiError && ['forbidden', 'gone', 'not-found', 'unauthenticated'].includes(error.kind); }
function initials(value: string): string { return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }
function formatDate(value: string): string { return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value)); }