import type { components } from '@displace/api-client';
import { Archive, Plus, Save, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useConfirmation, useToast } from '../../components/ui/feedback-context';
import { DesktopApiError } from '../../lib/api/desktop-api';
import { useRemoteResource } from '../../lib/remote-resource';
import type { ChatChannel, Forum, PlaceContext, PlacePermission, Role, VoiceRoom } from './place-client';
import { usePlaceClient } from './use-place-client';

type CreateForum = components['schemas']['CreateForumDto'];
type UpdateForum = components['schemas']['UpdateForumDto'];
type UpdateForumGroup = components['schemas']['UpdateForumGroupDto'];
type UpdateChatChannel = components['schemas']['UpdateChatChannelDto'];
type UpdateVoiceRoom = components['schemas']['UpdateVoiceRoomDto'];
type UpdateRole = components['schemas']['UpdateRoleDto'];

const placePermissions: PlacePermission[] = [
  'place.manage', 'role.manage', 'member.manage', 'forum.manage', 'topic.create', 'post.create',
  'chat.manage', 'chat.send', 'voice.manage', 'voice.join', 'upload.read', 'upload.create', 'moderation.manage',
];

export function ForumSettings({ context, onAuthorizationChange }: SettingsProps) {
  const client = usePlaceClient();
  const confirm = useConfirmation();
  const { pending, resource, run } = useSettingsResource(`forum-settings:${context.place.id}`, () => client.forumSettings(context.place.id), onAuthorizationChange, 'Forum settings could not be changed.');
  if (resource.state.status === 'loading') return <SettingsLoading title="Loading forum structure" />;
  if (resource.state.status === 'error') return <SettingsError title="Forum structure unavailable" retry={resource.reload} />;
  const navigation = resource.state.data;

  return <SettingsPanel eyebrow="Forum structure" title="Boards and tags" description="Organize conversations into groups, tune access, and maintain reusable topic tags.">
    <form className="settings-create-row" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); void run(() => client.createForumGroup(context.place.id, { description: text(data, 'description'), name: text(data, 'name'), position: navigation.groups.length }), 'Forum group created.').then(() => form.reset()); }}>
      <TextField label="New group" name="name" placeholder="Knowledge base" required /><TextField label="Description" name="description" placeholder="Long-lived references" /><button className="button primary compact" disabled={pending}><Plus size={14} />Add group</button>
    </form>
    <div className="settings-resource-list">{navigation.groups.map((group) => <details className="settings-resource" key={group.id} open>
      <summary><div><strong>{group.name}</strong><small>{group.forums.length} {group.forums.length === 1 ? 'forum' : 'forums'}</small></div></summary>
      <div className="settings-resource-body">
        <form className="management-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const input: UpdateForumGroup = { description: text(data, 'description'), name: text(data, 'name'), position: number(data, 'position') }; void run(() => client.updateForumGroup(context.place.id, group.id, input), 'Forum group saved.'); }}><TextField defaultValue={group.name} label="Group name" name="name" required /><TextField defaultValue={String(group.position)} label="Position" name="position" type="number" required /><label className="wide-field">Description<textarea defaultValue={group.description} name="description" rows={2} /></label><div className="button-row wide-field"><button className="button secondary compact" disabled={pending}><Save size={14} />Save group</button><button className="button danger compact" disabled={pending} onClick={() => void confirm({ confirmLabel: 'Delete group', message: 'The group must be empty before it can be deleted.', title: `Delete ${group.name}?` }).then((accepted) => accepted ? run(() => client.deleteForumGroup(context.place.id, group.id), 'Forum group deleted.') : undefined)} type="button"><Trash2 size={14} />Delete</button></div></form>
        <div className="settings-nested-list">{group.forums.map((forum) => <ForumEditor forum={forum} key={forum.id} pending={pending} onArchive={() => confirm({ confirmLabel: 'Archive forum', message: 'Existing topics remain preserved.', title: `Archive ${forum.name}?` }).then((accepted) => accepted ? run(() => client.archiveForum(context.place.id, forum.id), 'Forum archived.') : undefined)} onSave={(input) => run(() => client.updateForum(context.place.id, forum.id, input), 'Forum saved.')} />)}</div>
        <form className="settings-create-row" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const input: CreateForum = { groupId: group.id, name: text(data, 'name'), position: group.forums.length, visibility: 'members' }; void run(() => client.createForum(context.place.id, input), 'Forum created.').then(() => form.reset()); }}><TextField label="New forum" name="name" placeholder="General" required /><button className="button secondary compact" disabled={pending}><Plus size={14} />Add forum</button></form>
      </div>
    </details>)}</div>
    <section className="settings-subsection"><header><div><h3>Topic tags</h3><p>Labels members can apply when starting a topic.</p></div></header><form className="settings-create-row" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); void run(() => client.createForumTag(context.place.id, { color: text(data, 'color'), name: text(data, 'name'), slug: text(data, 'slug') }), 'Tag created.').then(() => form.reset()); }}><TextField label="Name" name="name" required /><TextField label="Slug" name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /><label>Color<input defaultValue="#2563EB" name="color" type="color" /></label><button className="button secondary compact" disabled={pending}><Plus size={14} />Add tag</button></form><div className="tag-settings-list">{navigation.tags.map((tag) => <span key={tag.id} style={{ borderColor: tag.color ?? '#66736f', color: tag.color ?? '#66736f' }}>{tag.name}<button aria-label={`Delete ${tag.name}`} disabled={pending} onClick={() => void confirm({ confirmLabel: 'Delete tag', message: 'Existing topics will lose this tag.', title: `Delete ${tag.name}?` }).then((accepted) => accepted ? run(() => client.deleteForumTag(context.place.id, tag.id), 'Tag deleted.') : undefined)}><Trash2 size={12} /></button></span>)}</div></section>
  </SettingsPanel>;
}

