"use client";

import { Archive, Plus, Save, Shield, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { SettingsDialog } from "@/components/ui/settings-dialog";
import { SortableList } from "@/components/ui/sortable-list";
import { StatusPanel } from "@/components/ui/status-panel";
import { TagInput } from "@/components/ui/tag-input";
import { toast } from "@/components/ui/toast";
import { setPlaceImage } from "@/features/assets/asset-client";
import type { AssetContract } from "@/features/assets/asset-contract";
import { ImageUploader } from "@/features/assets/image-uploader";
import { useSession } from "@/features/auth/session-provider";
import { ChatChannelSettings } from "@/features/chat/chat-channel-settings";
import { VoiceRoomSettings } from "@/features/voice/voice-room-settings";
import { ForumSettings } from "@/features/forums/forum-settings";
import { routes, type PlaceSettingsSection } from "@/lib/routes";
import { PlaceWorkspaceGate, placeErrorMessage } from "./place-access";
import { PlaceForumHeader } from "./place-forum-header";
import { notifyPlaceIconUpdated } from "./place-icon";
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

interface PlaceSettingsWorkspace {
  context: PlaceContextContract;
  refreshAfterForbidden: (error: unknown) => Promise<void>;
  reload: () => Promise<void>;
}

const PlaceSettingsContext = createContext<PlaceSettingsWorkspace | null>(null);
const settingsSections: Array<{ label: string; permission: PlacePermission; section: PlaceSettingsSection }> = [
  { label: "Identity", permission: "place.manage", section: "identity" },
  { label: "Preferences", permission: "place.manage", section: "preferences" },
  { label: "Forums", permission: "forum.manage", section: "forums" },
  { label: "Chat", permission: "chat.manage", section: "chat" },
  { label: "Voice", permission: "voice.manage", section: "voice" },
  { label: "Roles", permission: "role.manage", section: "roles" },
  { label: "Archive", permission: "place.manage", section: "archive" },
];

export function CreatePlacePanel() {
  const session = useSession();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const configuredSlug = singlePlaceSlug();

  if (configuredSlug) return <main className="public-main standalone-public-state" id="main-content"><StatusPanel title="Place creation disabled" description="This installation is configured for one place." action={<a className="primary-button" href={routes.place(configuredSlug)}>Open place</a>} /></main>;
  if (session.status === "loading") return <main className="public-main standalone-public-state" id="main-content"><p className="settings-muted">Loading account...</p></main>;
  if (session.status !== "authenticated") return <main className="public-main standalone-public-state" id="main-content"><StatusPanel title="Sign in required" description="Use a verified account to create a place." action={<a className="primary-button" href={`${routes.signIn}?returnTo=${encodeURIComponent(routes.createPlace)}`}>Sign in</a>} /></main>;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true);
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
    } catch (error) { toast.error(placeErrorMessage(error, "The place could not be created.")); }
    finally { setPending(false); }
  }

  return <main className="public-main place-workspace-page place-create-page" id="main-content">
    <header className="place-page-heading standalone"><p className="eyebrow">New community</p><h1>Create a place</h1><p>Choose a stable identity and how the first members can enter.</p></header>
    <section className="settings-section place-create-section"><form className="settings-form" method="post" onSubmit={submit}>
      <FormField label="Name" maxLength={120} minLength={1} name="name" required />
      <FormField hint="Lowercase letters, numbers, and hyphens. This becomes the permanent URL." label="Slug" maxLength={80} minLength={3} name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
      <label className="form-field">Description<textarea maxLength={4000} name="description" rows={5} /></label>
      <PlacePolicyFields />
      <button className="primary-button" disabled={pending} type="submit"><Plus size={16} /> {pending ? "Creating..." : "Create place"}</button>
    </form></section>
  </main>;
}

export function PlaceSettingsLayout({ children, placeId }: { children: ReactNode; placeId: string }) {
  const pathname = usePathname();
  return <PlaceWorkspaceGate placeId={placeId} returnTo={pathname}>{({ context, reload }) => <PlaceSettingsFrame context={context} reload={reload}>{children}</PlaceSettingsFrame>}</PlaceWorkspaceGate>;
}

