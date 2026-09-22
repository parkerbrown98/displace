"use client";

import { Archive, Plus, Save, Shield, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { FormField } from "@/components/ui/form-field";
import { StatusPanel } from "@/components/ui/status-panel";
import { setPlaceImage } from "@/features/assets/asset-client";
import type { AssetContract } from "@/features/assets/asset-contract";
import { ImageUploader } from "@/features/assets/image-uploader";
import { useSession } from "@/features/auth/session-provider";
import { ChatChannelSettings } from "@/features/chat/chat-channel-settings";
import { ForumSettings } from "@/features/forums/forum-settings";
import { routes } from "@/lib/routes";
import { PlaceWorkspaceGate, placeErrorMessage } from "./place-access";
import { PlaceForumHeader } from "./place-forum-header";
import {
  archivePlace,
  createPlace,
  createPlaceRole,
  deletePlaceRole,
  isForbiddenPlaceError,
  listPlaceRoles,
  singlePlaceSlug,
  updatePlace,
  updatePlaceRole,
  updatePlaceSettings,
} from "./place-client";
import { placePermissions, type PlaceContextContract, type PlacePermission, type PlaceRoleContract } from "./place-contract";

type Notice = { kind: "error" | "success"; text: string } | null;

export function CreatePlacePanel() {
  const session = useSession();
  const router = useRouter();
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, setPending] = useState(false);
  const configuredSlug = singlePlaceSlug();

  if (configuredSlug) return <main className="public-main standalone-public-state" id="main-content"><StatusPanel title="Place creation disabled" description="This installation is configured for one place." action={<a className="primary-button" href={routes.place(configuredSlug)}>Open place</a>} /></main>;
  if (session.status === "loading") return <main className="public-main standalone-public-state" id="main-content"><p className="settings-muted">Loading account...</p></main>;
  if (session.status !== "authenticated") return <main className="public-main standalone-public-state" id="main-content"><StatusPanel title="Sign in required" description="Use a verified account to create a place." action={<a className="primary-button" href={`${routes.signIn}?returnTo=${encodeURIComponent(routes.createPlace)}`}>Sign in</a>} /></main>;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setNotice(null);
    const form = new FormData(event.currentTarget);
    try {
      const place = await createPlace({
        description: String(form.get("description") ?? ""),
        joinPolicy: String(form.get("joinPolicy")) as "open" | "approval" | "invite_only",
        name: String(form.get("name") ?? ""),
        slug: String(form.get("slug") ?? ""),
        visibility: String(form.get("visibility")) as "public" | "unlisted" | "private",
      });
      router.push(routes.placeSettings(place.slug)); router.refresh();
    } catch (error) { setNotice({ kind: "error", text: placeErrorMessage(error, "The place could not be created.") }); }
    finally { setPending(false); }
  }

  return <main className="public-main place-workspace-page place-create-page" id="main-content">
    <header className="place-page-heading standalone"><p className="eyebrow">New community</p><h1>Create a place</h1><p>Choose a stable identity and how the first members can enter.</p></header>
    <section className="settings-section place-create-section"><form className="settings-form" method="post" onSubmit={submit}>
      <FormField label="Name" maxLength={120} minLength={1} name="name" required />
      <FormField hint="Lowercase letters, numbers, and hyphens. This becomes the permanent URL." label="Slug" maxLength={80} minLength={3} name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
      <label className="form-field">Description<textarea maxLength={4000} name="description" rows={5} /></label>
      <PlacePolicyFields />
      <NoticeMessage notice={notice} /><button className="primary-button" disabled={pending} type="submit"><Plus size={16} /> {pending ? "Creating..." : "Create place"}</button>
    </form></section>
  </main>;
}

export function PlaceSettings({ placeId }: { placeId: string }) {
  return <PlaceWorkspaceGate placeId={placeId} returnTo={routes.placeSettings(placeId)}>{({ context, reload }) => <PlaceSettingsContent context={context} reload={reload} />}</PlaceWorkspaceGate>;
}

