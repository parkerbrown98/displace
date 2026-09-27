import { Check, Copy, Crown, MailPlus, Search, ShieldPlus, Trash2, UserMinus, UsersRound, X } from 'lucide-react';
import { useDeferredValue, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RouteState } from '../../components/route-state/route-state';
import { useConfirmation, useToast } from '../../components/ui/feedback-context';
import { Select } from '../../components/ui/select';
import { DesktopApiError } from '../../lib/api/desktop-api';
import { useRemoteResource } from '../../lib/remote-resource';
import { useSession } from '../auth/session-provider';
import type { Member, PlaceContext, Role } from './place-client';
import { PlaceToolbar } from './place-toolbar';
import { usePlaceClient } from './use-place-client';

export function PlaceMembersRoute() {
  const client = usePlaceClient();
  const confirm = useConfirmation();
  const notify = useToast();
  const session = useSession();
  const { placeSlug = '' } = useParams();
  const [query, setQuery] = useState('');
  const [issuedToken, setIssuedToken] = useState<string>();
  const [pendingAction, setPendingAction] = useState(false);
  const deferredQuery = useDeferredValue(query.trim());
  const resource = useRemoteResource(`place-members:${placeSlug}:${deferredQuery}:${session.status}`, async () => {
    const place = await client.get(placeSlug);
    const context = await client.context(place.id);
    const canManageMembers = context.viewer.permissions.includes('member.manage');
    const canManageRoles = context.viewer.permissions.includes('role.manage');
    const [members, requests, roles, invites] = await Promise.all([
      client.members(place.id, deferredQuery || undefined),
      canManageMembers ? client.members(place.id, undefined, 'pending') : undefined,
      canManageMembers || canManageRoles ? client.roles(place.id) : undefined,
      canManageMembers ? client.invites(place.id) : undefined,
    ]);
    return { context, invites: invites?.items ?? [], members: members.items, place, requests: requests?.items ?? [], roles: roles?.items ?? [] };
  });

  if (session.status === 'loading') return <RouteState state="loading" title="Loading members" />;
  if (session.status !== 'authenticated') return <section className="settings-gate"><UsersRound size={28} /><h2>Sign in required</h2><p>Sign in as a member to view this directory.</p><Link className="button primary" to={`/sign-in?returnTo=${encodeURIComponent(`/places/${placeSlug}/members`)}`}>Sign in</Link></section>;
  if (resource.state.status === 'loading') return <RouteState state="loading" title="Loading members" />;
  if (resource.state.status === 'error') return <RouteState state="error" title="Members unavailable" message="The member directory could not be loaded." onRetry={resource.reload} />;

  const data = resource.state.data;
  const canManageMembers = data.context.viewer.permissions.includes('member.manage');
  async function run(action: () => Promise<unknown>, success: string) {
    setPendingAction(true);
    try { await action(); notify(success); resource.reload(); }
    catch (error) { notify(errorMessage(error, 'The member action could not be completed.')); if (isAuthorizationChange(error)) resource.reload(); }
    finally { setPendingAction(false); }
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = new FormData(form);
    setPendingAction(true);
    try {
      const invite = await client.createInvite(data.place.id, { email: String(input.get('email') ?? '') || undefined, roleId: String(input.get('roleId') ?? '') || undefined });
      setIssuedToken(invite.token);
      notify('Invitation created.');
      form.reset();
      resource.reload();
    } catch (error) { notify(errorMessage(error, 'The invitation could not be created.')); }
    finally { setPendingAction(false); }
  }

  return <div className="community-view place-workspace-page">
    <PlaceToolbar active="members" context={data.context} place={data.place} />
    <header className="place-page-heading"><span className="eyebrow">Directory</span><h2>Members</h2><p>People participating in {data.place.name}.</p></header>
    {canManageMembers ? <section className="member-admin-grid">
      <div className="management-section"><header><div><span className="eyebrow">Access</span><h3>Invite someone</h3></div></header><form className="invite-form member-invite-form" onSubmit={invite}><label>Email (optional)<input name="email" type="email" placeholder="person@example.com" /></label><label>Starting role<Select defaultValue="" name="roleId" options={[{ label: 'No additional role', value: '' }, ...data.roles.filter((role) => !isOwnerRole(role)).map((role) => ({ label: role.name, value: role.id }))]} /></label><button className="button primary compact" disabled={pendingAction}><MailPlus size={14} />Create invite</button></form>{issuedToken ? <div className="issued-token"><span><strong>Invitation token</strong><code>{issuedToken}</code></span><button aria-label="Copy invitation token" className="icon-button" onClick={() => void navigator.clipboard.writeText(issuedToken).then(() => notify('Invitation token copied.'))} title="Copy token"><Copy size={15} /></button></div> : null}</div>
      <div className="management-section"><header><div><span className="eyebrow">Outstanding</span><h3>Invitations</h3></div></header><div className="invite-management-list">{data.invites.length ? data.invites.map((invite) => <div key={invite.id}><span><strong>{invite.email ?? 'Shareable invitation'}</strong><small>{invite.useCount}/{invite.maxUses} uses · expires {formatDate(invite.expiresAt)}</small></span><button aria-label="Revoke invitation" className="icon-button" disabled={pendingAction} onClick={() => void confirm({ confirmLabel: 'Revoke invite', message: 'This invitation will stop working immediately.', title: 'Revoke invitation?' }).then((accepted) => accepted ? run(() => client.revokeInvite(data.place.id, invite.id), 'Invitation revoked.') : undefined)} title="Revoke invitation"><Trash2 size={15} /></button></div>) : <p className="settings-muted">No active invitations.</p>}</div></div>
    </section> : null}
    {canManageMembers && data.requests.length ? <section className="management-section member-review"><header><div><span className="eyebrow">Review queue</span><h3>Membership requests</h3></div><span>{data.requests.length}</span></header><div className="member-directory">{data.requests.map((member) => <MemberRow context={data.context} key={member.id} member={member} pending={pendingAction} roles={data.roles} onAction={run} />)}</div></section> : null}
    <label className="member-search"><Search size={17} aria-hidden="true" /><input aria-label="Search members" onChange={(event) => setQuery(event.target.value)} placeholder="Search members" type="search" value={query} /></label>
    <section className="member-directory" aria-label="Active members">
      {data.members.length ? data.members.map((member) => <MemberRow context={data.context} key={member.id} member={member} pending={pendingAction} roles={data.roles} onAction={run} />) : <p className="settings-muted">No active members match this search.</p>}
    </section>
  </div>;
}