export function PlaceSettings({ placeId, section = "identity" }: { placeId: string; section?: PlaceSettingsSection }) {
  return <PlaceSettingsLayout placeId={placeId}><PlaceSettingsSectionContent section={section} /></PlaceSettingsLayout>;
}

export function PlaceSettingsIndex() {
  const router = useRouter();
  const { context } = usePlaceSettings();
  const firstSection = availableSettingsSections(context)[0];

  useEffect(() => {
    if (firstSection) router.replace(routes.placeSettingsSection(context.place.slug, firstSection.section));
  }, [context.place.slug, firstSection, router]);

  return <section className="settings-section"><p className="settings-muted">Opening place settings...</p></section>;
}

export function PlaceSettingsSectionContent({ section }: { section: PlaceSettingsSection }) {
  const workspace = usePlaceSettings();
  const { context, refreshAfterForbidden, reload } = workspace;
  const permitted = settingsSections.some((item) => item.section === section && context.viewer.permissions.includes(item.permission));

  if (!permitted) {
    const fallback = availableSettingsSections(context)[0];
    return <StatusPanel title="Section unavailable" description="Your current role does not grant access to this settings section." action={fallback ? <Link className="secondary-button" href={routes.placeSettingsSection(context.place.slug, fallback.section)}>Open available settings</Link> : undefined} />;
  }

  switch (section) {
    case "identity": return <IdentityForm context={context} onForbidden={refreshAfterForbidden} onSaved={reload} />;
    case "preferences": return <PreferenceForm context={context} onForbidden={refreshAfterForbidden} onSaved={reload} />;
    case "forums": return <ForumSettings context={context} onForbidden={refreshAfterForbidden} />;
    case "chat": return <ChatChannelSettings context={context} onForbidden={refreshAfterForbidden} />;
    case "voice": return <VoiceRoomSettings context={context} onForbidden={refreshAfterForbidden} />;
    case "roles": return <RolesSettings context={context} onForbidden={refreshAfterForbidden} />;
    case "archive": return <ArchiveSection context={context} onForbidden={refreshAfterForbidden} />;
  }
}

function PlaceSettingsFrame({ children, context, reload }: { children: ReactNode; context: PlaceContextContract; reload: () => Promise<void> }) {
  const pathname = usePathname();
  const availableSections = availableSettingsSections(context);

  if (availableSections.length === 0) return <main className="public-main place-workspace-page" id="main-content"><PlaceForumHeader active="settings" place={context.place} showSettings /><div className="place-page-state"><StatusPanel title="Settings unavailable" description="Your current roles do not grant place, forum, role, chat, or voice management." /></div></main>;

  async function refreshAfterForbidden(error: unknown) {
    if (isForbiddenPlaceError(error)) await reload();
  }

  return <PlaceSettingsContext.Provider value={{ context, refreshAfterForbidden, reload }}>
    <main className="public-main place-workspace-page" id="main-content">
      <PlaceForumHeader active="settings" place={context.place} showSettings />
      <header className="place-page-heading"><p className="eyebrow">Administration</p><h2>Place settings</h2><p>Manage one part of your community at a time.</p></header>
      <div className="settings-layout">
        <nav aria-label="Place settings sections">{availableSections.map((item) => {
          const href = routes.placeSettingsSection(context.place.slug, item.section);
          return <Link aria-current={pathname === href ? "page" : undefined} href={href} key={item.section}>{item.label}</Link>;
        })}</nav>
        <div className="settings-sections">{children}</div>
      </div>
    </main>
  </PlaceSettingsContext.Provider>;
}

