import type { components } from '@displace/api-client';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { Archive, ChevronDown, Plus, Save, Trash2 } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Checkbox } from '../../components/ui/checkbox';
import { ColorPicker } from '../../components/ui/color-picker';
import { useConfirmation, useToast } from '../../components/ui/feedback-context';
import { Select } from '../../components/ui/select';
import { SettingsDialog } from '../../components/ui/settings-dialog';
import { SortableList } from '../../components/ui/sortable-list';
import { DesktopApiError } from '../../lib/api/desktop-api';
import { useRemoteResource } from '../../lib/remote-resource';
import type { ChatChannel, Forum, ForumGroup, PlaceContext, PlacePermission, Role, VoiceRoom } from './place-client';
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

const visibilityOptions = [
  { label: 'Members', value: 'members' },
  { label: 'Public', value: 'public' },
];

export function ForumSettings({ context, onAuthorizationChange }: SettingsProps) {
  const client = usePlaceClient();
  const confirm = useConfirmation();
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createTagOpen, setCreateTagOpen] = useState(false);
  const { pending, resource, run } = useSettingsResource(
    `forum-settings:${context.place.id}`,
    () => client.forumSettings(context.place.id),
    onAuthorizationChange,
    'Forum settings could not be changed.',
  );

  if (resource.state.status === 'loading') return <SettingsLoading title="Loading forum structure" />;
  if (resource.state.status === 'error') return <SettingsError title="Forum structure unavailable" retry={resource.reload} />;
  const navigation = resource.state.data;

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (await run(
      () => client.createForumGroup(context.place.id, { description: text(data, 'description'), name: text(data, 'name'), position: navigation.groups.length }),
      'Forum group created.',
    )) {
      form.reset();
      setCreateGroupOpen(false);
    }
  }

  async function createTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (await run(
      () => client.createForumTag(context.place.id, { color: text(data, 'color'), name: text(data, 'name'), slug: text(data, 'slug') }),
      'Tag created.',
    )) {
      form.reset();
      setCreateTagOpen(false);
    }
  }

  async function reorderGroups(groups: ForumGroup[]) {
    const succeeded = await run(
      () => Promise.all(groups.map((group, position) => client.updateForumGroup(context.place.id, group.id, { position }))),
      'Forum groups reordered.',
    );
    if (!succeeded) throw new Error('Forum groups could not be reordered.');
  }

  return <SettingsPanel
    action={<SettingsDialog
      description="Create a section to keep related discussion boards together."
      onOpenChange={setCreateGroupOpen}
      open={createGroupOpen}
      title="New forum group"
      trigger={<button className="button primary compact" type="button"><Plus size={14} />Add group</button>}
    ><form className="management-form dialog-form" onSubmit={(event) => void createGroup(event)}><TextField label="Name" name="name" placeholder="Knowledge base" required /><TextField label="Description" name="description" placeholder="Long-lived references" /><DialogActions pending={pending} submitLabel="Create group" /></form></SettingsDialog>}
    description="Organize conversations into groups, tune access, and maintain reusable topic tags."
    eyebrow="Forum structure"
    title="Boards and tags"
  >
    {navigation.groups.length ? <SortableList
      disabled={pending}
      items={navigation.groups}
      label="Forum groups"
      onReorder={reorderGroups}
      renderItem={(group, handle) => <ForumGroupEditor context={context} group={group} handle={handle} pending={pending} run={run} />}
    /> : <EmptySettings message="No forum groups yet." />}
    <section className="settings-subsection">
      <header><div><h3>Topic tags</h3><p>Labels members can apply when starting a topic.</p></div><SettingsDialog
        description="Choose a short name, URL-safe slug, and recognizable color."
        onOpenChange={setCreateTagOpen}
        open={createTagOpen}
        title="New topic tag"
        trigger={<button className="button secondary compact" type="button"><Plus size={14} />Add tag</button>}
      ><form className="management-form dialog-form" onSubmit={(event) => void createTag(event)}><TextField label="Name" name="name" required /><TextField label="Slug" name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /><ColorPicker label="Color" name="color" /><DialogActions pending={pending} submitLabel="Create tag" /></form></SettingsDialog></header>
      <div className="tag-settings-list">{navigation.tags.map((tag) => <span key={tag.id} style={{ borderColor: tag.color ?? '#66736f', color: tag.color ?? '#66736f' }}>{tag.name}<button aria-label={`Delete ${tag.name}`} disabled={pending} onClick={() => void confirm({ confirmLabel: 'Delete tag', message: 'Existing topics will lose this tag.', title: `Delete ${tag.name}?` }).then((accepted) => accepted ? run(() => client.deleteForumTag(context.place.id, tag.id), 'Tag deleted.') : undefined)}><Trash2 size={12} /></button></span>)}</div>
    </section>
  </SettingsPanel>;
}

