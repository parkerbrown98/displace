import {
  ArrowRight, Compass, FileText, Hash, Lock, MapPin, MessageSquareText, Plus,
  MessagesSquare, Pin, Search, UsersRound,
} from 'lucide-react';
import { useDeferredValue, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { RichText } from '../../components/rich-text/rich-text';
import { RouteState } from '../../components/route-state/route-state';
import { Select } from '../../components/ui/select';
import { useRemoteResource } from '../../lib/remote-resource';
import { DesktopApiError } from '../../lib/api/desktop-api';
import { useSession } from '../auth/session-provider';
import type { ForumNavigation, Place, Topic } from './place-client';
import { PlaceToolbar } from './place-toolbar';
import { usePlaceClient } from './use-place-client';

export function DiscoverRoute() {
  const client = usePlaceClient();
  const navigate = useNavigate();
  const [parameters] = useSearchParams();
  const deferredKey = useDeferredValue(parameters.toString());
  const query = parameters.get('q')?.trim() ?? '';
  const tag = parameters.get('tag') ?? undefined;
  const joinPolicy = parseJoinPolicy(parameters.get('join'));
  const cursor = parameters.get('cursor') ?? undefined;
  const resource = useRemoteResource(`discover:${deferredKey}`, () => client.discover({ cursor, joinPolicy, query: query || undefined, tag }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    navigate(withQuery('/discover', { join: String(form.get('join') ?? ''), q: String(form.get('q') ?? ''), tag }));
  }

  if (resource.state.status !== 'ready') return <ResourceState resource={resource} title="Loading communities" />;
  const page = resource.state.data;
  return (
    <div className="community-view discovery-view">
      <section className="discovery-masthead">
        <div><h2>Find a place worth returning to.</h2><p>Browse public communities, or narrow the field by conversation and access.</p></div>
        <span className="signal-mark" aria-hidden="true"><i /><i /><i /><strong>D</strong></span>
      </section>
      <form className="command-bar" onSubmit={submit} role="search">
        <Search aria-hidden="true" size={19} /><input defaultValue={query} minLength={2} name="q" placeholder="Search places" type="search" />
        <Select aria-label="Access" defaultValue={joinPolicy ?? ''} name="join" options={[{ label: 'Any access', value: '' }, { label: 'Open', value: 'open' }, { label: 'By approval', value: 'approval' }, { label: 'Invite only', value: 'invite_only' }]} />
        <button className="button primary" type="submit">Explore</button>
      </form>
      {page.tags?.length ? <nav className="tag-strip" aria-label="Browse by interest">
        <Link className={!tag ? 'active' : ''} to={withQuery('/discover', { join: joinPolicy })}><Compass size={14} />All</Link>
        {page.tags.map((facet) => <Link className={tag === facet.name ? 'active' : ''} key={facet.name} to={withQuery('/discover', { join: joinPolicy, tag: facet.name })}><Hash size={13} />{humanize(facet.name)} <span>{facet.count}</span></Link>)}
      </nav> : null}
      <div className="directory-heading"><h3>{tag ? `Places tagged #${tag}` : 'Public places'}</h3><span>{page.items.length} found</span></div>
      {page.items.length ? <div className="place-grid">{page.items.map((place, index) => <PlaceCard index={index} key={place.id} place={place} />)}</div> : <EmptyContent icon={<Compass />} title="No communities found" message="Try a broader search or another access filter." />}
      <CursorButton cursor={page.nextCursor} path="/discover" parameters={{ join: joinPolicy, q: query, tag }} />
    </div>
  );
}

export function SearchRoute() {
  const client = usePlaceClient();
  const session = useSession();
  const navigate = useNavigate();
  const [parameters] = useSearchParams();
  const query = parameters.get('q')?.trim() ?? '';
  const type = parseSearchType(parameters.get('type'));
  const placeId = parameters.get('placeId') ?? undefined;
  const cursor = parameters.get('cursor') ?? undefined;
  const places = useRemoteResource(`search-places:${session.status}`, () => session.status === 'authenticated' ? client.mine() : Promise.resolve({ items: [] }));
  const resource = useRemoteResource(`search:${parameters}`, () => query.length >= 2 ? client.search({ cursor, placeId, query, type }) : Promise.resolve({ items: [] }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    navigate(withQuery('/search', { placeId: String(form.get('placeId') ?? ''), q: String(form.get('q') ?? ''), type: String(form.get('type') ?? '') }));
  }

  return <div className="community-view search-view">
    <header className="compact-page-heading"><h2>Search the conversation.</h2><p>Find public communities, topics, and replies without leaving the keyboard.</p></header>
    <form className="command-bar search-command-bar" onSubmit={submit} role="search"><Search aria-hidden="true" size={19} /><input autoFocus defaultValue={query} minLength={2} name="q" placeholder="Try a topic, place, or phrase" required type="search" /><Select aria-label="Result type" defaultValue={type ?? ''} name="type" options={[{ label: 'Everything', value: '' }, { label: 'Places', value: 'place' }, { label: 'Topics', value: 'topic' }, { label: 'Replies', value: 'post' }]} /><Select aria-label="Search scope" defaultValue={placeId ?? ''} name="placeId" options={[{ label: 'Everywhere', value: '' }, ...(places.state.status === 'ready' ? places.state.data.items.map((place) => ({ label: place.name, value: place.id })) : [])]} /><button className="button primary">Search</button></form>
    {query.length < 2 ? <EmptyContent icon={<Search />} title="Start with a phrase" message="Enter at least two characters to search public content." /> : resource.state.status !== 'ready' ? <ResourceState resource={resource} title="Searching" /> : resource.state.data.items.length ? <div className="search-results">{resource.state.data.items.map((result) => <article className="search-result" key={`${result.type}:${result.postId ?? result.topicId ?? result.placeId}`}><span className="result-icon">{result.type === 'place' ? <MapPin /> : result.type === 'topic' ? <MessageSquareText /> : <FileText />}</span><div><span className="result-meta">{result.type} · {result.placeSlug}</span><h3><Link to={result.type === 'place' ? `/places/${result.placeSlug}` : `/places/${result.placeSlug}/topics/${result.topicId}`}>{highlight(result.highlights?.title ?? result.title)}</Link></h3><p>{highlight(result.highlights?.text ?? result.text)}</p><time dateTime={result.createdAt}>{formatDate(result.createdAt)}</time></div></article>)}</div> : <EmptyContent icon={<Search />} title="No matches" message="Try a broader phrase or another result type." />}
    {resource.state.status === 'ready' ? <CursorButton cursor={resource.state.data.nextCursor} path="/search" parameters={{ placeId, q: query, type }} /> : null}
  </div>;
}

export function PlaceRoute() {
  const client = usePlaceClient();
  const session = useSession();
  const { forumId, placeSlug = '' } = useParams();
  const [parameters] = useSearchParams();
  const feed = parseFeed(parameters.get('feed'));
  const cursor = parameters.get('cursor') ?? undefined;
  const resource = useRemoteResource(`place:${placeSlug}:${forumId ?? ''}:${feed}:${cursor ?? ''}:${session.status}`, async () => {
    const place = await client.get(placeSlug);
    const [navigation, topics] = await Promise.all([client.forums(placeSlug), client.topics(placeSlug, { cursor, feed, forumId })]);
    const context = session.status === 'authenticated' ? await client.context(place.id).catch(() => undefined) : undefined;
    return { context, navigation, place, topics };
  });
  const [actionMessage, setActionMessage] = useState<string>();

  if (resource.state.status !== 'ready') return <ResourceState resource={resource} title="Opening place" />;
  const { context, navigation, place, topics } = resource.state.data;
  const selectedForum = navigation.groups.flatMap((group) => group.forums).find((forum) => forum.id === forumId);

  async function join() {
    try {
      const result = await client.join(place.id);
      setActionMessage(result.status === 'active' ? 'You joined this place.' : 'Your request is waiting for approval.');
      resource.reload();
    } catch (error) {
      setActionMessage(messageForError(error));
    }
  }

  return <div className="community-view place-workbench">
    <PlaceToolbar action={session.status === 'authenticated' && !context ? <button className="button primary compact" onClick={join}>Join place</button> : null} active="forums" context={context} place={place} />
    {actionMessage ? <p className="inline-notice" role="status">{actionMessage}</p> : null}
    <div className="forum-workbench">
      {selectedForum ? <section className="forum-subroute-heading"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link to={`/places/${place.slug}`}>Forums</Link><span aria-hidden="true">/</span><span>{selectedForum.name}</span></nav><header><h2>{selectedForum.name}</h2>{selectedForum.description ? <p>{selectedForum.description}</p> : null}</header></section> : <ForumDirectory navigation={navigation} placeSlug={place.slug} topics={topics.items} />}
      <section className="topic-directory"><header className="topic-directory-header"><div className="topic-directory-title"><h2>Discussions</h2>{context?.viewer.permissions.includes('topic.create') ? <Link className="button primary compact" to={`/places/${place.slug}/topics/new`}><Plus size={14} />New topic</Link> : null}</div><nav aria-label="Topic filters">{(['latest', 'popular', 'following'] as const).map((value) => <Link className={feed === value ? 'active' : ''} key={value} to={withQuery(forumId ? `/places/${place.slug}/forums/${forumId}` : `/places/${place.slug}`, { feed: value })}>{humanize(value)}</Link>)}</nav></header>{topics.items.length ? <div className="topic-list">{topics.items.map((topic) => <TopicRow key={topic.id} placeSlug={place.slug} topic={topic} />)}</div> : <EmptyContent icon={<MessageSquareText />} title="No discussions here yet" message="Choose another board or check back later." />}<CursorButton cursor={topics.nextCursor} path={forumId ? `/places/${place.slug}/forums/${forumId}` : `/places/${place.slug}`} parameters={{ feed }} /></section>
    </div>
  </div>;
}

export function TopicRoute() {
  const client = usePlaceClient();
  const { placeSlug = '', topicId = '' } = useParams();
  const [parameters] = useSearchParams();
  const cursor = parameters.get('cursor') ?? undefined;
  const resource = useRemoteResource(`topic:${placeSlug}:${topicId}:${cursor ?? ''}`, async () => {
    const [place, topic, posts, navigation] = await Promise.all([client.get(placeSlug), client.topic(placeSlug, topicId), client.posts(placeSlug, topicId, cursor), client.forums(placeSlug)]);
    return { navigation, place, posts, topic };
  });
  if (resource.state.status !== 'ready') return <ResourceState resource={resource} title="Opening discussion" />;
  const { navigation, place, posts, topic } = resource.state.data;
  const forum = findForum(navigation, topic.forumId);
  return <div className="community-view discussion-view"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link to={`/places/${place.slug}`}>{place.name}</Link><span>/</span>{forum ? <Link to={`/places/${place.slug}/forums/${forum.id}`}>{forum.name}</Link> : null}</nav><header className="discussion-heading"><div className="topic-flags">{topic.isPinned ? <span><Pin size={13} />Pinned</span> : null}{topic.status === 'locked' ? <span><Lock size={13} />Locked</span> : null}{topic.tags.map((tag) => <span key={tag.id}>{tag.name}</span>)}</div><h2>{topic.title}</h2><p>Started by <Link to={`/members/${topic.author.handle}`}>{topic.author.displayName}</Link> · {formatDate(topic.createdAt)}</p></header><div className="post-stream">{posts.items.map((post, index) => <article className="post-row" key={post.id}><aside><span className="avatar">{initials(post.author.displayName)}</span><Link to={`/members/${post.author.handle}`}>{post.author.displayName}</Link><small>@{post.author.handle}</small></aside><div className="post-body"><header><span>#{index + 1}</span><time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time></header>{post.isDeleted ? <p className="deleted-copy">This reply was removed.</p> : post.document ? <RichText value={post.document} /> : <p>{post.plainText}</p>}</div></article>)}</div><CursorButton cursor={posts.nextCursor} path={`/places/${place.slug}/topics/${topic.id}`} /></div>;
}

export function ProfileRoute() {
  const client = usePlaceClient();
  const { handle = '' } = useParams();
  const resource = useRemoteResource(`profile:${handle}`, () => client.profile(handle));
  if (resource.state.status !== 'ready') return <ResourceState resource={resource} title="Loading profile" />;
  const profile = resource.state.data;
  return <div className="community-view profile-view"><span className="profile-avatar">{initials(profile.displayName)}</span><div><h2>{profile.displayName}</h2><p>@{profile.handle}</p><time dateTime={profile.joinedAt}>Joined {formatDate(profile.joinedAt)}</time></div></div>;
}

function ResourceState({ resource, title }: { resource: { reload(): void; state: { status: string; error?: unknown } }; title: string }) {
  if (resource.state.status === 'loading') return <RouteState state="loading" title={title} />;
  const error = resource.state.error;
  if (error instanceof DesktopApiError && (error.kind === 'not-found' || error.kind === 'gone' || error.kind === 'forbidden')) return <RouteState state="not-found" title="Content unavailable" message="This content is private, archived, or no longer exists." />;
  return <RouteState state="error" title="Could not load this view" message={messageForError(error)} onRetry={resource.reload} />;
}

function PlaceCard({ index, place }: { index: number; place: Place }) {
  return <article className="place-card"><div className={`place-card-visual tone-${index % 4}`}><span>{String(index + 1).padStart(2, '0')}</span><strong>{initials(place.name)}</strong><i /></div><div className="place-card-copy"><h3><Link to={`/places/${place.slug}`}>{place.name}</Link></h3><p>{place.description || 'A public place for focused conversation.'}</p><footer><span>{place.joinPolicy === 'open' ? <UsersRound size={14} /> : <Lock size={14} />}{joinLabel(place.joinPolicy)}</span><Link aria-label={`Open ${place.name}`} to={`/places/${place.slug}`}><ArrowRight size={17} /></Link></footer></div></article>;
}

function TopicRow({ placeSlug, topic }: { placeSlug: string; topic: Topic }) {
  return <article className="topic-row"><span className="avatar small">{initials(topic.author.displayName)}</span><div><div className="topic-flags">{topic.isPinned ? <Pin aria-label="Pinned" size={13} /> : null}{topic.status === 'locked' ? <Lock aria-label="Locked" size={13} /> : null}{topic.tags.map((tag) => <span key={tag.id}>{tag.name}</span>)}</div><h4><Link to={`/places/${placeSlug}/topics/${topic.id}`}>{topic.title}</Link></h4><p>By <Link to={`/members/${topic.author.handle}`}>{topic.author.displayName}</Link> · {relativeDate(topic.latestPostAt)}</p></div><dl><div><dt>Replies</dt><dd>{topic.replyCount}</dd></div><div><dt>Views</dt><dd>{formatCount(topic.viewCount)}</dd></div></dl></article>;
}

function EmptyContent({ icon, message, title }: { icon: ReactNode; message: string; title: string }) {
  return <div className="empty-content"><span>{icon}</span><div><h3>{title}</h3><p>{message}</p></div></div>;
}

function CursorButton({ cursor, parameters = {}, path }: { cursor?: string; parameters?: Record<string, string | undefined>; path: string }) {
  return cursor ? <div className="cursor-row"><Link className="button secondary" to={withQuery(path, { ...parameters, cursor })}>Load older results <ArrowRight size={15} /></Link></div> : null;
}

function highlight(value: string): ReactNode {
  return value.split(/(<mark>|<\/mark>)/g).reduce<ReactNode[]>((parts, part, index, source) => {
    if (!part || part === '<mark>' || part === '</mark>') return parts;
    parts.push(source[index - 1] === '<mark>' ? <mark key={`${part}-${index}`}>{part}</mark> : part);
    return parts;
  }, []);
}

function findForum(navigation: ForumNavigation, forumId: string) {
  return navigation.groups.flatMap((group) => group.forums).find((forum) => forum.id === forumId);
}

function withQuery(path: string, values: Record<string, string | undefined>): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) parameters.set(key, value);
  return `${path}${parameters.size ? `?${parameters}` : ''}`;
}

function parseJoinPolicy(value: string | null): Place['joinPolicy'] | undefined {
  return value === 'open' || value === 'approval' || value === 'invite_only' ? value : undefined;
}

function parseFeed(value: string | null): 'following' | 'latest' | 'popular' {
  return value === 'following' || value === 'popular' ? value : 'latest';
}

function parseSearchType(value: string | null): 'place' | 'post' | 'topic' | undefined {
  return value === 'place' || value === 'post' || value === 'topic' ? value : undefined;
}

function messageForError(error: unknown): string {
  if (error instanceof DesktopApiError) {
    if (error.kind === 'offline') return 'You are offline. Reconnect and try again.';
    if (error.kind === 'rate-limited') return 'Search is busy. Wait a moment and try again.';
    return error.message;
  }
  return 'The server could not complete this request.';
}

function joinLabel(policy: Place['joinPolicy']): string {
  if (policy === 'open') return 'Open to join';
  if (policy === 'approval') return 'Approval required';
  return 'Invite only';
}

function initials(value: string): string {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function humanize(value: string): string { return value.replaceAll('-', ' '); }
function formatCount(value: number): string { return new Intl.NumberFormat('en', { notation: value >= 1_000 ? 'compact' : 'standard' }).format(value); }
function formatDate(value: string): string { return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value)); }
function relativeDate(value: string): string {
  const hours = Math.floor((Date.now() - Date.parse(value)) / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  if (hours < 168) return `${Math.floor(hours / 24)}d ago`;
  return formatDate(value);
}

function ForumDirectory({ navigation, placeSlug, topics }: { navigation: ForumNavigation; placeSlug: string; topics: Topic[] }) {
  const forumCount = navigation.groups.reduce((count, group) => count + group.forums.length, 0);
  return <section className="forum-directory" aria-labelledby="forum-directory-heading"><header className="forum-directory-heading"><div><MessagesSquare aria-hidden="true" size={18} /><h2 id="forum-directory-heading">Forum boards</h2></div><span>{forumCount} {forumCount === 1 ? 'board' : 'boards'}</span></header><div className="forum-directory-columns" aria-hidden="true"><span>Board</span><span>Topics</span><span>Latest activity</span></div>{navigation.groups.map((group) => <section className="forum-group" key={group.id}><header><div><h3>{group.name}</h3>{group.description ? <p>{group.description}</p> : null}</div><span>{group.forums.length} {group.forums.length === 1 ? 'board' : 'boards'}</span></header><div>{group.forums.map((forum) => { const forumTopics = topics.filter((topic) => topic.forumId === forum.id); const latestTopic = [...forumTopics].sort((left, right) => Date.parse(right.latestPostAt) - Date.parse(left.latestPostAt))[0]; return <article className="forum-board-row" key={forum.id}><Link className="forum-board-main" to={`/places/${placeSlug}/forums/${forum.id}`}><span className="forum-board-icon"><MessagesSquare aria-hidden="true" size={18} /></span><span className="forum-board-copy"><strong>{forum.name}</strong><small>{forum.description}</small></span></Link><div className="forum-board-count"><strong>{forumTopics.length}</strong><small>shown</small></div><div className="forum-board-latest">{latestTopic ? <><Link to={`/places/${placeSlug}/topics/${latestTopic.id}`}>{latestTopic.title}</Link><time dateTime={latestTopic.latestPostAt}>{relativeDate(latestTopic.latestPostAt)}</time></> : <span>No topics yet</span>}</div></article>; })}</div></section>)}</section>;
}