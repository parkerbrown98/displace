import { Archive, ChevronRight, Hash, MessagesSquare, Radio, Settings2, ShieldCheck, UsersRound } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, NavLink, useNavigate, useParams } from 'react-router-dom';
import { RouteState } from '../../components/route-state/route-state';
import { useConfirmation, useToast } from '../../components/ui/feedback-context';
import { DesktopApiError } from '../../lib/api/desktop-api';
import { useRemoteResource } from '../../lib/remote-resource';
import { useSession } from '../auth/session-provider';
import type { Place, PlaceContext, PlacePermission } from './place-client';
import { ChatSettings, ForumSettings, RoleSettings, VoiceSettings } from './place-resource-settings';
import { PlaceToolbar } from './place-toolbar';
import { usePlaceClient } from './use-place-client';

type SettingsSection = 'identity' | 'preferences' | 'forums' | 'chat' | 'voice' | 'roles' | 'archive';

const sectionDefinitions: { icon: ReactNode; label: string; permission: PlacePermission; section: SettingsSection }[] = [
  { icon: <ShieldCheck />, label: 'Identity', permission: 'place.manage', section: 'identity' },
  { icon: <Settings2 />, label: 'Preferences', permission: 'place.manage', section: 'preferences' },
  { icon: <Hash />, label: 'Forums', permission: 'forum.manage', section: 'forums' },
  { icon: <MessagesSquare />, label: 'Chat', permission: 'chat.manage', section: 'chat' },
  { icon: <Radio />, label: 'Voice', permission: 'voice.manage', section: 'voice' },
  { icon: <UsersRound />, label: 'Roles', permission: 'role.manage', section: 'roles' },
  { icon: <Archive />, label: 'Archive', permission: 'place.manage', section: 'archive' },
];

export function PlaceSettingsRoute() {
  const session = useSession();
  const client = usePlaceClient();
  const { placeSlug = '', section } = useParams();
  const resource = useRemoteResource(`place-settings-shell:${placeSlug}`, async () => {
    const place = await client.get(placeSlug);
    return client.context(place.id);
  });

  if (session.status === 'loading') return <RouteState state="loading" title="Loading settings" />;
  if (session.status !== 'authenticated') return <SignInGate returnTo={`/places/${placeSlug}/settings${section ? `/${section}` : ''}`} />;
  if (resource.state.status === 'loading') return <RouteState state="loading" title="Loading place settings" />;
  if (resource.state.status === 'error') return <RouteState state="not-found" title="Settings unavailable" message={errorMessage(resource.state.error, 'This place does not exist or you no longer have access.')} />;

  const context = resource.state.data;
  const available = sectionDefinitions.filter((item) => context.viewer.permissions.includes(item.permission));
  if (!available.length) return <RouteState state="not-found" title="Settings unavailable" message="Your role does not include a place management capability." />;
  const selected = available.find((item) => item.section === section);
  if (!selected) return <Navigate replace to={`/places/${context.place.slug}/settings/${available[0].section}`} />;

  return <div className="community-view place-workspace-page settings-workspace">
    <PlaceToolbar active="settings" context={context} place={context.place} />
    <div className="settings-workspace-grid">
      <aside className="settings-navigation"><span className="eyebrow">Place settings</span><nav aria-label="Settings sections">{available.map((item) => <NavLink key={item.section} to={`/places/${context.place.slug}/settings/${item.section}`}>{item.icon}<span>{item.label}</span><ChevronRight /></NavLink>)}</nav></aside>
      <main className="settings-content">
        {selected.section === 'identity' ? <IdentitySettings context={context} reload={resource.reload} /> : null}
        {selected.section === 'preferences' ? <PreferenceSettings context={context} reload={resource.reload} /> : null}
        {selected.section === 'forums' ? <ForumSettings context={context} onAuthorizationChange={resource.reload} /> : null}
        {selected.section === 'chat' ? <ChatSettings context={context} onAuthorizationChange={resource.reload} /> : null}
        {selected.section === 'voice' ? <VoiceSettings context={context} onAuthorizationChange={resource.reload} /> : null}
        {selected.section === 'roles' ? <RoleSettings context={context} onAuthorizationChange={resource.reload} /> : null}
        {selected.section === 'archive' ? <ArchiveSettings context={context} reload={resource.reload} /> : null}
      </main>
    </div>
  </div>;
}