function ForumGroupEditor({ context, group, handle, pending, run }: { context: PlaceContext; group: ForumGroup; handle: ReactNode; pending: boolean; run: SettingsRunner }) {
  const client = usePlaceClient();
  const confirm = useConfirmation();
  const [createOpen, setCreateOpen] = useState(false);

  async function createForum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const input: CreateForum = { groupId: group.id, name: text(data, 'name'), position: group.forums.length, visibility: 'members' };
    if (await run(() => client.createForum(context.place.id, input), 'Forum created.')) {
      form.reset();
      setCreateOpen(false);
    }
  }

  async function reorderForums(forums: Forum[]) {
    const succeeded = await run(
      () => Promise.all(forums.map((forum, position) => client.updateForum(context.place.id, forum.id, { groupId: group.id, position }))),
      'Forums reordered.',
    );
    if (!succeeded) throw new Error('Forums could not be reordered.');
  }

  return <ResourceAccordion
    className="settings-resource"
    handle={handle}
    summary={<><strong>{group.name}</strong><small>{group.forums.length} {group.forums.length === 1 ? 'forum' : 'forums'}</small></>}
  >
    <form className="management-form settings-resource-body" onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const input: UpdateForumGroup = { description: text(data, 'description'), name: text(data, 'name') };
      void run(() => client.updateForumGroup(context.place.id, group.id, input), 'Forum group saved.');
    }}>
      <TextField defaultValue={group.name} label="Group name" name="name" required />
      <label className="wide-field">Description<textarea defaultValue={group.description} name="description" rows={2} /></label>
      <div className="button-row wide-field"><button className="button secondary compact" disabled={pending}><Save size={14} />Save group</button><button className="button danger compact" disabled={pending} onClick={() => void confirm({ confirmLabel: 'Delete group', message: 'The group must be empty before it can be deleted.', title: `Delete ${group.name}?` }).then((accepted) => accepted ? run(() => client.deleteForumGroup(context.place.id, group.id), 'Forum group deleted.') : undefined)} type="button"><Trash2 size={14} />Delete</button></div>
    </form>
    {group.forums.length ? <SortableList
      disabled={pending}
      items={group.forums}
      label={`Forums in ${group.name}`}
      onReorder={reorderForums}
      renderItem={(forum, forumHandle) => <ForumEditor forum={forum} handle={forumHandle} pending={pending} onArchive={() => confirm({ confirmLabel: 'Archive forum', message: 'Existing topics remain preserved.', title: `Archive ${forum.name}?` }).then((accepted) => accepted ? run(() => client.archiveForum(context.place.id, forum.id), 'Forum archived.') : undefined)} onSave={(input) => run(() => client.updateForum(context.place.id, forum.id, input), 'Forum saved.')} />}
    /> : null}
    <SettingsDialog
      description={`Add a discussion board to ${group.name}.`}
      onOpenChange={setCreateOpen}
      open={createOpen}
      title="New forum"
      trigger={<button className="button quiet compact settings-add-nested" type="button"><Plus size={14} />Add forum</button>}
    ><form className="management-form dialog-form" onSubmit={(event) => void createForum(event)}><TextField label="Name" name="name" placeholder="General" required /><DialogActions pending={pending} submitLabel="Create forum" /></form></SettingsDialog>
  </ResourceAccordion>;
}