function MemberRow({ context, member, onAction, pending, roles }: { context: PlaceContext; member: Member; onAction(action: () => Promise<unknown>, success: string): Promise<void>; pending: boolean; roles: Role[] }) {
  const client = usePlaceClient();
  const confirm = useConfirmation();
  const canManageMembers = context.viewer.permissions.includes('member.manage');
  const canManageRoles = context.viewer.permissions.includes('role.manage');
  const owner = member.roles.some(isOwnerRole);
  const availableRoles = roles.filter((role) => !owner && !member.roles.some((assigned) => assigned.id === role.id) && !isOwnerRole(role));
  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const roleId = String(new FormData(event.currentTarget).get('roleId') ?? '');
    if (roleId) await onAction(() => client.assignRole(context.place.id, member.id, roleId), 'Role assigned.');
  }
  return <article className="member-directory-row">
    <span className="avatar">{initials(member.displayName)}</span>
    <div className="member-identity"><Link to={`/places/${context.place.slug}/members/${member.id}`}><strong>{member.displayName}</strong></Link><small>@{member.handle} · {member.status}</small></div>
    <div className="member-role-list">{member.roles.map((role) => <span key={role.id}>{role.name}{canManageRoles && !role.isSystem ? <button aria-label={`Remove ${role.name}`} disabled={pending} onClick={() => void onAction(() => client.removeRole(context.place.id, member.id, role.id), 'Role removed.')} title={`Remove ${role.name}`}><X size={11} /></button> : null}</span>)}</div>
    <div className="member-actions">
      {member.status === 'pending' && canManageMembers ? <button className="button primary compact" disabled={pending} onClick={() => void onAction(() => client.approveMember(context.place.id, member.id), 'Member approved.')}><Check size={14} />Approve</button> : null}
      {member.status === 'active' && canManageRoles && availableRoles.length ? <form onSubmit={assign}><Select aria-label={`Assign role to ${member.displayName}`} name="roleId" options={availableRoles.map((role) => ({ label: role.name, value: role.id }))} /><button aria-label={`Assign selected role to ${member.displayName}`} className="icon-button" disabled={pending} title="Assign role"><ShieldPlus size={15} /></button></form> : null}
      {member.status === 'active' && context.viewer.isOwner && !owner ? <button aria-label={`Transfer ownership to ${member.displayName}`} className="icon-button" disabled={pending} onClick={() => void confirm({ confirmLabel: 'Transfer ownership', message: 'You will no longer be the owner of this place.', title: `Make ${member.displayName} the owner?` }).then((accepted) => accepted ? onAction(() => client.transferOwnership(context.place.id, member.userId), 'Ownership transferred.') : undefined)} title="Transfer ownership"><Crown size={15} /></button> : null}
      {canManageMembers && !owner ? <button aria-label={`Remove ${member.displayName}`} className="icon-button danger-icon" disabled={pending} onClick={() => void confirm({ confirmLabel: 'Remove member', message: 'Their roles and current access will be removed.', title: `Remove ${member.displayName}?` }).then((accepted) => accepted ? onAction(() => client.removeMember(context.place.id, member.id), 'Member removed.') : undefined)} title="Remove member"><UserMinus size={15} /></button> : null}
    </div>
  </article>;
}