function PlaceSettingsContent({ context, reload }: { context: PlaceContextContract; reload: () => Promise<void> }) {
  const canManagePlace = context.viewer.permissions.includes("place.manage");
  const canManageChat = context.viewer.permissions.includes("chat.manage");
  const canManageRoles = context.viewer.permissions.includes("role.manage");
  const canManageForums = context.viewer.permissions.includes("forum.manage");
  const [roles, setRoles] = useState<PlaceRoleContract[]>([]);
  const [rolesFailed, setRolesFailed] = useState(false);

  useEffect(() => {
    if (!canManageRoles) return;
    let active = true;
    void listPlaceRoles(context.place.id).then((page) => { if (active) setRoles(page.items); }).catch(() => { if (active) setRolesFailed(true); });
    return () => { active = false; };
  }, [canManageRoles, context.place.id]);

  if (!canManagePlace && !canManageRoles && !canManageForums && !canManageChat) return <main className="public-main place-workspace-page" id="main-content"><PlaceForumHeader active="settings" place={context.place} showMembershipActions={false} showSettings /><div className="place-page-state"><StatusPanel title="Settings unavailable" description="Your current roles do not grant place, forum, role, or chat management." /></div></main>;

  async function refreshAfterForbidden(error: unknown) {
    if (isForbiddenPlaceError(error)) await reload();
  }

  return <main className="public-main place-workspace-page" id="main-content">
    <PlaceForumHeader active="settings" place={context.place} showMembershipActions={false} showSettings />
    <header className="place-page-heading"><p className="eyebrow">Administration</p><h2>Place settings</h2><p>Identity, discussion structure, access policy, roles, and ownership-sensitive operations.</p></header>
    <div className="settings-layout">
      <nav aria-label="Place settings sections">{canManagePlace ? <><a href="#identity">Identity</a><a href="#preferences">Preferences</a></> : null}{canManageForums ? <a href="#forums">Forums</a> : null}{canManageChat ? <a href="#chat">Chat</a> : null}{canManageRoles ? <a href="#roles">Roles</a> : null}{canManagePlace ? <a href="#archive">Archive</a> : null}</nav>
      <div className="settings-sections">
        {canManagePlace ? <IdentityForm context={context} onForbidden={refreshAfterForbidden} onSaved={reload} /> : null}
        {canManagePlace ? <PreferenceForm context={context} onForbidden={refreshAfterForbidden} /> : null}
        {canManageForums ? <ForumSettings context={context} onForbidden={refreshAfterForbidden} /> : null}
        {canManageChat ? <ChatChannelSettings context={context} onForbidden={refreshAfterForbidden} /> : null}
        {canManageRoles ? <section className="settings-section" id="roles"><p className="eyebrow">Authorization</p><h2>Roles and permissions</h2><p className="settings-muted">Roles can only grant permissions and positions below your own. System roles are read-only.</p>{rolesFailed ? <p className="form-message form-message-error" role="alert">Roles could not be loaded.</p> : <div className="role-list">{roles.map((role) => <RoleEditor key={role.id} onChanged={async () => setRoles((await listPlaceRoles(context.place.id)).items)} onForbidden={refreshAfterForbidden} placeId={context.place.id} role={role} />)}</div>}<NewRoleForm onCreated={(role) => setRoles((items) => [...items, role].sort((a, b) => a.position - b.position))} onForbidden={refreshAfterForbidden} placeId={context.place.id} /></section> : null}
        {canManagePlace ? <ArchiveSection context={context} onForbidden={refreshAfterForbidden} /> : null}
      </div>
    </div>
  </main>;
}

