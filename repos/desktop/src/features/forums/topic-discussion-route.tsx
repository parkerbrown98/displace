import { Bell, BellOff, Bookmark, BookmarkCheck, Clock3, History, Lock, LockOpen, MessageSquareReply, Pencil, Pin, PinOff, Send, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { RichText } from '../../components/rich-text/rich-text';
import { RouteState } from '../../components/route-state/route-state';
import { useToast } from '../../components/ui/feedback-context';
import { useRemoteResource } from '../../lib/remote-resource';
import { useSession } from '../auth/session-provider';
import type { ForumNavigation, PlaceContext, Post, PostRevision, RichTextDocument, Topic, TopicViewerState } from '../places/place-client';
import { PlaceToolbar } from '../places/place-toolbar';
import { usePlaceClient } from '../places/use-place-client';
import { forumDraftKey, loadForumDraft, removeForumDraft, saveForumDraft } from './draft-store';
import { ForumEditor } from './forum-editor';

const REACTIONS = [{ label: 'Like', value: 'like' }, { label: 'Love', value: 'love' }, { label: 'Insightful', value: 'insightful' }];

export function TopicDiscussionRoute() {
  const client = usePlaceClient();
  const session = useSession();
  const { placeSlug = '', topicId = '' } = useParams();
  const [parameters] = useSearchParams();
  const cursor = parameters.get('cursor') ?? undefined;
  const resource = useRemoteResource(`discussion:${placeSlug}:${topicId}:${cursor ?? ''}:${session.status}`, async () => {
    const place = await client.get(placeSlug);
    const [topic, posts, navigation] = await Promise.all([client.topic(placeSlug, topicId), client.posts(placeSlug, topicId, cursor), client.forums(placeSlug)]);
    const [context, viewer] = session.status === 'authenticated'
      ? await Promise.all([client.context(place.id).catch(() => undefined), client.viewerState(place.id, topic.id).catch(() => undefined)])
      : [undefined, undefined];
    return { context, navigation, place, posts, topic, viewer };
  });

  if (resource.state.status === 'loading') return <RouteState state="loading" title="Opening discussion" />;
  if (resource.state.status === 'error') return <RouteState state="error" title="Discussion unavailable" message="This discussion is private, missing, or could not be loaded." onRetry={resource.reload} />;
  return <Discussion data={resource.state.data} reload={resource.reload} />;
}

function Discussion({ data, reload }: { data: DiscussionData; reload: () => void }) {
  const client = usePlaceClient();
  const session = useSession();
  const navigate = useNavigate();
  const notify = useToast();
  const [viewer, setViewer] = useState<TopicViewerState | undefined>(data.viewer);
  const [topic, setTopic] = useState(data.topic);
  const [markedUnread, setMarkedUnread] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(topic.title);
  const [editingPostId, setEditingPostId] = useState<string>();
  const [revisions, setRevisions] = useState<Record<string, PostRevision[]>>({});
  const [reactionOverrides, setReactionOverrides] = useState<Record<string, Post['reactions']>>({});
  const [pendingAction, setPendingAction] = useState<string>();
  const forum = findForum(data.navigation, topic.forumId);
  const permissions = data.context?.viewer.permissions ?? [];
  const canModerate = permissions.includes('moderation.manage');
  const canReply = permissions.includes('post.create') && topic.status !== 'locked';

  useEffect(() => {
    if (!viewer || !data.posts.items.length) return;
    void client.markTopicRead(data.place.id, topic.id, data.posts.items.at(-1)?.id).catch(() => undefined);
  }, [client, data.place.id, data.posts.items, topic.id, viewer]);

  async function toggleTopicFlag(kind: 'follow' | 'save') {
    if (!viewer) return;
    const previous = viewer;
    const enabled = kind === 'follow' ? !viewer.isFollowing : !viewer.isSaved;
    setViewer({ ...viewer, [kind === 'follow' ? 'isFollowing' : 'isSaved']: enabled });
    try {
      if (kind === 'follow') await client.setTopicFollow(data.place.id, topic.id, enabled);
      else await client.setTopicSave(data.place.id, topic.id, enabled);
    } catch (cause) {
      setViewer(previous);
      notify(errorMessage(cause));
    }
  }

  async function toggleRead() {
    const previous = markedUnread;
    setMarkedUnread(!markedUnread);
    try {
      if (markedUnread) await client.markTopicRead(data.place.id, topic.id, data.posts.items.at(-1)?.id);
      else await client.markTopicUnread(data.place.id, topic.id);
    } catch (cause) {
      setMarkedUnread(previous);
      notify(errorMessage(cause));
    }
  }

  async function toggleTopicState(kind: 'lock' | 'pin') {
    const previous = topic;
    const enabled = kind === 'lock' ? topic.status !== 'locked' : !topic.isPinned;
    setTopic({ ...topic, ...(kind === 'lock' ? { status: enabled ? 'locked' : 'open' } : { isPinned: enabled }) });
    try {
      setTopic(kind === 'lock' ? await client.setTopicLock(data.place.id, topic.id, enabled) : await client.setTopicPin(data.place.id, topic.id, enabled));
    } catch (cause) {
      setTopic(previous);
      notify(errorMessage(cause));
    }
  }

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setPendingAction('title');
    try {
      setTopic(await client.updateTopic(data.place.id, topic.id, { title: title.trim() }));
      setEditingTitle(false);
    } catch (cause) { notify(errorMessage(cause)); }
    finally { setPendingAction(undefined); }
  }

  async function removeTopic() {
    if (!window.confirm('Delete this topic and its discussion? This cannot be undone.')) return;
    setPendingAction('topic-delete');
    try {
      await client.deleteTopic(data.place.id, topic.id);
      navigate(`/places/${data.place.slug}`, { replace: true });
    } catch (cause) { setPendingAction(undefined); notify(errorMessage(cause)); }
  }

  async function togglePostSave(postId: string) {
    if (!viewer) return;
    const previous = viewer;
    const postState = viewer.posts.find((item) => item.postId === postId);
    const enabled = !postState?.isSaved;
    setViewer({ ...viewer, posts: updatePostViewer(viewer.posts, postId, { isSaved: enabled }) });
    try { await client.setPostSave(data.place.id, postId, enabled); }
    catch (cause) { setViewer(previous); notify(errorMessage(cause)); }
  }

  async function toggleReaction(post: Post, reaction: string) {
    if (!viewer) return;
    const displayed = reactionOverrides[post.id] ?? withViewerReactions(post.reactions, viewer, post.id);
    const previous = displayed;
    const active = displayed.find((item) => item.reaction === reaction)?.reacted ?? false;
    const next = updateReactionSummary(displayed, reaction, !active);
    setReactionOverrides((current) => ({ ...current, [post.id]: next }));
    try { await client.setReaction(data.place.id, post.id, reaction, !active); }
    catch (cause) { setReactionOverrides((current) => ({ ...current, [post.id]: previous })); notify(errorMessage(cause)); }
  }

  async function removePost(post: Post) {
    if (!window.confirm('Delete this reply? A tombstone will remain in the discussion.')) return;
    setPendingAction(`delete:${post.id}`);
    try { await client.deletePost(data.place.id, post.id); reload(); }
    catch (cause) { notify(errorMessage(cause)); }
    finally { setPendingAction(undefined); }
  }

  async function showRevisions(postId: string) {
    if (revisions[postId]) { setRevisions((current) => { const next = { ...current }; delete next[postId]; return next; }); return; }
    setPendingAction(`revisions:${postId}`);
    try {
      const history = await client.revisions(data.place.id, postId);
      setRevisions((current) => ({ ...current, [postId]: history }));
    }
    catch (cause) { notify(errorMessage(cause)); }
    finally { setPendingAction(undefined); }
  }

  const canManageTopic = canModerate || topic.authorUserId === session.user?.id;
  return <div className="community-view discussion-view">
    <PlaceToolbar active="forums" context={data.context} place={data.place} />
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to={`/places/${data.place.slug}`}>Forums</Link>{forum ? <><span aria-hidden="true">/</span><Link to={`/places/${data.place.slug}/forums/${forum.id}`}>{forum.name}</Link></> : null}</nav>
    <header className="discussion-heading">
      <div className="topic-flags">{topic.isPinned ? <span><Pin size={13} />Pinned</span> : null}{topic.status === 'locked' ? <span><Lock size={13} />Locked</span> : null}{topic.tags.map((tag) => <span key={tag.id}>{tag.name}</span>)}</div>
      {editingTitle ? <form className="inline-title-form" onSubmit={rename}><input autoFocus maxLength={300} onChange={(event) => setTitle(event.target.value)} value={title} /><button className="button primary compact" disabled={pendingAction === 'title'}>Save title</button><button className="button secondary compact" onClick={() => { setTitle(topic.title); setEditingTitle(false); }} type="button">Cancel</button></form> : <h2>{topic.title}</h2>}
      <p>Started by <Link to={`/members/${topic.author.handle}`}>{topic.author.displayName}</Link> · {formatDate(topic.createdAt)}</p>
      {data.context ? <div className="discussion-actions">
        <button className={viewer?.isFollowing ? 'active' : ''} onClick={() => void toggleTopicFlag('follow')} type="button">{viewer?.isFollowing ? <BellOff /> : <Bell />} {viewer?.isFollowing ? 'Unfollow' : 'Follow'}</button>
        <button className={viewer?.isSaved ? 'active' : ''} onClick={() => void toggleTopicFlag('save')} type="button">{viewer?.isSaved ? <BookmarkCheck /> : <Bookmark />} {viewer?.isSaved ? 'Saved' : 'Save'}</button>
        <button onClick={() => void toggleRead()} type="button"><Clock3 />{markedUnread ? 'Mark read' : 'Mark unread'}</button>
        {canManageTopic ? <button onClick={() => setEditingTitle(true)} type="button"><Pencil />Rename</button> : null}
        {canModerate ? <button onClick={() => void toggleTopicState('lock')} type="button">{topic.status === 'locked' ? <LockOpen /> : <Lock />}{topic.status === 'locked' ? 'Unlock' : 'Lock'}</button> : null}
        {canModerate ? <button onClick={() => void toggleTopicState('pin')} type="button">{topic.isPinned ? <PinOff /> : <Pin />}{topic.isPinned ? 'Unpin' : 'Pin'}</button> : null}
        {canManageTopic ? <button className="danger" disabled={pendingAction === 'topic-delete'} onClick={() => void removeTopic()} type="button"><Trash2 />Delete topic</button> : null}
      </div> : null}
    </header>
    <div className="post-stream">{data.posts.items.map((post, index) => {
      const ownPost = post.authorUserId === session.user?.id;
      const postViewer = viewer?.posts.find((item) => item.postId === post.id);
      const displayedReactions = reactionOverrides[post.id] ?? withViewerReactions(post.reactions, viewer, post.id);
      return <article className={`post-row${post.isDeleted ? ' deleted' : ''}`} key={post.id}>
        <aside><span className="avatar">{initials(post.author.displayName)}</span><Link to={`/members/${post.author.handle}`}>{post.author.displayName}</Link><small>@{post.author.handle}</small></aside>
        <div className="post-body"><header><span>#{index + 1}</span><time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>{post.version > 1 ? <small>edited</small> : null}</header>
          {post.isDeleted ? <p className="deleted-copy">This {index === 0 ? 'post' : 'reply'} was removed.</p> : editingPostId === post.id ? <PostEditor canUpload={permissions.includes('upload.create')} onCancel={() => setEditingPostId(undefined)} onSaved={reload} placeId={data.place.id} post={post} /> : <>{post.document ? <RichText placeId={data.place.id} value={post.document} /> : <p>{post.plainText}</p>}<div className="post-actions">
            {viewer ? REACTIONS.map(({ label, value }) => { const summary = displayedReactions.find((item) => item.reaction === value); return <button aria-pressed={summary?.reacted ?? false} className={summary?.reacted ? 'active' : ''} key={value} onClick={() => void toggleReaction(post, value)} type="button">{label}{summary?.count ? <span>{summary.count}</span> : null}</button>; }) : null}
            {viewer ? <button className={postViewer?.isSaved ? 'active' : ''} onClick={() => void togglePostSave(post.id)} type="button"><Bookmark size={14} />{postViewer?.isSaved ? 'Saved' : 'Save'}</button> : null}
            {ownPost ? <button onClick={() => setEditingPostId(post.id)} type="button"><Pencil size={14} />Edit</button> : null}
            {post.version > 1 ? <button disabled={pendingAction === `revisions:${post.id}`} onClick={() => void showRevisions(post.id)} type="button"><History size={14} />History</button> : null}
            {index > 0 && (ownPost || canModerate) ? <button className="danger" disabled={pendingAction === `delete:${post.id}`} onClick={() => void removePost(post)} type="button"><Trash2 size={14} />Delete</button> : null}
          </div>{revisions[post.id] ? <RevisionHistory placeId={data.place.id} revisions={revisions[post.id]} /> : null}</>}
        </div>
      </article>;
    })}</div>
    {data.posts.nextCursor ? <div className="cursor-row"><Link className="button secondary" to={`?cursor=${encodeURIComponent(data.posts.nextCursor)}`}>Load older replies</Link></div> : null}
    {canReply ? <ReplyComposer context={data.context!} onCreated={reload} topic={topic} /> : topic.status === 'locked' ? <p className="inline-notice"><Lock size={15} />This discussion is locked.</p> : session.status !== 'authenticated' ? <p className="inline-notice">Sign in and join this place to reply.</p> : null}
  </div>;
}