function ForumEditor({ forum, onArchive, onSave, pending }: { forum: Forum; onArchive(): Promise<void | undefined>; onSave(input: UpdateForum): Promise<void>; pending: boolean }) {
  return <details className="settings-nested-resource"><summary><span><strong>{forum.name}</strong><small>{forum.visibility}</small></span></summary><form className="management-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void onSave({ description: text(data, 'description'), name: text(data, 'name'), position: number(data, 'position'), readPermission: permission(data, 'readPermission'), visibility: text(data, 'visibility') as Forum['visibility'], writePermission: permission(data, 'writePermission') }); }}><TextField defaultValue={forum.name} label="Name" name="name" required /><TextField defaultValue={String(forum.position)} label="Position" name="position" type="number" required /><label className="wide-field">Description<textarea defaultValue={forum.description} name="description" rows={2} /></label><SelectField defaultValue={forum.visibility} label="Visibility" name="visibility" options={[['members', 'Members'], ['public', 'Public']]} /><PermissionField defaultValue={forum.readPermission} label="Read permission" name="readPermission" optional /><PermissionField defaultValue={forum.writePermission} label="Write permission" name="writePermission" optional /><div className="button-row wide-field"><button className="button secondary compact" disabled={pending}><Save size={14} />Save forum</button><button className="button danger compact" disabled={pending} onClick={() => void onArchive()} type="button"><Archive size={14} />Archive</button></div></form></details>;
}

export function ChatSettings({ context, onAuthorizationChange }: SettingsProps) {
  const client = usePlaceClient();
  const confirm = useConfirmation();
  const { pending, resource, run } = useSettingsResource(`chat-settings:${context.place.id}`, () => client.chatChannels(context.place.id), onAuthorizationChange, 'Chat settings could not be changed.');
  if (resource.state.status === 'loading') return <SettingsLoading title="Loading chat channels" />;
  if (resource.state.status === 'error') return <SettingsError title="Chat channels unavailable" retry={resource.reload} />;
  const channels = resource.state.data;
  return <SettingsPanel eyebrow="Live conversation" title="Chat channels" description="Create channels and configure who can read or send messages."><form className="settings-create-row" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); void run(() => client.createChatChannel(context.place.id, { name: text(data, 'name'), position: channels.length, slug: text(data, 'slug'), visibility: 'members' }), 'Channel created.').then(() => form.reset()); }}><TextField label="Name" name="name" required /><TextField label="Slug" name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /><button className="button primary compact" disabled={pending}><Plus size={14} />Add channel</button></form><div className="settings-resource-list">{channels.map((channel) => <ChannelEditor channel={channel} key={channel.id} pending={pending} onArchive={() => confirm({ confirmLabel: 'Archive channel', message: 'Existing messages remain preserved.', title: `Archive ${channel.name}?` }).then((accepted) => accepted ? run(() => client.archiveChatChannel(context.place.id, channel.id), 'Channel archived.') : undefined)} onSave={(input) => run(() => client.updateChatChannel(context.place.id, channel.id, input), 'Channel saved.')} />)}</div></SettingsPanel>;
}

