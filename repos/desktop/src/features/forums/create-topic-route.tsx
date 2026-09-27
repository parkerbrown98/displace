import { Send } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RouteState } from '../../components/route-state/route-state';
import { Checkbox } from '../../components/ui/checkbox';
import { useToast } from '../../components/ui/feedback-context';
import { Select } from '../../components/ui/select';
import { useRemoteResource } from '../../lib/remote-resource';
import { useSession } from '../auth/session-provider';
import type { ForumNavigation, PlaceContext, RichTextDocument } from '../places/place-client';
import { usePlaceClient } from '../places/use-place-client';
import { forumDraftKey, loadForumDraft, removeForumDraft, saveForumDraft } from './draft-store';
import { ForumEditor } from './forum-editor';

export function CreateTopicRoute() {
  const client = usePlaceClient();
  const session = useSession();
  const { placeSlug = '' } = useParams();
  const resource = useRemoteResource(`topic-compose:${placeSlug}:${session.status}`, async () => {
    if (session.status !== 'authenticated') throw new Error('Sign in to create a topic.');
    const place = await client.get(placeSlug);
    const [context, navigation] = await Promise.all([client.context(place.id), client.forums(place.slug)]);
    return { context, navigation };
  });

  if (session.status === 'loading') return <RouteState state="loading" title="Preparing editor" />;
  if (session.status !== 'authenticated') return <RouteState state="error" title="Sign in required" message="Sign in before starting a discussion." />;
  if (resource.state.status === 'loading') return <RouteState state="loading" title="Preparing editor" />;
  if (resource.state.status === 'error') return <RouteState state="error" title="Editor unavailable" message="The place or its forums could not be loaded." onRetry={resource.reload} />;
  if (!resource.state.data.context.viewer.permissions.includes('topic.create')) return <RouteState state="error" title="Topic creation unavailable" message="Your role does not allow creating topics here." />;
  return <CreateTopicForm context={resource.state.data.context} navigation={resource.state.data.navigation} userId={session.user!.id} />;
}

function CreateTopicForm({ context, navigation, userId }: { context: PlaceContext; navigation: ForumNavigation; userId: string }) {
  const client = usePlaceClient();
  const navigate = useNavigate();
  const notify = useToast();
  const place = context.place;
  const permissions = context.viewer.permissions;
  const forums = navigation.groups.flatMap((group) => group.forums).filter((forum) => !forum.writePermission || permissions.some((permission) => permission === forum.writePermission));
  const draftKey = forumDraftKey(userId, place.id, 'new-topic');
  const [draft] = useState(() => loadForumDraft(draftKey));
  const [forumId, setForumId] = useState(draft?.forumId ?? forums[0]?.id ?? '');
  const [title, setTitle] = useState(draft?.title ?? '');
  const [tagIds, setTagIds] = useState<string[]>(draft?.tagIds ?? []);
  const [document, setDocument] = useState<RichTextDocument | undefined>(draft?.document);
  const [editorEmpty, setEditorEmpty] = useState(!draft?.document);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!title && !document && tagIds.length === 0) return;
    const timeout = window.setTimeout(() => saveForumDraft(draftKey, { document, forumId, tagIds, title }), 300);
    return () => window.clearTimeout(timeout);
  }, [document, draftKey, forumId, tagIds, title]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!document || editorEmpty || !forumId) return;
    setPending(true);
    try {
      const topic = await client.createTopic(place.id, forumId, { document, tagIds, title: title.trim() });
      removeForumDraft(draftKey);
      navigate(`/places/${place.slug}/topics/${topic.id}`, { replace: true });
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'The topic could not be published.');
      setPending(false);
    }
  }

  if (!forums.length) return <RouteState state="error" title="No writable forums" message="A forum with topic access must be available before you can start a discussion." />;

  return <div className="community-view topic-compose-view">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to={`/places/${place.slug}`}>{place.name}</Link><span>/</span><span>New topic</span></nav>
    <header className="compact-page-heading"><span className="eyebrow">Discussion</span><h2>Start a new topic.</h2><p>Set the context clearly, then let the conversation develop.</p></header>
    {draft ? <p className="draft-notice" role="status">Draft restored from {new Date(draft.updatedAt).toLocaleString()}.</p> : null}
    <form className="topic-compose-form" onSubmit={submit}>
      <div className="topic-compose-fields"><label className="form-field">Board<Select onValueChange={setForumId} options={forums.map((forum) => ({ label: forum.name, value: forum.id }))} required value={forumId} /></label><label className="form-field">Title<input autoFocus maxLength={300} minLength={1} onChange={(event) => setTitle(event.target.value)} required value={title} /></label></div>
      {navigation.tags.length ? <fieldset className="topic-tag-picker"><legend>Tags</legend>{navigation.tags.map((tag) => <Checkbox checked={tagIds.includes(tag.id)} className="topic-tag-checkbox" key={tag.id} onCheckedChange={(checked) => setTagIds((current) => checked ? [...current, tag.id] : current.filter((id) => id !== tag.id))}>{tag.name}</Checkbox>)}</fieldset> : null}
      <ForumEditor canUpload={permissions.includes('upload.create')} initialDocument={draft?.document} label="Opening post" onChange={(value, isEmpty) => { setDocument(value); setEditorEmpty(isEmpty); }} placeId={place.id} />
      <footer className="topic-compose-actions"><span>{title.length}/300</span><button className="button primary" disabled={pending || editorEmpty || !title.trim()} type="submit"><Send size={16} />{pending ? 'Publishing...' : 'Publish topic'}</button></footer>
    </form>
  </div>;
}