function ReplyComposer({ context, onCreated, topic }: { context: PlaceContext; onCreated: () => void; topic: Topic }) {
  const client = usePlaceClient();
  const session = useSession();
  const notify = useToast();
  const draftKey = forumDraftKey(session.user!.id, context.place.id, `reply:${topic.id}`);
  const [draft] = useState(() => loadForumDraft(draftKey));
  const [document, setDocument] = useState<RichTextDocument | undefined>(draft?.document);
  const [empty, setEmpty] = useState(!draft?.document);
  const [pending, setPending] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    if (!document || empty) return;
    const timeout = window.setTimeout(() => saveForumDraft(draftKey, { document }), 300);
    return () => window.clearTimeout(timeout);
  }, [document, draftKey, empty]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!document || empty) return;
    setPending(true);
    try {
      await client.createReply(context.place.id, topic.id, document);
      removeForumDraft(draftKey); setDocument(undefined); setEmpty(true); setEditorKey((value) => value + 1); onCreated();
    } catch (cause) { notify(errorMessage(cause)); }
    finally { setPending(false); }
  }

  return <form className="reply-composer" onSubmit={submit}><header><MessageSquareReply /><div><h3>Join the discussion</h3>{draft && editorKey === 0 ? <p>Restored your saved reply.</p> : <p>Your draft is stored on this device.</p>}</div></header><ForumEditor canUpload={context.viewer.permissions.includes('upload.create')} initialDocument={editorKey === 0 ? draft?.document : undefined} key={editorKey} label="Reply" onChange={(value, isEmpty) => { setDocument(value); setEmpty(isEmpty); }} placeId={context.place.id} /><footer><button className="button primary" disabled={empty || pending}><Send size={16} />{pending ? 'Posting...' : 'Post reply'}</button></footer></form>;
}