function ForumEditor({ forum, handle, onArchive, onSave, pending }: { forum: Forum; handle: ReactNode; onArchive(): Promise<unknown>; onSave(input: UpdateForum): Promise<boolean>; pending: boolean }) {
  return <ResourceAccordion className="settings-nested-resource" handle={handle} summary={<><strong>{forum.name}</strong><small>{forum.visibility}</small></>}>
    <form className="management-form settings-resource-body" onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      void onSave({ description: text(data, 'description'), name: text(data, 'name'), readPermission: permission(data, 'readPermission'), visibility: text(data, 'visibility') as Forum['visibility'], writePermission: permission(data, 'writePermission') });
    }}>
      <TextField defaultValue={forum.name} label="Name" name="name" required />
      <label className="wide-field">Description<textarea defaultValue={forum.description} name="description" rows={2} /></label>
      <SelectField defaultValue={forum.visibility} label="Visibility" name="visibility" options={visibilityOptions} />
      <PermissionField defaultValue={forum.readPermission} label="Read permission" name="readPermission" optional />
      <PermissionField defaultValue={forum.writePermission} label="Write permission" name="writePermission" optional />
      <div className="button-row wide-field"><button className="button secondary compact" disabled={pending}><Save size={14} />Save forum</button><button className="button danger compact" disabled={pending} onClick={() => void onArchive()} type="button"><Archive size={14} />Archive</button></div>
    </form>
  </ResourceAccordion>;
}

export function ChatSettings({ context, onAuthorizationChange }: SettingsProps) {
  const client = usePlaceClient();
  const confirm = useConfirmation();
  const [createOpen, setCreateOpen] = useState(false);
  const { pending, resource, run } = useSettingsResource(`chat-settings:${context.place.id}`, () => client.chatChannels(context.place.id), onAuthorizationChange, 'Chat settings could not be changed.');
  if (resource.state.status === 'loading') return <SettingsLoading title="Loading chat channels" />;
  if (resource.state.status === 'error') return <SettingsError title="Chat channels unavailable" retry={resource.reload} />;
  const channels = resource.state.data;

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (await run(() => client.createChatChannel(context.place.id, { name: text(data, 'name'), position: channels.length, slug: text(data, 'slug'), visibility: 'members' }), 'Channel created.')) {
      form.reset();
      setCreateOpen(false);
    }
  }

  async function reorder(items: ChatChannel[]) {
    const succeeded = await run(() => Promise.all(items.map((channel, position) => client.updateChatChannel(context.place.id, channel.id, { position }))), 'Chat channels reordered.');
    if (!succeeded) throw new Error('Chat channels could not be reordered.');
  }

  return <SettingsPanel
    action={<SettingsDialog description="Create a channel for quick conversation." onOpenChange={setCreateOpen} open={createOpen} title="New chat channel" trigger={<button className="button primary compact" type="button"><Plus size={14} />Add channel</button>}><form className="management-form dialog-form" onSubmit={(event) => void create(event)}><TextField label="Name" name="name" required /><TextField label="Slug" name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /><DialogActions pending={pending} submitLabel="Create channel" /></form></SettingsDialog>}
    description="Create channels and configure who can read or send messages."
    eyebrow="Live conversation"
    title="Chat channels"
  >
    {channels.length ? <SortableList disabled={pending} items={channels} label="Chat channels" onReorder={reorder} renderItem={(channel, handle) => <ChannelEditor channel={channel} handle={handle} pending={pending} onArchive={() => confirm({ confirmLabel: 'Archive channel', message: 'Existing messages remain preserved.', title: `Archive ${channel.name}?` }).then((accepted) => accepted ? run(() => client.archiveChatChannel(context.place.id, channel.id), 'Channel archived.') : undefined)} onSave={(input) => run(() => client.updateChatChannel(context.place.id, channel.id, input), 'Channel saved.')} />} /> : <EmptySettings message="No chat channels yet." />}
  </SettingsPanel>;
}