function RolesSettings({ context, onForbidden }: { context: PlaceContextContract; onForbidden: (error: unknown) => Promise<void> }) {
  const [roles, setRoles] = useState<PlaceRoleContract[]>([]);
  const [rolesFailed, setRolesFailed] = useState(false);
  const [reordering, setReordering] = useState(false);

  async function refreshRoles() { setRoles((await listPlaceRoles(context.place.id)).items); }

  useEffect(() => {
    let active = true;
    void listPlaceRoles(context.place.id).then((page) => { if (active) setRoles(page.items); }).catch(() => { if (active) setRolesFailed(true); });
    return () => { active = false; };
  }, [context.place.id]);

  const systemRoles = roles.filter((role) => role.isSystem);
  const customRoles = roles.filter((role) => !role.isSystem);
  const nextPosition = Math.max(20, ...customRoles.map((role) => role.position + 1));

  async function reorderRoles(orderedRoles: PlaceRoleContract[]) {
    const positions = [...customRoles].sort((a, b) => a.position - b.position).map((role) => role.position);
    setReordering(true);
    try {
      await Promise.all(orderedRoles.map((role, index) => role.position === positions[index] ? Promise.resolve() : updatePlaceRole(context.place.id, role.id, { position: positions[index] })));
      await refreshRoles();
      toast.success("Roles reordered.");
    } catch (error) {
      await onForbidden(error);
      await refreshRoles();
      toast.error(placeErrorMessage(error, "Roles could not be reordered."));
    } finally { setReordering(false); }
  }

  return <section className="settings-section" id="roles"><header className="settings-section-title-row"><div><p className="eyebrow">Authorization</p><h2>Roles and permissions</h2><p className="settings-muted">System roles define the built-in hierarchy. Drag custom roles to change their order, then open one to edit its permissions.</p></div><NewRoleForm nextPosition={nextPosition} onCreated={(role) => setRoles((items) => [...items, role].sort((a, b) => a.position - b.position))} onForbidden={onForbidden} placeId={context.place.id} /></header>{rolesFailed ? <p className="form-message form-message-error" role="alert">Roles could not be loaded.</p> : <div className="role-groups">{customRoles.length ? <section className="settings-list-group" aria-labelledby="custom-roles-heading"><h3 id="custom-roles-heading">Custom roles</h3><SortableList disabled={reordering} items={customRoles} label="Custom role order" onReorder={reorderRoles} renderItem={(role, handle) => <div className="settings-order-row">{handle}<RoleEditor onChanged={refreshRoles} onForbidden={onForbidden} placeId={context.place.id} role={role} /></div>} /></section> : <p className="settings-muted settings-empty-note">No custom roles yet.</p>}<section className="settings-list-group" aria-labelledby="system-roles-heading"><div><h3 id="system-roles-heading">System roles</h3><p className="settings-muted">Built in and fixed in place.</p></div><div className="role-list">{systemRoles.map((role) => <RoleEditor key={role.id} onChanged={refreshRoles} onForbidden={onForbidden} placeId={context.place.id} role={role} />)}</div></section></div>}</section>;
}

function availableSettingsSections(context: PlaceContextContract) {
  return settingsSections.filter((item) => context.viewer.permissions.includes(item.permission));
}

function usePlaceSettings() {
  const workspace = useContext(PlaceSettingsContext);
  if (!workspace) throw new Error("Place settings must be rendered inside PlaceSettingsLayout.");
  return workspace;
}

function IdentityForm({ context, onForbidden, onSaved }: { context: PlaceContextContract; onForbidden: (error: unknown) => Promise<void>; onSaved: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true);
    const form = new FormData(event.currentTarget);
    try { await updatePlace(context.place.id, { description: String(form.get("description") ?? ""), joinPolicy: String(form.get("joinPolicy")) as PlaceContextContract["place"]["joinPolicy"], name: String(form.get("name") ?? ""), visibility: String(form.get("visibility")) as PlaceContextContract["place"]["visibility"] }); await onSaved(); toast.success("Place settings saved."); }
    catch (error) { await onForbidden(error); toast.error(placeErrorMessage(error, "Place settings could not be saved.")); }
    finally { setPending(false); }
  }
  async function assignImage(kind: "banner" | "icon", asset: AssetContract) {
    try {
      await setPlaceImage(context.place.id, kind, asset.id);
      if (kind === "icon") notifyPlaceIconUpdated(context.place.id);
    }
    catch (error) { await onForbidden(error); throw error; }
  }
  const canUpload = context.viewer.permissions.includes("upload.create");
  return <section className="settings-section" id="identity"><p className="eyebrow">Presentation and access</p><h2>Identity and policy</h2>{canUpload ? <div className="place-image-uploaders"><ImageUploader currentImage="place-icon" description="Square JPEG, PNG, or WebP. Used in compact place navigation." label="Place icon" onUploaded={(asset) => assignImage("icon", asset)} placeId={context.place.id} /><ImageUploader currentImage="place-banner" description="Wide JPEG, PNG, or WebP. Used on place headers." label="Place banner" onUploaded={(asset) => assignImage("banner", asset)} placeId={context.place.id} shape="landscape" /></div> : <p className="settings-muted">Your role can edit place details but cannot upload media.</p>}<form className="settings-form" method="post" onSubmit={submit}><FormField defaultValue={context.place.name} label="Name" maxLength={120} name="name" required /><label className="form-field">Description<textarea defaultValue={context.place.description} maxLength={4000} name="description" rows={5} /></label><PlacePolicyFields place={context.place} /><button className="primary-button" disabled={pending} type="submit"><Save size={16} /> {pending ? "Saving..." : "Save place"}</button></form></section>;
}