export function PlaceMemberRoute() {
  const client = usePlaceClient();
  const session = useSession();
  const { memberId = '', placeSlug = '' } = useParams();
  const resource = useRemoteResource(`place-member:${placeSlug}:${memberId}:${session.status}`, async () => {
    const place = await client.get(placeSlug);
    const [context, member] = await Promise.all([client.context(place.id), client.member(place.id, memberId)]);
    return { context, member, place };
  });
  if (session.status === 'loading' || resource.state.status === 'loading') return <RouteState state="loading" title="Loading member" />;
  if (session.status !== 'authenticated') return <section className="settings-gate"><UsersRound size={28} /><h2>Sign in required</h2><Link className="button primary" to={`/sign-in?returnTo=${encodeURIComponent(`/places/${placeSlug}/members/${memberId}`)}`}>Sign in</Link></section>;
  if (resource.state.status === 'error') return <RouteState state="not-found" title="Member unavailable" message="This membership record could not be found." />;
  const { context, member, place } = resource.state.data;
  return <div className="community-view place-workspace-page"><PlaceToolbar active="members" context={context} place={place} /><Link className="back-link" to={`/places/${place.slug}/members`}>Back to members</Link><section className="member-profile"><span className="avatar profile-avatar">{initials(member.displayName)}</span><div><span className="eyebrow">{member.status} member</span><h2>{member.displayName}</h2><Link to={`/members/${member.handle}`}>@{member.handle}</Link><p>{member.joinedAt ? `Joined ${formatDate(member.joinedAt)}` : 'Awaiting membership approval'}</p><div className="member-role-list">{member.roles.map((role) => <span key={role.id}>{role.name}</span>)}</div></div></section></div>;
}

function initials(value: string): string { return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }
function isOwnerRole(role: Role): boolean { return role.isSystem && role.name.toLowerCase() === 'owner'; }
function formatDate(value: string): string { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)); }
function errorMessage(error: unknown, fallback: string): string { return error instanceof DesktopApiError ? error.problem?.detail ?? error.message : fallback; }
function isAuthorizationChange(error: unknown): boolean { return error instanceof DesktopApiError && ['forbidden', 'gone', 'not-found', 'unauthenticated'].includes(error.kind); }