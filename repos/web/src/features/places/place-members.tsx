"use client";

import { Check, Crown, MailPlus, ShieldPlus, Trash2, UserMinus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { FormField } from "@/components/ui/form-field";
import { LoadingPanel, StatusPanel } from "@/components/ui/status-panel";
import { routes } from "@/lib/routes";
import { PlaceWorkspaceGate, placeErrorMessage } from "./place-access";
import {
  approvePlaceMember,
  assignPlaceRole,
  createPlaceInvite,
  getPlaceMember,
  isForbiddenPlaceError,
  listPlaceInvites,
  listPlaceMembers,
  listPlaceRoles,
  removePlaceMember,
  removePlaceRole,
  revokePlaceInvite,
  transferPlaceOwnership,
} from "./place-client";
import type { PlaceContextContract, PlaceInviteContract, PlaceMemberContract, PlaceRoleContract } from "./place-contract";

type Notice = { kind: "error" | "success"; text: string } | null;

export function PlaceMembers({ placeId }: { placeId: string }) {
  return <PlaceWorkspaceGate placeId={placeId}>{({ context, reload }) => <MemberDirectory context={context} reloadContext={reload} />}</PlaceWorkspaceGate>;
}

function MemberDirectory({ context, reloadContext }: { context: PlaceContextContract; reloadContext: () => Promise<void> }) {
  const canManageMembers = context.viewer.permissions.includes("member.manage");
  const canManageRoles = context.viewer.permissions.includes("role.manage");
  const [activeMembers, setActiveMembers] = useState<PlaceMemberContract[]>([]);
  const [pendingMembers, setPendingMembers] = useState<PlaceMemberContract[]>([]);
  const [roles, setRoles] = useState<PlaceRoleContract[]>([]);
  const [invites, setInvites] = useState<PlaceInviteContract[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const reads: [Promise<{ items: PlaceMemberContract[] }>, Promise<{ items: PlaceRoleContract[] }>, Promise<{ items: PlaceMemberContract[] }> | undefined, Promise<{ items: PlaceInviteContract[] }> | undefined] = [
      listPlaceMembers(context.place.id),
      listPlaceRoles(context.place.id),
      canManageMembers ? listPlaceMembers(context.place.id, "pending") : undefined,
      canManageMembers ? listPlaceInvites(context.place.id) : undefined,
    ];
    void Promise.all(reads).then(([membersPage, rolesPage, pendingPage, invitesPage]) => {
      if (!active) return;
      setActiveMembers(membersPage.items); setRoles(rolesPage.items);
      setPendingMembers(pendingPage?.items ?? []); setInvites(invitesPage?.items ?? []);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [canManageMembers, context.place.id]);

  async function handleForbidden(error: unknown) {
    if (isForbiddenPlaceError(error)) await reloadContext();
  }

  return <main className="settings-main" id="main-content">
    <header className="settings-heading"><p className="eyebrow">{context.place.name}</p><h1>Members</h1><p>People, invitations, access roles, and ownership.</p></header>
    <div className="member-toolbar"><span>{activeMembers.length} active</span>{canManageMembers ? <span>{pendingMembers.length} awaiting approval</span> : null}<Link className="secondary-button" href={routes.place(context.place.slug)}>Back to place</Link></div>
    {failed ? <StatusPanel tone="error" title="Directory unavailable" description="Member information could not be loaded." /> : <>
      {canManageMembers ? <InvitePanel invites={invites} onChanged={setInvites} onForbidden={handleForbidden} placeId={context.place.id} roles={roles} /> : null}
      {canManageMembers && pendingMembers.length ? <section className="member-section"><div className="section-heading"><p className="eyebrow">Review queue</p><h2>Membership requests</h2></div><div className="member-list">{pendingMembers.map((member) => <MemberRow canManageMembers canManageRoles={false} context={context} key={member.id} member={member} onApproved={async () => { const approved = await approvePlaceMember(context.place.id, member.id); setPendingMembers((items) => items.filter((item) => item.id !== member.id)); setActiveMembers((items) => [...items, approved]); }} onContextChanged={reloadContext} onForbidden={handleForbidden} onRemoved={() => setPendingMembers((items) => items.filter((item) => item.id !== member.id))} roles={roles} />)}</div></section> : null}
      <section className="member-section"><div className="section-heading"><p className="eyebrow">Directory</p><h2>Active members</h2></div>{activeMembers.length ? <div className="member-list">{activeMembers.map((member) => <MemberRow canManageMembers={canManageMembers} canManageRoles={canManageRoles} context={context} key={member.id} member={member} onContextChanged={reloadContext} onForbidden={handleForbidden} onRemoved={() => setActiveMembers((items) => items.filter((item) => item.id !== member.id))} roles={roles} />)}</div> : <StatusPanel title="No active members" description="There are no active members to display." />}</section>
    </>}
  </main>;
}

function MemberRow({ canManageMembers, canManageRoles, context, member, onApproved, onContextChanged, onForbidden, onRemoved, roles }: { canManageMembers: boolean; canManageRoles: boolean; context: PlaceContextContract; member: PlaceMemberContract; onApproved?: () => Promise<void>; onContextChanged: () => Promise<void>; onForbidden: (error: unknown) => Promise<void>; onRemoved: () => void; roles: PlaceRoleContract[] }) {
  const [current, setCurrent] = useState(member);
  const [notice, setNotice] = useState<Notice>(null);
  const isOwner = current.userId === context.place.ownerUserId;
  async function action(operation: () => Promise<void>, success: string) {
    setNotice(null);
    try { await operation(); setNotice({ kind: "success", text: success }); }
    catch (error) { await onForbidden(error); setNotice({ kind: "error", text: placeErrorMessage(error, "The member could not be updated.") }); }
  }
  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const roleId = String(new FormData(event.currentTarget).get("roleId") ?? "");
    await action(async () => setCurrent(await assignPlaceRole(context.place.id, current.id, roleId)), "Role assigned.");
  }
  return <article className="member-row">
    <div className="member-identity"><span className="member-avatar" aria-hidden="true">{initials(current.displayName)}</span><div><Link href={routes.placeMember(context.place.slug, current.id)}><strong>{current.displayName}</strong></Link><span>@{current.handle} · {current.status}</span></div>{isOwner ? <span className="owner-badge"><Crown size={14} /> Owner</span> : null}</div>
    <div className="member-roles">{current.roles.map((role) => <span key={role.id}>{role.name}{canManageRoles && !role.isSystem ? <button aria-label={`Remove ${role.name} from ${current.displayName}`} onClick={() => void action(async () => setCurrent(await removePlaceRole(context.place.id, current.id, role.id)), "Role removed.")} type="button">×</button> : null}</span>)}</div>
    {onApproved ? <button className="primary-button" onClick={() => void action(onApproved, "Membership approved.")} type="button"><Check size={16} /> Approve</button> : null}
    {canManageRoles && !isOwner ? <form className="member-role-form" onSubmit={assign}><label className="sr-only" htmlFor={`role-${current.id}`}>Role for {current.displayName}</label><select id={`role-${current.id}`} name="roleId">{roles.filter((role) => role.name !== "Owner" && !current.roles.some((assigned) => assigned.id === role.id)).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select><button className="icon-button" title="Assign role" type="submit"><ShieldPlus size={17} /><span className="sr-only">Assign role to {current.displayName}</span></button></form> : null}
    {context.viewer.isOwner && !isOwner && current.status === "active" ? <button className="secondary-button" onClick={() => void action(async () => { await transferPlaceOwnership(context.place.id, current.userId); await onContextChanged(); }, "Ownership transferred.")} type="button"><Crown size={16} /> Transfer ownership</button> : null}
    {canManageMembers && !isOwner ? <button className="danger-button" onClick={() => void action(async () => { await removePlaceMember(context.place.id, current.id); onRemoved(); }, "Member removed.")} type="button"><UserMinus size={16} /> Remove</button> : null}
    {isOwner && canManageMembers ? <small className="owner-safety">The owner cannot be removed. Transfer ownership first.</small> : null}
    {notice ? <p className={`form-message form-message-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p> : null}
  </article>;
}

function InvitePanel({ invites, onChanged, onForbidden, placeId, roles }: { invites: PlaceInviteContract[]; onChanged: (items: PlaceInviteContract[]) => void; onForbidden: (error: unknown) => Promise<void>; placeId: string; roles: PlaceRoleContract[] }) {
  const [notice, setNotice] = useState<Notice>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setNotice(null);
    try { const invite = await createPlaceInvite(placeId, { email: String(form.get("email") || "") || undefined, roleId: String(form.get("roleId") || "") || undefined }); onChanged([invite, ...invites]); setNotice({ kind: "success", text: invite.token ? `Invitation created. Token: ${invite.token}` : "Invitation created." }); event.currentTarget.reset(); }
    catch (error) { await onForbidden(error); setNotice({ kind: "error", text: placeErrorMessage(error, "Invitation could not be created.") }); }
  }
  async function revoke(inviteId: string) { try { await revokePlaceInvite(placeId, inviteId); onChanged(invites.filter((invite) => invite.id !== inviteId)); } catch (error) { await onForbidden(error); setNotice({ kind: "error", text: placeErrorMessage(error, "Invitation could not be revoked.") }); } }
  return <section className="member-section invite-panel"><div className="section-heading"><p className="eyebrow">Access</p><h2>Invitations</h2></div><form className="invite-form" onSubmit={submit}><FormField label="Email (optional)" name="email" type="email" /><label className="form-field">Initial role<select name="roleId"><option value="">Member default</option>{roles.filter((role) => role.name !== "Owner").map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><button className="primary-button" type="submit"><MailPlus size={16} /> Create invite</button></form>{notice ? <p className={`form-message form-message-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p> : null}<div className="invite-list">{invites.map((invite) => <div key={invite.id}><span>{invite.email ?? "Shareable invitation"}<small>{invite.useCount}/{invite.maxUses} uses · expires {formatDate(invite.expiresAt)}</small></span><button className="icon-button" onClick={() => void revoke(invite.id)} title="Revoke invitation" type="button"><Trash2 size={16} /><span className="sr-only">Revoke invitation</span></button></div>)}</div></section>;
}

export function PlaceMemberProfile({ memberId, placeId }: { memberId: string; placeId: string }) {
  return <PlaceWorkspaceGate placeId={placeId}>{({ context }) => <MemberProfileContent context={context} memberId={memberId} />}</PlaceWorkspaceGate>;
}

function MemberProfileContent({ context, memberId }: { context: PlaceContextContract; memberId: string }) {
  const [member, setMember] = useState<PlaceMemberContract | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { let active = true; void getPlaceMember(context.place.id, memberId).then((value) => { if (active) setMember(value); }).catch(() => { if (active) setFailed(true); }); return () => { active = false; }; }, [context.place.id, memberId]);
  if (failed) return <main className="settings-main" id="main-content"><StatusPanel title="Member unavailable" description="This member could not be found in the place." /></main>;
  if (!member) return <main className="settings-main" id="main-content"><LoadingPanel label="Loading member" /></main>;
  return <main className="settings-main" id="main-content"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href={routes.place(context.place.slug)}>{context.place.name}</Link><span>/</span><Link href={routes.placeMembers(context.place.slug)}>Members</Link></nav><header className="member-profile"><span className="member-avatar large" aria-hidden="true">{initials(member.displayName)}</span><div><p className="eyebrow">{member.status} member</p><h1>{member.displayName}</h1><p>@{member.handle}</p></div></header><section className="settings-section"><h2>Place roles</h2><div className="member-roles">{member.roles.map((role) => <span key={role.id}>{role.name}</span>)}</div><p className="settings-muted">{member.joinedAt ? `Joined ${formatDate(member.joinedAt)}` : "Membership is awaiting approval."}</p></section></main>;
}

function initials(value: string): string { return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function formatDate(value: string): string { return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value)); }