function IdentitySettings({ context, reload }: SettingsProps) {
  const client = usePlaceClient();
  const notify = useToast();
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      await client.update(context.place.id, { description: String(form.get('description') ?? ''), joinPolicy: String(form.get('joinPolicy')) as Place['joinPolicy'], name: String(form.get('name') ?? ''), visibility: String(form.get('visibility')) as Place['visibility'] });
      notify('Place identity saved.');
      reload();
    } catch (error) { notify(errorMessage(error, 'Place identity could not be saved.')); if (isAuthorizationChange(error)) reload(); }
    finally { setPending(false); }
  }
  return <SettingsPanel eyebrow="Identity and access" title="Place identity" description="Control how this place appears and how people can join."><form className="management-form" onSubmit={submit}><TextField defaultValue={context.place.name} label="Name" maxLength={100} name="name" required /><label className="wide-field">Description<textarea defaultValue={context.place.description} maxLength={500} name="description" rows={4} /></label><SelectField defaultValue={context.place.visibility} label="Visibility" name="visibility" options={[['public', 'Public'], ['unlisted', 'Unlisted'], ['private', 'Private']]} /><SelectField defaultValue={context.place.joinPolicy} label="Joining" name="joinPolicy" options={[['open', 'Open to join'], ['approval', 'Requires approval'], ['invite_only', 'Invite only']]} /><button className="button primary" disabled={pending}>{pending ? 'Saving...' : 'Save identity'}</button></form></SettingsPanel>;
}

function PreferenceSettings({ context, reload }: SettingsProps) {
  const client = usePlaceClient();
  const notify = useToast();
  const [pending, setPending] = useState(false);
  const tags = Array.isArray(context.place.settings.tags) ? context.place.settings.tags.filter((tag): tag is string => typeof tag === 'string') : [];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const nextTags = String(form.get('tags') ?? '').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 8);
    try {
      await client.updateSettings(context.place.id, { ...context.place.settings, locale: String(form.get('locale') ?? 'en-US'), tags: nextTags, topicSort: String(form.get('topicSort') ?? 'activity') });
      notify('Community preferences saved.');
      reload();
    } catch (error) { notify(errorMessage(error, 'Preferences could not be saved.')); if (isAuthorizationChange(error)) reload(); }
    finally { setPending(false); }
  }
  return <SettingsPanel eyebrow="Defaults and discovery" title="Community preferences" description="Help people find this place and choose how conversations appear by default."><form className="management-form" onSubmit={submit}><TextField defaultValue={tags.join(', ')} hint="Up to eight comma-separated tags." label="Discovery tags" name="tags" /><SelectField defaultValue={String(context.place.settings.locale ?? 'en-US')} label="Locale" name="locale" options={[['en-US', 'English (United States)'], ['en-GB', 'English (United Kingdom)']]} /><SelectField defaultValue={String(context.place.settings.topicSort ?? 'activity')} label="Default topic order" name="topicSort" options={[['activity', 'Recent activity'], ['created', 'Newest topics']]} /><button className="button primary" disabled={pending}>{pending ? 'Saving...' : 'Save preferences'}</button></form></SettingsPanel>;
}

function ArchiveSettings({ context, reload }: SettingsProps) {
  const client = usePlaceClient();
  const confirm = useConfirmation();
  const navigate = useNavigate();
  const notify = useToast();
  async function archive() {
    if (!await confirm({ confirmLabel: 'Archive place', message: 'Members will lose access to this place and its active conversations.', title: `Archive ${context.place.name}?` })) return;
    try { await client.archive(context.place.id); notify('Place archived.'); navigate('/discover', { replace: true }); }
    catch (error) { notify(errorMessage(error, 'The place could not be archived.')); if (isAuthorizationChange(error)) reload(); }
  }
  return <SettingsPanel eyebrow="Restricted action" title="Archive place" description="Archiving removes this place from discovery and blocks new activity while preserving its records."><div className="danger-row"><p>This cannot be undone from the desktop app.</p><button className="button danger" onClick={() => void archive()}><Archive size={15} />Archive place</button></div></SettingsPanel>;
}

function SettingsPanel({ children, description, eyebrow, title }: { children: ReactNode; description: string; eyebrow: string; title: string }) { return <section className="management-section settings-panel"><header><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div></header>{children}</section>; }
function SignInGate({ returnTo }: { returnTo: string }) { return <section className="settings-gate"><UsersRound size={28} /><h2>Sign in required</h2><p>Sign in to manage this place.</p><Link className="button primary" to={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}>Sign in</Link></section>; }
function TextField(props: { defaultValue?: string; hint?: string; label: string; maxLength?: number; name: string; required?: boolean }) { return <label>{props.label}<input defaultValue={props.defaultValue} maxLength={props.maxLength} name={props.name} required={props.required} />{props.hint ? <small>{props.hint}</small> : null}</label>; }
function SelectField({ defaultValue, label, name, options }: { defaultValue?: string; label: string; name: string; options: [string, string][] }) { return <label>{label}<select defaultValue={defaultValue} name={name}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>; }
function errorMessage(error: unknown, fallback: string): string { return error instanceof DesktopApiError ? error.problem?.detail ?? error.message : fallback; }
function isAuthorizationChange(error: unknown): boolean { return error instanceof DesktopApiError && ['forbidden', 'gone', 'not-found', 'unauthenticated'].includes(error.kind); }

interface SettingsProps { context: PlaceContext; reload(): void }