function PlacePolicyFields({ place }: { place?: PlaceContextContract["place"] }) {
  return <div className="policy-grid"><label className="form-field">Visibility<Select defaultValue={place?.visibility ?? "public"} name="visibility" options={[{ label: "Public", value: "public" }, { label: "Unlisted", value: "unlisted" }, { label: "Private", value: "private" }]} /><small>Private places are hidden from non-members.</small></label><label className="form-field">Join policy<Select defaultValue={place?.joinPolicy ?? "open"} name="joinPolicy" options={[{ label: "Open", value: "open" }, { label: "Approval required", value: "approval" }, { label: "Invite only", value: "invite_only" }]} /><small>Approval requests appear in the member directory.</small></label></div>;
}

function PreferenceForm({ context, onForbidden, onSaved }: { context: PlaceContextContract; onForbidden: (error: unknown) => Promise<void>; onSaved: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); const form = new FormData(event.currentTarget);
    const tags = form.getAll("tags").map(String);
    try { await updatePlaceSettings(context.place.id, { ...context.place.settings, locale: String(form.get("locale") ?? "en-US"), tags, topicSort: String(form.get("topicSort") ?? "activity") }); await onSaved(); toast.success("Place preferences saved."); }
    catch (error) { await onForbidden(error); toast.error(placeErrorMessage(error, "Preferences could not be saved.")); }
    finally { setPending(false); }
  }
  const tags = Array.isArray(context.place.settings.tags) ? context.place.settings.tags.filter((tag): tag is string => typeof tag === "string") : [];
  return <section className="settings-section settings-section-organized" id="preferences">
    <header className="settings-section-heading"><div><p className="eyebrow">Defaults and discovery</p><h2>Community preferences</h2><p className="settings-muted">Help people find this place and choose how conversations appear by default.</p></div></header>
    <form className="settings-preferences-form" onSubmit={submit}>
      <section className="settings-preference-group" aria-labelledby="discovery-preferences-heading">
        <div><h3 id="discovery-preferences-heading">Discoverability</h3><p>Use a few focused tags that describe what this community is actually about.</p></div>
        <TagInput initialTags={tags} label="Discovery tags" maxTags={8} name="tags" />
      </section>
      <section className="settings-preference-group" aria-labelledby="display-preferences-heading">
        <div><h3 id="display-preferences-heading">Reading defaults</h3><p>Set the language conventions and the first topic order members see.</p></div>
        <div className="settings-preference-fields"><label className="form-field">Locale<Select defaultValue={String(context.place.settings.locale ?? "en-US")} name="locale" options={[{ label: "English (United States)", value: "en-US" }, { label: "English (United Kingdom)", value: "en-GB" }]} /></label><label className="form-field">Default topic order<Select defaultValue={String(context.place.settings.topicSort ?? "activity")} name="topicSort" options={[{ label: "Recent activity", value: "activity" }, { label: "Newest topics", value: "created" }]} /></label></div>
      </section>
      <footer className="settings-form-actions"><button className="primary-button" disabled={pending} type="submit"><Save size={16} />{pending ? "Saving..." : "Save preferences"}</button></footer>
    </form>
  </section>;
}