function ChannelEditor({ channel, onArchive, onSave, pending }: { channel: ChatChannel; onArchive(): Promise<void | undefined>; onSave(input: UpdateChatChannel): Promise<void>; pending: boolean }) {
  return <details className="settings-resource"><summary><div><strong>#{channel.name}</strong><small>{channel.visibility}</small></div></summary><form className="management-form settings-resource-body" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void onSave({ name: text(data, 'name'), position: number(data, 'position'), readPermission: permission(data, 'readPermission'), sendPermission: permission(data, 'sendPermission'), visibility: text(data, 'visibility') as ChatChannel['visibility'] }); }}><TextField defaultValue={channel.name} label="Name" name="name" required /><TextField defaultValue={String(channel.position)} label="Position" name="position" type="number" required /><SelectField defaultValue={channel.visibility} label="Visibility" name="visibility" options={[['members', 'Members'], ['public', 'Public']]} /><PermissionField defaultValue={channel.readPermission} label="Read permission" name="readPermission" optional /><PermissionField defaultValue={channel.sendPermission} label="Send permission" name="sendPermission" optional /><div className="button-row wide-field"><button className="button secondary compact" disabled={pending}><Save size={14} />Save channel</button><button className="button danger compact" disabled={pending} onClick={() => void onArchive()} type="button"><Archive size={14} />Archive</button></div></form></details>;
}

export function VoiceSettings({ context, onAuthorizationChange }: SettingsProps) {
  const client = usePlaceClient();
  const confirm = useConfirmation();
  const { pending, resource, run } = useSettingsResource(`voice-settings:${context.place.id}`, () => client.voiceRooms(context.place.id), onAuthorizationChange, 'Voice settings could not be changed.');
  if (resource.state.status === 'loading') return <SettingsLoading title="Loading voice rooms" />;
  if (resource.state.status === 'error') return <SettingsError title="Voice rooms unavailable" retry={resource.reload} />;
  const rooms = resource.state.data;
  return <SettingsPanel eyebrow="Live audio" title="Voice rooms" description="Set room capacity and decide who can listen or speak."><form className="settings-create-row" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); void run(() => client.createVoiceRoom(context.place.id, { capacity: 25, listenPermission: 'voice.join', name: text(data, 'name'), position: rooms.length, slug: text(data, 'slug'), speakPermission: 'voice.join' }), 'Voice room created.').then(() => form.reset()); }}><TextField label="Name" name="name" required /><TextField label="Slug" name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /><button className="button primary compact" disabled={pending}><Plus size={14} />Add room</button></form><div className="settings-resource-list">{rooms.map((room) => <VoiceRoomEditor key={room.id} room={room} pending={pending} onArchive={() => confirm({ confirmLabel: 'Archive room', message: 'Members will no longer be able to join.', title: `Archive ${room.name}?` }).then((accepted) => accepted ? run(() => client.archiveVoiceRoom(context.place.id, room.id), 'Voice room archived.') : undefined)} onSave={(input) => run(() => client.updateVoiceRoom(context.place.id, room.id, input), 'Voice room saved.')} />)}</div></SettingsPanel>;
}

function VoiceRoomEditor({ onArchive, onSave, pending, room }: { onArchive(): Promise<void | undefined>; onSave(input: UpdateVoiceRoom): Promise<void>; pending: boolean; room: VoiceRoom }) {
  return <details className="settings-resource"><summary><div><strong>{room.name}</strong><small>{room.participants.length}/{room.capacity} connected</small></div></summary><form className="management-form settings-resource-body" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void onSave({ capacity: number(data, 'capacity'), listenPermission: permission(data, 'listenPermission') ?? 'voice.join', name: text(data, 'name'), position: number(data, 'position'), speakPermission: permission(data, 'speakPermission') ?? 'voice.join' }); }}><TextField defaultValue={room.name} label="Name" name="name" required /><TextField defaultValue={String(room.position)} label="Position" name="position" type="number" required /><TextField defaultValue={String(room.capacity)} label="Capacity" name="capacity" type="number" required /><PermissionField defaultValue={room.listenPermission} label="Listen permission" name="listenPermission" /><PermissionField defaultValue={room.speakPermission} label="Speak permission" name="speakPermission" /><div className="button-row wide-field"><button className="button secondary compact" disabled={pending}><Save size={14} />Save room</button><button className="button danger compact" disabled={pending} onClick={() => void onArchive()} type="button"><Archive size={14} />Archive</button></div></form></details>;
}

export function RoleSettings({ context, onAuthorizationChange }: SettingsProps) {
  const client = usePlaceClient();
  const confirm = useConfirmation();
  const { pending, resource, run } = useSettingsResource(`role-settings:${context.place.id}`, () => client.roles(context.place.id), onAuthorizationChange, 'Roles could not be changed.');
  if (resource.state.status === 'loading') return <SettingsLoading title="Loading roles" />;
  if (resource.state.status === 'error') return <SettingsError title="Roles unavailable" retry={resource.reload} />;
  const roles = resource.state.data.items;
  return <SettingsPanel eyebrow="Capabilities" title="Roles and permissions" description="Group permissions into roles that can be assigned from the member directory."><form className="settings-create-row" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); void run(() => client.createRole(context.place.id, { name: text(data, 'name'), permissions: [], position: roles.length }), 'Role created.').then(() => form.reset()); }}><TextField label="Role name" name="name" required /><button className="button primary compact" disabled={pending}><Plus size={14} />Add role</button></form><div className="settings-resource-list">{roles.map((role) => <RoleEditor key={role.id} role={role} pending={pending} onDelete={() => confirm({ confirmLabel: 'Delete role', message: 'Assigned members will lose this role’s capabilities.', title: `Delete ${role.name}?` }).then((accepted) => accepted ? run(() => client.deleteRole(context.place.id, role.id), 'Role deleted.') : undefined)} onSave={(input) => run(() => client.updateRole(context.place.id, role.id, input), 'Role saved.')} />)}</div></SettingsPanel>;
}

