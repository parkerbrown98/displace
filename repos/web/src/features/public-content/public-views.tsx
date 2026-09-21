import { Lock, MessageSquareText, Pin, Users } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { CursorPagination } from "@/components/ui/cursor-pagination";
import { StatusPanel } from "@/components/ui/status-panel";
import type { PlaceContract, PlacePageContract } from "@/features/places/place-contract";
import { PlaceMembershipActions } from "@/features/places/place-access";
import { routes } from "@/lib/routes";
import type {
  ForumContract,
  ForumNavigationContract,
  PostPageContract,
  PublicProfileFixture,
  TopicContract,
  TopicPageContract,
} from "./public-contracts";
import { RichText } from "./rich-text";

export function DiscoveryView({ joinPolicy, page, query }: { joinPolicy?: string; page: PlacePageContract; query?: string }) {
  return (
    <main className="public-main" id="main-content">
      <header className="public-page-heading">
        <p className="eyebrow">Open communities</p>
        <h1>Find your next conversation</h1>
        <p>Browse public places built around durable, searchable discussion.</p>
      </header>
      <form className="discovery-filters" method="get">
        <label className="form-field">Search places<input defaultValue={query} name="q" placeholder="Name or description" type="search" /></label>
        <label className="form-field">Join policy<select defaultValue={joinPolicy ?? ""} name="join"><option value="">Any policy</option><option value="open">Open</option><option value="approval">Approval required</option><option value="invite_only">Invite only</option></select></label>
        <button className="secondary-button" type="submit">Apply filters</button>
      </form>
      {page.items.length ? (
        <section className="place-directory" aria-label="Public places">
          {page.items.map((place, index) => (
            <article className="place-directory-item" key={place.id}>
              <span className={`directory-mark directory-mark-${index % 3}`} aria-hidden="true">
                {initials(place.name)}
              </span>
              <div>
                <p className="eyebrow">{place.visibility} place</p>
                <h2><Link href={routes.place(place.slug)}>{place.name}</Link></h2>
                <p>{place.description}</p>
              </div>
              <Link className="text-link" href={routes.place(place.slug)}>View place</Link>
            </article>
          ))}
        </section>
      ) : (
        <StatusPanel title="No more places" description="There are no additional public places to show." />
      )}
      <CursorPagination nextCursor={page.nextCursor} path={routes.discover} />
    </main>
  );
}

interface PlaceViewProps {
  feed: "following" | "latest" | "popular";
  navigation: ForumNavigationContract;
  place: PlaceContract;
  tag?: string;
  topics: TopicPageContract;
}

export function PlaceView({ feed, navigation, place, tag, topics }: PlaceViewProps) {
  return (
    <main className="public-main" id="main-content">
      <header className="place-profile-header">
        <div>
          <p className="eyebrow">Place / {place.visibility}</p>
          <h1>{place.name}</h1>
          <p>{place.description}</p>
        </div>
        <div className="place-header-actions"><span><Users size={17} aria-hidden="true" /> {place.visibility === "public" ? "Public community" : place.visibility}</span><PlaceMembershipActions place={place} /></div>
      </header>
      <ForumNavigation navigation={navigation} placeSlug={place.slug} />
      <TopicDirectory
        feed={feed}
        nextCursor={topics.nextCursor}
        path={routes.place(place.slug)}
        placeSlug={place.slug}
        tag={tag}
        topics={topics.items}
      />
    </main>
  );
}

export function ForumView({
  feed,
  forum,
  place,
  topics,
}: {
  feed: "following" | "latest" | "popular";
  forum: ForumContract;
  place: PlaceContract;
  topics: TopicPageContract;
}) {
  return (
    <main className="public-main" id="main-content">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href={routes.place(place.slug)}>{place.name}</Link><span aria-hidden="true">/</span><span>{forum.name}</span>
      </nav>
      <header className="public-page-heading compact-heading">
        <p className="eyebrow">Forum</p>
        <h1>{forum.name}</h1>
        <p>{forum.description}</p>
      </header>
      <TopicDirectory
        feed={feed}
        nextCursor={topics.nextCursor}
        path={routes.forum(place.slug, forum.id)}
        placeSlug={place.slug}
        topics={topics.items}
      />
    </main>
  );
}