function IdentityForm({ context, onForbidden, onSaved }: { context: PlaceContextContract; onForbidden: (error: unknown) => Promise<void>; onSaved: () => Promise<void> }) {
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setNotice(null);
    const form = new FormData(event.currentTarget);
    try { await updatePlace(context.place.id, { description: String(form.get("description") ?? ""), joinPolicy: String(form.get("joinPolicy")) as PlaceContextContract["place"]["joinPolicy"], name: String(form.get("name") ?? ""), visibility: String(form.get("visibility")) as PlaceContextContract["place"]["visibility"] }); await onSaved(); setNotice({ kind: "success", text: "Place identity and access policy saved." }); }
    catch (error) { await onForbidden(error); setNotice({ kind: "error", text: placeErrorMessage(error, "Place settings could not be saved.") }); }
    finally { setPending(false); }
  }
  async function assignImage(kind: "banner" | "icon", asset: AssetContract) {
    try { await setPlaceImage(context.place.id, kind, asset.id); }
    catch (error) { await onForbidden(error); throw error; }
  }
  const canUpload = context.viewer.permissions.includes("upload.create");
  return <section className="settings-section" id="identity"><p className="eyebrow">Presentation and access</p><h2>Identity and policy</h2>{canUpload ? <div className="place-image-uploaders"><ImageUploader description="Square JPEG, PNG, or WebP. Used in compact place navigation." label="Place icon" onUploaded={(asset) => assignImage("icon", asset)} placeId={context.place.id} /><ImageUploader description="Wide JPEG, PNG, or WebP. Used on place headers." label="Place banner" onUploaded={(asset) => assignImage("banner", asset)} placeId={context.place.id} shape="landscape" /></div> : <p className="settings-muted">Your role can edit place details but cannot upload media.</p>}<form className="settings-form" method="post" onSubmit={submit}><FormField defaultValue={context.place.name} label="Name" maxLength={120} name="name" required /><label className="form-field">Description<textarea defaultValue={context.place.description} maxLength={4000} name="description" rows={5} /></label><PlacePolicyFields place={context.place} /><NoticeMessage notice={notice} /><button className="primary-button" disabled={pending} type="submit"><Save size={16} /> {pending ? "Saving..." : "Save place"}</button></form></section>;
}

function PlacePolicyFields({ place }: { place?: PlaceContextContract["place"] }) {
  return <div className="policy-grid"><label className="form-field">Visibility<select defaultValue={place?.visibility ?? "public"} name="visibility"><option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></select><small>Private places are hidden from non-members.</small></label><label className="form-field">Join policy<select defaultValue={place?.joinPolicy ?? "open"} name="joinPolicy"><option value="open">Open</option><option value="approval">Approval required</option><option value="invite_only">Invite only</option></select><small>Approval requests appear in the member directory.</small></label></div>;
}

function PreferenceForm({ context, onForbidden }: { context: PlaceContextContract; onForbidden: (error: unknown) => Promise<void> }) {
  const [notice, setNotice] = useState<Notice>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setNotice(null);
    try { await updatePlaceSettings(context.place.id, { locale: String(form.get("locale") ?? "en-US"), topicSort: String(form.get("topicSort") ?? "activity") }); setNotice({ kind: "success", text: "Place preferences saved." }); }
    catch (error) { await onForbidden(error); setNotice({ kind: "error", text: placeErrorMessage(error, "Preferences could not be saved.") }); }
  }
  return <section className="settings-section" id="preferences"><p className="eyebrow">Defaults</p><h2>Community preferences</h2><form className="settings-form compact-form" onSubmit={submit}><label className="form-field">Locale<select defaultValue={String(context.place.settings.locale ?? "en-US")} name="locale"><option value="en-US">English (United States)</option><option value="en-GB">English (United Kingdom)</option></select></label><label className="form-field">Default topic order<select defaultValue={String(context.place.settings.topicSort ?? "activity")} name="topicSort"><option value="activity">Recent activity</option><option value="created">Newest topics</option></select></label><NoticeMessage notice={notice} /><button className="secondary-button" type="submit">Save preferences</button></form></section>;
}