function RoleEditor({ onChanged, onForbidden, placeId, role }: { onChanged: () => Promise<void>; onForbidden: (error: unknown) => Promise<void>; placeId: string; role: PlaceRoleContract }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try { await updatePlaceRole(placeId, role.id, { name: String(form.get("name")), position: Number(form.get("position")), permissions: permissionsFrom(form) }); await onChanged(); toast.success("Role saved."); }
    catch (error) { await onForbidden(error); toast.error(placeErrorMessage(error, "Role could not be saved.")); }
  }
  async function remove() {
    try { await deletePlaceRole(placeId, role.id); await onChanged(); }
    catch (error) { await onForbidden(error); toast.error(placeErrorMessage(error, "Role could not be deleted.")); }
  }
  return <details className="role-editor"><summary><span><Shield size={16} /> <strong>{role.name}</strong></span><small>{role.permissions.length} permissions</small></summary><form className="settings-form" onSubmit={submit}><FormField defaultValue={role.name} disabled={role.isSystem} label="Role name" name="name" required /><input name="position" type="hidden" value={role.position} /><PermissionGrid disabled={role.isSystem} selected={role.permissions} />{!role.isSystem ? <div className="button-row"><button className="secondary-button" type="submit"><Save size={16} /> Save role</button><button className="danger-button" onClick={() => void remove()} type="button"><Trash2 size={16} /> Delete</button></div> : <p className="settings-muted">System role permissions cannot be changed.</p>}</form></details>;
}

function NewRoleForm({ nextPosition, onCreated, onForbidden, placeId }: { nextPosition: number; onCreated: (role: PlaceRoleContract) => void; onForbidden: (error: unknown) => Promise<void>; placeId: string }) {
  const [open, setOpen] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try { const role = await createPlaceRole(placeId, { name: String(form.get("name")), position: nextPosition, permissions: permissionsFrom(form) }); onCreated(role); event.currentTarget.reset(); setOpen(false); toast.success("Role created."); }
    catch (error) { await onForbidden(error); toast.error(placeErrorMessage(error, "Role could not be created.")); }
  }
  return <SettingsDialog description="Name the role and select only the permissions its members need." onOpenChange={setOpen} open={open} title="New custom role" trigger={<button className="primary-button" type="button"><Plus size={16} /> New role</button>}><form className="settings-form settings-dialog-form" onSubmit={submit}><FormField label="Role name" maxLength={80} name="name" required /><PermissionGrid selected={[]} /><button className="primary-button" type="submit"><Plus size={16} /> Create role</button></form></SettingsDialog>;
}

function PermissionGrid({ disabled = false, selected }: { disabled?: boolean; selected: readonly string[] }) {
  return <fieldset className="permission-grid"><legend>Permissions</legend>{placePermissions.map((permission) => <label key={permission}><input defaultChecked={selected.includes(permission)} disabled={disabled} name="permissions" type="checkbox" value={permission} /><span>{permission.replace(".", " ")}</span></label>)}</fieldset>;
}

function ArchiveSection({ context, onForbidden }: { context: PlaceContextContract; onForbidden: (error: unknown) => Promise<void> }) {
  const router = useRouter(); const [confirmed, setConfirmed] = useState(false);
  async function archive() { try { await archivePlace(context.place.id); router.replace(routes.home); router.refresh(); } catch (error) { await onForbidden(error); toast.error(placeErrorMessage(error, "Place could not be archived.")); } }
  return <section className="settings-section danger-section" id="archive"><p className="eyebrow">Restricted action</p><h2>Archive place</h2><p className="settings-muted">Archiving removes the place from discovery and blocks new activity. Existing records remain preserved.</p><label className="confirmation-check"><input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" /> I understand this affects every member.</label><button className="danger-button" disabled={!confirmed} onClick={() => void archive()} type="button"><Archive size={16} /> Archive place</button></section>;
}

function permissionsFrom(form: FormData): PlacePermission[] {
  return form.getAll("permissions").filter((value): value is PlacePermission => typeof value === "string" && placePermissions.includes(value as PlacePermission));
}