function PostEditor({ canUpload, onCancel, onSaved, placeId, post }: { canUpload: boolean; onCancel: () => void; onSaved: () => void; placeId: string; post: Post }) {
  const client = usePlaceClient();
  const notify = useToast();
  const [document, setDocument] = useState<RichTextDocument | undefined>(post.document as RichTextDocument | undefined);
  const [empty, setEmpty] = useState(false);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!document || empty) return; setPending(true);
    try { await client.editPost(placeId, post.id, document, post.version); onSaved(); onCancel(); }
    catch (cause) { notify(errorMessage(cause)); setPending(false); }
  }
  return <form className="post-editor" onSubmit={submit}><ForumEditor canUpload={canUpload} initialDocument={post.document as RichTextDocument} label="Edit post" onChange={(value, isEmpty) => { setDocument(value); setEmpty(isEmpty); }} placeId={placeId} /><footer><button className="button secondary compact" onClick={onCancel} type="button">Cancel</button><button className="button primary compact" disabled={pending || empty}>Save edit</button></footer></form>;
}

function RevisionHistory({ placeId, revisions }: { placeId: string; revisions: PostRevision[] }) {
  return <section className="revision-history"><h4>Revision history</h4>{revisions.length ? revisions.map((revision) => <details key={revision.id}><summary>Version {revision.version} · {formatDate(revision.createdAt)}</summary><RichText placeId={placeId} value={revision.document} /></details>) : <p>No earlier revisions are available.</p>}</section>;
}