function RoleEditor({ onChanged, onForbidden, placeId, role }: { onChanged: () => Promise<void>; onForbidden: (error: unknown) => Promise<void>; placeId: string; role: PlaceRoleContract }) {
  const [notice, setNotice] = useState<Notice>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try { await updatePlaceRole(placeId, role.id, { name: String(form.get("name")), position: Number(form.get("position")), permissions: permissionsFrom(form) }); await onChanged(); setNotice({ kind: "success", text: "Role saved." }); }
    catch (error) { await onForbidden(error); setNotice({ kind: "error", text: placeErrorMessage(error, "Role could not be saved.") }); }
  }
  async function remove() {
    try { await deletePlaceRole(placeId, role.id); await onChanged(); }
    catch (error) { await onForbidden(error); setNotice({ kind: "error", text: placeErrorMessage(error, "Role could not be deleted.") }); }
  }
  return <details className="role-editor"><summary><span><Shield size={16} /> <strong>{role.name}</strong></span><small>{role.permissions.length} permissions · position {role.position}</small></summary><form className="settings-form" onSubmit={submit}><FormField defaultValue={role.name} disabled={role.isSystem} label="Role name" name="name" required /><FormField defaultValue={role.position} disabled={role.isSystem} label="Position" min={0} name="position" type="number" required /><PermissionGrid disabled={role.isSystem} selected={role.permissions} /><NoticeMessage notice={notice} />{!role.isSystem ? <div className="button-row"><button className="secondary-button" type="submit"><Save size={16} /> Save role</button><button className="danger-button" onClick={() => void remove()} type="button"><Trash2 size={16} /> Delete</button></div> : <p className="settings-muted">System role permissions cannot be changed.</p>}</form></details>;
}

function NewRoleForm({ onCreated, onForbidden, placeId }: { onCreated: (role: PlaceRoleContract) => void; onForbidden: (error: unknown) => Promise<void>; placeId: string }) {
  const [notice, setNotice] = useState<Notice>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try { const role = await createPlaceRole(placeId, { name: String(form.get("name")), position: Number(form.get("position")), permissions: permissionsFrom(form) }); onCreated(role); event.currentTarget.reset(); setNotice({ kind: "success", text: "Role created." }); }
    catch (error) { await onForbidden(error); setNotice({ kind: "error", text: placeErrorMessage(error, "Role could not be created.") }); }
  }
  return <details className="role-editor new-role"><summary><span><Plus size={16} /> <strong>Create custom role</strong></span></summary><form className="settings-form" onSubmit={submit}><FormField label="Role name" maxLength={80} name="name" required /><FormField defaultValue={20} label="Position" min={0} name="position" type="number" required /><PermissionGrid selected={[]} /><NoticeMessage notice={notice} /><button className="primary-button" type="submit">Create role</button></form></details>;
}

function PermissionGrid({ disabled = false, selected }: { disabled?: boolean; selected: readonly string[] }) {
  return <fieldset className="permission-grid"><legend>Permissions</legend>{placePermissions.map((permission) => <label key={permission}><input defaultChecked={selected.includes(permission)} disabled={disabled} name="permissions" type="checkbox" value={permission} /><span>{permission.replace(".", " ")}</span></label>)}</fieldset>;
}

function ArchiveSection({ context, onForbidden }: { context: PlaceContextContract; onForbidden: (error: unknown) => Promise<void> }) {
  const router = useRouter(); const [confirmed, setConfirmed] = useState(false); const [notice, setNotice] = useState<Notice>(null);
  async function archive() { try { await archivePlace(context.place.id); router.replace(routes.home); router.refresh(); } catch (error) { await onForbidden(error); setNotice({ kind: "error", text: placeErrorMessage(error, "Place could not be archived.") }); } }
  return <section className="settings-section danger-section" id="archive"><p className="eyebrow">Restricted action</p><h2>Archive place</h2><p className="settings-muted">Archiving removes the place from discovery and blocks new activity. Existing records remain preserved.</p><label className="confirmation-check"><input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" /> I understand this affects every member.</label><NoticeMessage notice={notice} /><button className="danger-button" disabled={!confirmed} onClick={() => void archive()} type="button"><Archive size={16} /> Archive place</button></section>;
}

function permissionsFrom(form: FormData): PlacePermission[] {
  return form.getAll("permissions").filter((value): value is PlacePermission => typeof value === "string" && placePermissions.includes(value as PlacePermission));
}

function NoticeMessage({ notice }: { notice: Notice }) {
  return notice ? <p className={`form-message form-message-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p> : null;
}