export function TopicView({
  cursor,
  forum,
  place,
  posts,
  topic,
}: {
  cursor?: string;
  forum?: ForumContract;
  place: PlaceContract;
  posts: PostPageContract;
  topic: TopicContract;
}) {
  return (
    <main className="public-main topic-page" id="main-content">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href={routes.place(place.slug)}>{place.name}</Link>
        {forum ? <><span aria-hidden="true">/</span><Link href={routes.forum(place.slug, forum.id)}>{forum.name}</Link></> : null}
      </nav>
      <header className="topic-header">
        <div className="topic-flags">
          {topic.isPinned ? <span><Pin size={14} aria-hidden="true" /> Pinned</span> : null}
          {topic.status === "locked" ? <span><Lock size={14} aria-hidden="true" /> Locked</span> : null}
        </div>
        <h1>{topic.title}</h1>
        <div className="topic-summary">
          <span>{topic.replyCount} replies</span><span>{formatCount(topic.viewCount)} views</span>
          <time dateTime={topic.createdAt}>{formatPublicDate(topic.createdAt)}</time>
        </div>
      </header>
      <section className="post-list" aria-label="Posts">
        {posts.items.map((post, index) => (
          <article className={`post${post.isDeleted ? " post-deleted" : ""}`} key={post.id}>
            <header>
              <Avatar initials={post.isDeleted ? "-" : memberInitials(post.authorUserId)} size="small" />
              <div><strong>{post.isDeleted ? "Deleted member" : "Community member"}</strong><time dateTime={post.createdAt}>{formatPublicDate(post.createdAt)}</time></div>
              <a href={`#post-${post.id}`} id={`post-${post.id}`} aria-label={`Post ${index + 1}`}>#{index + 1}</a>
            </header>
            {post.isDeleted || !post.document ? (
              <p className="tombstone">This post was removed.</p>
            ) : (
              <RichText document={post.document} />
            )}
          </article>
        ))}
      </section>
      <CursorPagination nextCursor={posts.nextCursor} parameters={cursor ? { from: cursor } : undefined} path={routes.topic(place.slug, topic.id)} />
    </main>
  );
}

export function ProfileView({ profile }: { profile: PublicProfileFixture }) {
  return (
    <main className="public-main" id="main-content">
      <section className="profile-summary">
        <Avatar initials={profile.initials} tone="coral" />
        <div>
          <p className="eyebrow">Public profile</p>
          <h1>{profile.displayName}</h1>
          <p className="profile-handle">@{profile.handle}</p>
          <p>{profile.summary}</p>
          <time dateTime={profile.joinedAt}>Joined {formatPublicDate(profile.joinedAt)}</time>
        </div>
      </section>
    </main>
  );
}

export function PublicUnavailableView() {
  return (
    <main className="public-main standalone-public-state" id="main-content">
      <StatusPanel
        description="This content cannot be displayed right now. Try again in a little while."
        title="Content unavailable"
        tone="error"
      />
    </main>
  );
}

export function findForum(navigation: ForumNavigationContract, forumId: string): ForumContract | undefined {
  return navigation.groups.flatMap((group) => group.forums).find((forum) => forum.id === forumId);
}

function ForumNavigation({ navigation, placeSlug }: { navigation: ForumNavigationContract; placeSlug: string }) {
  return (
    <section className="forum-directory" aria-labelledby="forums-heading">
      <div className="section-heading"><p className="eyebrow">Forums</p><h2 id="forums-heading">Browse discussions</h2></div>
      {navigation.groups.length ? navigation.groups.map((group) => (
        <div className="forum-group" key={group.id}>
          <header><h3>{group.name}</h3><p>{group.description}</p></header>
          <div>
            {group.forums.map((forum) => (
              <Link className="forum-row" href={routes.forum(placeSlug, forum.id)} key={forum.id}>
                <MessageSquareText size={19} aria-hidden="true" />
                <span><strong>{forum.name}</strong><small>{forum.description}</small></span>
              </Link>
            ))}
          </div>
        </div>
      )) : <StatusPanel title="No public forums" description="This place has not published any forums yet." />}
    </section>
  );
}

function TopicDirectory({
  feed,
  nextCursor,
  path,
  placeSlug,
  tag,
  topics,
}: {
  feed: "following" | "latest" | "popular";
  nextCursor?: string;
  path: string;
  placeSlug: string;
  tag?: string;
  topics: TopicContract[];
}) {
  return (
    <section className="public-topics" aria-labelledby="public-topics-heading">
      <div className="public-topic-toolbar">
        <h2 id="public-topics-heading">Discussions</h2>
        <nav aria-label="Topic filters">
          {(["latest", "popular", "following"] as const).map((value) => (
            <Link className={feed === value ? "active" : ""} href={`${path}?feed=${value}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`} key={value}>{capitalize(value)}</Link>
          ))}
        </nav>
      </div>
      {topics.length ? topics.map((topic) => (
        <article className="public-topic-row" key={topic.id}>
          <div>
            <div className="topic-flags">
              {topic.isPinned ? <Pin size={14} aria-label="Pinned" /> : null}
              {topic.status === "locked" ? <Lock size={14} aria-label="Locked" /> : null}
              {topic.tags.map((topicTag) => <span className="category-tag" key={topicTag.id}>{topicTag.name}</span>)}
            </div>
            <h3><Link href={routes.topic(placeSlug, topic.id)}>{topic.title}</Link></h3>
            <time dateTime={topic.latestPostAt}>Active {formatPublicDate(topic.latestPostAt)}</time>
          </div>
          <dl><div><dt>Replies</dt><dd>{topic.replyCount}</dd></div><div><dt>Views</dt><dd>{formatCount(topic.viewCount)}</dd></div></dl>
        </article>
      )) : <StatusPanel title="No discussions found" description="Try another feed or return later." />}
      <CursorPagination nextCursor={nextCursor} parameters={{ feed, tag }} path={path} />
    </section>
  );
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en", { notation: value >= 1_000 ? "compact" : "standard" }).format(value);
}

function formatPublicDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function initials(value: string): string {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function memberInitials(userId: string): string {
  return userId.slice(-2).toUpperCase();
}