function findForum(navigation: ForumNavigation, forumId: string) { return navigation.groups.flatMap((group) => group.forums).find((forum) => forum.id === forumId); }
function updatePostViewer(posts: TopicViewerState['posts'], postId: string, update: Partial<TopicViewerState['posts'][number]>) { const found = posts.some((post) => post.postId === postId); return found ? posts.map((post) => post.postId === postId ? { ...post, ...update } : post) : [...posts, { isSaved: false, postId, reactions: [], ...update }]; }
function withViewerReactions(reactions: Post['reactions'], viewer: TopicViewerState | undefined, postId: string) { const own = new Set(viewer?.posts.find((post) => post.postId === postId)?.reactions ?? []); return reactions.map((reaction) => ({ ...reaction, reacted: own.has(reaction.reaction) })); }
function updateReactionSummary(reactions: Post['reactions'], value: string, enabled: boolean) { const existing = reactions.find((reaction) => reaction.reaction === value); if (!existing) return enabled ? [...reactions, { count: 1, reacted: true, reaction: value }] : reactions; return reactions.map((reaction) => reaction.reaction === value ? { ...reaction, count: Math.max(0, reaction.count + (enabled ? 1 : -1)), reacted: enabled } : reaction).filter((reaction) => reaction.count > 0); }
function errorMessage(cause: unknown) { return cause instanceof Error ? cause.message : 'The server could not complete this action.'; }
function initials(value: string) { return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }
function formatDate(value: string) { return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }

interface DiscussionData {
  context?: PlaceContext;
  navigation: ForumNavigation;
  place: PlaceContext['place'];
  posts: { items: Post[]; nextCursor?: string };
  topic: Topic;
  viewer?: TopicViewerState;
}