function ChannelEditor({ channel, handle, onArchive, onSave, pending }: { channel: ChatChannel; handle: ReactNode; onArchive(): Promise<unknown>; onSave(input: UpdateChatChannel): Promise<boolean>; pending: boolean }) {
  return <ResourceAccordion className="settings-resource" handle={handle} summary={<><strong>#{channel.name}</strong><small>{channel.visibility}</small></>}><form className="management-form settings-resource-body" onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void onSave({ name: text(data, 'name'), readPermission: permission(data, 'readPermission'), sendPermission: permission(data, 'sendPermission'), visibility: text(data, 'visibility') as ChatChannel['visibility'] });
  }}><TextField defaultValue={channel.name} label="Name" name="name" required /><SelectField defaultValue={channel.visibility} label="Visibility" name="visibility" options={visibilityOptions} /><PermissionField defaultValue={channel.readPermission} label="Read permission" name="readPermission" optional /><PermissionField defaultValue={channel.sendPermission} label="Send permission" name="sendPermission" optional /><div className="button-row wide-field"><button className="button secondary compact" disabled={pending}><Save size={14} />Save channel</button><button className="button danger compact" disabled={pending} onClick={() => void onArchive()} type="button"><Archive size={14} />Archive</button></div></form></ResourceAccordion>;
}

export function VoiceSettings({ context, onAuthorizationChange }: SettingsProps) {
  const client = usePlaceClient();
  const confirm = useConfirmation();
  const [createOpen, setCreateOpen] = useState(false);
  const { pending, resource, run } = useSettingsResource(`voice-settings:${context.place.id}`, () => client.voiceRooms(context.place.id), onAuthorizationChange, 'Voice settings could not be changed.');
  if (resource.state.status === 'loading') return <SettingsLoading title="Loading voice rooms" />;
  if (resource.state.status === 'error') return <SettingsError title="Voice rooms unavailable" retry={resource.reload} />;
  const rooms = resource.state.data;

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (await run(() => client.createVoiceRoom(context.place.id, { capacity: 25, listenPermission: 'voice.join', name: text(data, 'name'), position: rooms.length, slug: text(data, 'slug'), speakPermission: 'voice.join' }), 'Voice room created.')) {
      form.reset();
      setCreateOpen(false);
    }
  }

  async function reorder(items: VoiceRoom[]) {
    const succeeded = await run(() => Promise.all(items.map((room, position) => client.updateVoiceRoom(context.place.id, room.id, { position }))), 'Voice rooms reordered.');
    if (!succeeded) throw new Error('Voice rooms could not be reordered.');
  }

  return <SettingsPanel
    action={<SettingsDialog description="Create a room for live audio conversation." onOpenChange={setCreateOpen} open={createOpen} title="New voice room" trigger={<button className="button primary compact" type="button"><Plus size={14} />Add room</button>}><form className="management-form dialog-form" onSubmit={(event) => void create(event)}><TextField label="Name" name="name" required /><TextField label="Slug" name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /><DialogActions pending={pending} submitLabel="Create room" /></form></SettingsDialog>}
    description="Set room capacity and decide who can listen or speak."
    eyebrow="Live audio"
    title="Voice rooms"
  >
    {rooms.length ? <SortableList disabled={pending} items={rooms} label="Voice rooms" onReorder={reorder} renderItem={(room, handle) => <VoiceRoomEditor handle={handle} key={room.id} room={room} pending={pending} onArchive={() => confirm({ confirmLabel: 'Archive room', message: 'Members will no longer be able to join.', title: `Archive ${room.name}?` }).then((accepted) => accepted ? run(() => client.archiveVoiceRoom(context.place.id, room.id), 'Voice room archived.') : undefined)} onSave={(input) => run(() => client.updateVoiceRoom(context.place.id, room.id, input), 'Voice room saved.')} />} /> : <EmptySettings message="No voice rooms yet." />}
  </SettingsPanel>;
}

function VoiceRoomEditor({ handle, onArchive, onSave, pending, room }: { handle: ReactNode; onArchive(): Promise<unknown>; onSave(input: UpdateVoiceRoom): Promise<boolean>; pending: boolean; room: VoiceRoom }) {
  return <ResourceAccordion className="settings-resource" handle={handle} summary={<><strong>{room.name}</strong><small>{room.participants.length}/{room.capacity} connected</small></>}><form className="management-form settings-resource-body" onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void onSave({ capacity: number(data, 'capacity'), listenPermission: permission(data, 'listenPermission') ?? 'voice.join', name: text(data, 'name'), speakPermission: permission(data, 'speakPermission') ?? 'voice.join' });
  }}><TextField defaultValue={room.name} label="Name" name="name" required /><TextField defaultValue={String(room.capacity)} label="Capacity" name="capacity" type="number" required /><PermissionField defaultValue={room.listenPermission} label="Listen permission" name="listenPermission" /><PermissionField defaultValue={room.speakPermission} label="Speak permission" name="speakPermission" /><div className="button-row wide-field"><button className="button secondary compact" disabled={pending}><Save size={14} />Save room</button><button className="button danger compact" disabled={pending} onClick={() => void onArchive()} type="button"><Archive size={14} />Archive</button></div></form></ResourceAccordion>;
}