function RoleEditor({ onDelete, onSave, pending, role }: { onDelete(): Promise<void | undefined>; onSave(input: UpdateRole): Promise<void>; pending: boolean; role: Role }) {
  return <details className="settings-resource"><summary><div><strong>{role.name}</strong><small>{role.isSystem ? 'System role' : `${role.permissions.length} capabilities`}</small></div></summary><form className="management-form settings-resource-body" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void onSave({ name: text(data, 'name'), permissions: placePermissions.filter((item) => data.has(item)), position: number(data, 'position') }); }}><TextField defaultValue={role.name} label="Name" name="name" required /><TextField defaultValue={String(role.position)} label="Position" name="position" type="number" required /><fieldset className="permission-grid wide-field" disabled={role.isSystem}><legend>Capabilities</legend>{placePermissions.map((item) => <label key={item}><input defaultChecked={role.permissions.includes(item)} name={item} type="checkbox" />{item.replace('.', ' ')}</label>)}</fieldset><div className="button-row wide-field"><button className="button secondary compact" disabled={pending || role.isSystem}><Save size={14} />Save role</button>{!role.isSystem ? <button className="button danger compact" disabled={pending} onClick={() => void onDelete()} type="button"><Trash2 size={14} />Delete</button> : null}</div></form></details>;
}

function useSettingsResource<T>(key: string, load: () => Promise<T>, onAuthorizationChange: () => void, fallback: string) {
  const notify = useToast();
  const [pending, setPending] = useState(false);
  const resource = useRemoteResource(key, load);
  async function run(action: () => Promise<unknown>, success: string) {
    setPending(true);
    try { await action(); notify(success); resource.reload(); }
    catch (error) { notify(errorMessage(error, fallback)); if (isAuthorizationChange(error)) onAuthorizationChange(); }
    finally { setPending(false); }
  }
  return { pending, resource, run };
}

function PermissionField({ defaultValue, label, name, optional = false }: { defaultValue?: string | null; label: string; name: string; optional?: boolean }) { return <SelectField defaultValue={defaultValue ?? ''} label={label} name={name} options={[...(optional ? [['', 'No additional permission'] as [string, string]] : []), ...placePermissions.map((item): [string, string] => [item, item.replace('.', ' ')])]} />; }
function TextField(props: { defaultValue?: string; label: string; name: string; pattern?: string; placeholder?: string; required?: boolean; type?: string }) { return <label>{props.label}<input defaultValue={props.defaultValue} name={props.name} pattern={props.pattern} placeholder={props.placeholder} required={props.required} type={props.type ?? 'text'} /></label>; }
function SelectField({ defaultValue, label, name, options }: { defaultValue?: string; label: string; name: string; options: [string, string][] }) { return <label>{label}<select defaultValue={defaultValue} name={name}>{options.map(([value, labelText]) => <option key={value} value={value}>{labelText}</option>)}</select></label>; }
function SettingsPanel({ children, description, eyebrow, title }: { children: ReactNode; description: string; eyebrow: string; title: string }) { return <section className="management-section settings-panel"><header><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div></header>{children}</section>; }
function SettingsLoading({ title }: { title: string }) { return <section className="management-section"><p className="settings-muted">{title}...</p></section>; }
function SettingsError({ retry, title }: { retry(): void; title: string }) { return <section className="management-section"><h2>{title}</h2><button className="button secondary" onClick={retry}>Try again</button></section>; }
function permission(form: FormData, field: string): PlacePermission | null { const value = text(form, field); return placePermissions.includes(value as PlacePermission) ? value as PlacePermission : null; }
function text(form: FormData, field: string): string { return String(form.get(field) ?? ''); }
function number(form: FormData, field: string): number { return Number(form.get(field) ?? 0); }
function errorMessage(error: unknown, fallback: string): string { return error instanceof DesktopApiError ? error.problem?.detail ?? error.message : fallback; }
function isAuthorizationChange(error: unknown): boolean { return error instanceof DesktopApiError && ['forbidden', 'gone', 'not-found', 'unauthenticated'].includes(error.kind); }

interface SettingsProps { context: PlaceContext; onAuthorizationChange(): void }