export function RoleSettings({ context, onAuthorizationChange }: SettingsProps) {
  const client = usePlaceClient();
  const confirm = useConfirmation();
  const [createOpen, setCreateOpen] = useState(false);
  const { pending, resource, run } = useSettingsResource(`role-settings:${context.place.id}`, () => client.roles(context.place.id), onAuthorizationChange, 'Roles could not be changed.');
  if (resource.state.status === 'loading') return <SettingsLoading title="Loading roles" />;
  if (resource.state.status === 'error') return <SettingsError title="Roles unavailable" retry={resource.reload} />;
  const roles = resource.state.data.items;
  const systemRoles = roles.filter((role) => role.isSystem);
  const customRoles = roles.filter((role) => !role.isSystem);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (await run(() => client.createRole(context.place.id, { name: text(data, 'name'), permissions: [], position: roles.length }), 'Role created.')) {
      form.reset();
      setCreateOpen(false);
    }
  }

  async function reorder(items: Role[]) {
    const succeeded = await run(() => Promise.all(items.map((role, index) => client.updateRole(context.place.id, role.id, { position: systemRoles.length + index }))), 'Roles reordered.');
    if (!succeeded) throw new Error('Roles could not be reordered.');
  }

  const editor = (role: Role, handle?: ReactNode) => <RoleEditor handle={handle} key={role.id} role={role} pending={pending} onDelete={() => confirm({ confirmLabel: 'Delete role', message: 'Assigned members will lose this role’s capabilities.', title: `Delete ${role.name}?` }).then((accepted) => accepted ? run(() => client.deleteRole(context.place.id, role.id), 'Role deleted.') : undefined)} onSave={(input) => run(() => client.updateRole(context.place.id, role.id, input), 'Role saved.')} />;

  return <SettingsPanel
    action={<SettingsDialog description="Create a reusable set of permissions for members." onOpenChange={setCreateOpen} open={createOpen} title="New role" trigger={<button className="button primary compact" type="button"><Plus size={14} />Add role</button>}><form className="management-form dialog-form" onSubmit={(event) => void create(event)}><TextField label="Role name" name="name" required /><DialogActions pending={pending} submitLabel="Create role" /></form></SettingsDialog>}
    description="Group permissions into roles that can be assigned from the member directory."
    eyebrow="Capabilities"
    title="Roles and permissions"
  >
    <div className="settings-resource-list">{systemRoles.map((role) => editor(role))}</div>
    {customRoles.length ? <SortableList disabled={pending} items={customRoles} label="Custom roles" onReorder={reorder} renderItem={(role, handle) => editor(role, handle)} /> : <EmptySettings message="No custom roles yet." />}
  </SettingsPanel>;
}

function RoleEditor({ handle, onDelete, onSave, pending, role }: { handle?: ReactNode; onDelete(): Promise<unknown>; onSave(input: UpdateRole): Promise<boolean>; pending: boolean; role: Role }) {
  return <ResourceAccordion className="settings-resource" handle={handle} summary={<><strong>{role.name}</strong><small>{role.isSystem ? 'System role' : `${role.permissions.length} capabilities`}</small></>}><form className="management-form settings-resource-body" onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void onSave({ name: text(data, 'name'), permissions: placePermissions.filter((item) => data.has(item)) });
  }}><TextField defaultValue={role.name} label="Name" name="name" required /><fieldset className="permission-grid wide-field" disabled={role.isSystem}><legend>Capabilities</legend>{placePermissions.map((item) => <Checkbox defaultChecked={role.permissions.includes(item)} key={item} name={item}>{item.replace('.', ' ')}</Checkbox>)}</fieldset><div className="button-row wide-field"><button className="button secondary compact" disabled={pending || role.isSystem}><Save size={14} />Save role</button>{!role.isSystem ? <button className="button danger compact" disabled={pending} onClick={() => void onDelete()} type="button"><Trash2 size={14} />Delete</button> : null}</div></form></ResourceAccordion>;
}

function ResourceAccordion({ children, className, handle, summary }: { children: ReactNode; className: string; handle?: ReactNode; summary: ReactNode }) {
  return <AccordionPrimitive.Root className={className} collapsible type="single"><AccordionPrimitive.Item value="settings"><div className="settings-resource-heading">{handle}<AccordionPrimitive.Trigger><span>{summary}</span><ChevronDown aria-hidden="true" className="settings-resource-chevron" size={16} /></AccordionPrimitive.Trigger></div><AccordionPrimitive.Content className="settings-accordion-content">{children}</AccordionPrimitive.Content></AccordionPrimitive.Item></AccordionPrimitive.Root>;
}

function DialogActions({ pending, submitLabel }: { pending: boolean; submitLabel: string }) {
  return <div className="dialog-actions wide-field"><button className="button primary" disabled={pending}>{pending ? 'Saving...' : submitLabel}</button></div>;
}

function useSettingsResource<T>(key: string, load: () => Promise<T>, onAuthorizationChange: () => void, fallback: string) {
  const notify = useToast();
  const [pending, setPending] = useState(false);
  const resource = useRemoteResource(key, load);
  async function run(action: () => Promise<unknown>, success: string): Promise<boolean> {
    setPending(true);
    try {
      await action();
      notify(success);
      resource.reload();
      return true;
    } catch (error) {
      notify(errorMessage(error, fallback));
      if (isAuthorizationChange(error)) onAuthorizationChange();
      return false;
    } finally {
      setPending(false);
    }
  }
  return { pending, resource, run };
}

function PermissionField({ defaultValue, label, name, optional = false }: { defaultValue?: string | null; label: string; name: string; optional?: boolean }) {
  return <SelectField defaultValue={defaultValue ?? ''} label={label} name={name} options={[...(optional ? [{ label: 'No additional permission', value: '' }] : []), ...placePermissions.map((item) => ({ label: item.replace('.', ' '), value: item }))]} />;
}

function TextField(props: { defaultValue?: string; label: string; name: string; pattern?: string; placeholder?: string; required?: boolean; type?: string }) {
  return <label>{props.label}<input defaultValue={props.defaultValue} name={props.name} pattern={props.pattern} placeholder={props.placeholder} required={props.required} type={props.type ?? 'text'} /></label>;
}

function SelectField({ defaultValue, label, name, options }: { defaultValue?: string; label: string; name: string; options: { label: string; value: string }[] }) {
  return <label>{label}<Select defaultValue={defaultValue} name={name} options={options} /></label>;
}

function SettingsPanel({ action, children, description, eyebrow, title }: { action?: ReactNode; children: ReactNode; description: string; eyebrow: string; title: string }) {
  return <section className="management-section settings-panel"><header><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>{action}</header>{children}</section>;
}

function EmptySettings({ message }: { message: string }) { return <p className="settings-muted settings-empty">{message}</p>; }
function SettingsLoading({ title }: { title: string }) { return <section className="management-section"><p className="settings-muted">{title}...</p></section>; }
function SettingsError({ retry, title }: { retry(): void; title: string }) { return <section className="management-section"><h2>{title}</h2><button className="button secondary" onClick={retry}>Try again</button></section>; }
function permission(form: FormData, field: string): PlacePermission | null { const value = text(form, field); return placePermissions.includes(value as PlacePermission) ? value as PlacePermission : null; }
function text(form: FormData, field: string): string { return String(form.get(field) ?? ''); }
function number(form: FormData, field: string): number { return Number(form.get(field) ?? 0); }
function errorMessage(error: unknown, fallback: string): string { return error instanceof DesktopApiError ? error.problem?.detail ?? error.message : fallback; }
function isAuthorizationChange(error: unknown): boolean { return error instanceof DesktopApiError && ['forbidden', 'gone', 'not-found', 'unauthenticated'].includes(error.kind); }

interface SettingsProps { context: PlaceContext; onAuthorizationChange(): void }
type SettingsRunner = (action: () => Promise<unknown>, success: string) => Promise<boolean>;