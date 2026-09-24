import { ArrowUpRight, Clock3, Compass, Hash, LayoutList, Lock, LockKeyhole, MessagesSquare, MessageSquareText, Pin, SlidersHorizontal, UsersRound } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { CursorPagination } from "@/components/ui/cursor-pagination";
import { Select } from "@/components/ui/select";
import { StatusPanel } from "@/components/ui/status-panel";
import { ForumAuthoringActions } from "@/features/forums/create-topic-form";
import { TopicDiscussion } from "@/features/forums/topic-discussion";
import { placeDiscoveryTags, type PlaceContract, type PlacePageContract } from "@/features/places/place-contract";
import { PlaceForumHeader } from "@/features/places/place-forum-header";
import { resolveApiUrl } from "@/lib/api/request";
import { routes } from "@/lib/routes";
import type {
  ForumContract,
  ForumNavigationContract,
  PostPageContract,
  PublicProfileContract,
  TopicContract,
  TopicPageContract,
} from "./public-contracts";
import { ForumLiveSpaces } from "./forum-live-spaces";
import { ForumMemberPreview } from "./forum-member-preview";
import { TopicRowPreview } from "./topic-row-preview";

export function PlaceDirectory({ joinPolicy, page, tag }: { joinPolicy?: string; page: PlacePageContract; tag?: string }) {
  const facets = page.tags ?? [];
  return (
    <section className="discovery-directory" aria-labelledby="place-directory-heading">
      <div className="discovery-directory-heading">
        <div>
          <p className="eyebrow">Community atlas</p>
          <h2 id="place-directory-heading">{tag ? `Communities tagged #${tag}` : "Explore what people are building"}</h2>
        </div>
        <p>{page.items.length} {page.items.length === 1 ? "community" : "communities"} in view. Pick an interest or browse the whole field.</p>
      </div>
      {facets.length ? <nav className="discovery-tags" aria-label="Browse by interest">
        <Link aria-current={!tag ? "page" : undefined} className={!tag ? "active" : undefined} href={discoveryHref({ joinPolicy })}><Compass size={15} />All</Link>
        {facets.map((facet) => <Link aria-current={tag === facet.name ? "page" : undefined} aria-label={`${humanizeTag(facet.name)}, ${facet.count} ${facet.count === 1 ? "community" : "communities"}`} className={tag === facet.name ? "active" : undefined} href={discoveryHref({ joinPolicy, tag: facet.name })} key={facet.name}><Hash size={14} />{humanizeTag(facet.name)}<span>{facet.count}</span></Link>)}
      </nav> : null}
      <form action={routes.discover} className="discovery-filters" method="get">
        {tag ? <input name="tag" type="hidden" value={tag} /> : null}
        <label>Access<Select defaultValue={joinPolicy ?? ""} name="join" options={[{ label: "Any access", value: "" }, { label: "Open to join", value: "open" }, { label: "Request to join", value: "approval" }, { label: "Invite only", value: "invite_only" }]} /></label>
        <button className="secondary-button" type="submit"><SlidersHorizontal size={16} />Apply</button>
        {tag || joinPolicy ? <Link className="discovery-clear-filter" href={routes.discover}>Clear filters</Link> : null}
      </form>
      {page.items.length ? (
        <div className="place-directory" aria-label="Public places">
          {page.items.map((place, index) => (
            <article className="place-directory-item" key={place.id}>
              <div className={`place-card-visual place-card-visual-${index % 4}${place.hasBanner ? " has-banner" : ""}`}>
                {place.hasBanner ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={`${place.name} banner`} loading="lazy" src={publicPlaceBannerUrl(place.id)} />
                ) : <><span>{String(index + 1).padStart(2, "0")}</span><strong>{initials(place.name)}</strong><i /></>}
              </div>
              <div className="place-card-body">
                <p className="eyebrow">Community</p>
                <h3><Link href={routes.place(place.slug)}>{place.name}</Link></h3>
                <p className="place-card-description">{place.description || "A public place for focused conversation."}</p>
                {placeDiscoveryTags(place).length ? <div className="place-card-tags">{placeDiscoveryTags(place).map((placeTag) => <Link href={discoveryHref({ tag: placeTag })} key={placeTag}>#{placeTag}</Link>)}</div> : null}
                <div className="place-card-footer"><span>{place.joinPolicy === "open" ? <UsersRound size={15} /> : <LockKeyhole size={15} />}{joinPolicyLabel(place.joinPolicy)}</span><Link aria-label={`Open ${place.name}`} href={routes.place(place.slug)}><ArrowUpRight size={18} /></Link></div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <StatusPanel title="No communities found" description="Try another interest or remove the access filter." />
      )}
      <CursorPagination nextCursor={page.nextCursor} parameters={{ join: joinPolicy, tag }} path={routes.discover} />
    </section>
  );
}

function discoveryHref({ joinPolicy, tag }: { joinPolicy?: string; tag?: string }) {
  const parameters = new URLSearchParams();
  if (joinPolicy) parameters.set("join", joinPolicy);
  if (tag) parameters.set("tag", tag);
  return `${routes.discover}${parameters.size ? `?${parameters}` : ""}`;
}

function humanizeTag(tag: string) {
  return tag.replaceAll("-", " ");
}

function joinPolicyLabel(policy: PlaceContract["joinPolicy"]) {
  if (policy === "open") return "Open to join";
  if (policy === "approval") return "Request to join";
  return "Invite only";
}

function publicPlaceBannerUrl(placeId: string) {
  return resolveApiUrl("browser", `/public/places/${encodeURIComponent(placeId)}/images/banner`);
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
    <main className="public-main place-workspace-page forum-portal" id="main-content">
      <PlaceForumHeader active="forums" place={place} />
      <div className="forum-portal-grid">
        <div className="forum-portal-content">
          <ForumNavigation navigation={navigation} placeSlug={place.slug} topics={topics.items} />
          <TopicDirectory
            feed={feed}
            nextCursor={topics.nextCursor}
            path={routes.place(place.slug)}
            placeId={place.id}
            placeSlug={place.slug}
            tag={tag}
            topics={topics.items}
          />
        </div>
        <ForumPortalRail place={place} topics={topics.items} />
      </div>
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
    <main className="public-main place-workspace-page forum-subroute" id="main-content">
      <PlaceForumHeader active="forums" place={place} />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href={routes.place(place.slug)}>Forums</Link><span aria-hidden="true">/</span><span>{forum.name}</span>
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
        placeId={place.id}
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
    <main className="public-main place-workspace-page topic-page forum-subroute" id="main-content">
      <PlaceForumHeader active="forums" place={place} />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href={routes.place(place.slug)}>Forums</Link>
        {forum ? <><span aria-hidden="true">/</span><Link href={routes.forum(place.slug, forum.id)}>{forum.name}</Link></> : null}
      </nav>
      <TopicDiscussion initialPosts={posts} initialTopic={topic} place={place} />
      <CursorPagination nextCursor={posts.nextCursor} parameters={cursor ? { from: cursor } : undefined} path={routes.topic(place.slug, topic.id)} />
    </main>
  );
}

export function ProfileView({ profile }: { profile: PublicProfileContract }) {
  return (
    <main className="public-main" id="main-content">
      <section className="profile-summary">
        <Avatar initials={profileInitials(profile.displayName)} tone="coral" />
        <div>
          <p className="eyebrow">Public profile</p>
          <h1>{profile.displayName}</h1>
          <p className="profile-handle">@{profile.handle}</p>
          <time dateTime={profile.joinedAt}>Joined {formatPublicDate(profile.joinedAt)}</time>
        </div>
      </section>
    </main>
  );
}

function profileInitials(displayName: string): string {
  return displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
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

function ForumPortalRail({ place, topics }: { place: PlaceContract; topics: TopicContract[] }) {
  const recentTopics = [...topics]
    .sort((left, right) => Date.parse(right.latestPostAt) - Date.parse(left.latestPostAt))
    .slice(0, 6);
  return (
    <aside className="forum-portal-rail" aria-label="Community activity">
      <section className="portal-panel">
        <header><Clock3 size={17} aria-hidden="true" /><h2>Recent activity</h2></header>
        {recentTopics.length ? <div className="portal-activity-list">{recentTopics.map((topic) => (
          <article key={topic.id}>
            <Link href={routes.topic(place.slug, topic.id)}>{topic.title}</Link>
            <p>{topic.replyCount} {topic.replyCount === 1 ? "reply" : "replies"} · <time dateTime={topic.latestPostAt}>{formatRelativeDate(topic.latestPostAt)}</time></p>
          </article>
        ))}</div> : <p className="portal-panel-empty">No recent conversations.</p>}
      </section>
      <ForumMemberPreview placeId={place.id} placeName={place.name} placeSlug={place.slug} />
      <ForumLiveSpaces placeId={place.id} placeSlug={place.slug} />
    </aside>
  );
}

function ForumNavigation({ navigation, placeSlug, topics }: { navigation: ForumNavigationContract; placeSlug: string; topics: TopicContract[] }) {
  const forumCount = navigation.groups.reduce((count, group) => count + group.forums.length, 0);
  return (
    <section className="forum-directory" aria-labelledby="forums-heading">
      <header className="forum-directory-heading">
        <div><LayoutList size={18} aria-hidden="true" /><h2 id="forums-heading">Forum boards</h2></div>
        <span>{forumCount} {forumCount === 1 ? "board" : "boards"}</span>
      </header>
      <div className="forum-directory-columns" aria-hidden="true"><span>Board</span><span>Topics</span><span>Latest activity</span></div>
      {navigation.groups.length ? navigation.groups.map((group) => (
        <section className="forum-group" key={group.id}>
          <header><div><h3>{group.name}</h3>{group.description ? <p>{group.description}</p> : null}</div><span>{group.forums.length} {group.forums.length === 1 ? "board" : "boards"}</span></header>
          <div className="forum-group-rows">
            {group.forums.map((forum) => {
              const forumTopics = topics.filter((topic) => topic.forumId === forum.id);
              const latestTopic = [...forumTopics].sort((left, right) => Date.parse(right.latestPostAt) - Date.parse(left.latestPostAt))[0];
              return (
                <article className="forum-row" key={forum.id}>
                  <Link className="forum-row-main" href={routes.forum(placeSlug, forum.id)}>
                    <span className="forum-row-icon"><MessagesSquare size={19} aria-hidden="true" /></span>
                    <span className="forum-row-copy"><strong>{forum.name}</strong><small>{forum.description}</small></span>
                  </Link>
                  <div className="forum-row-count"><strong>{forumTopics.length}</strong><small>shown</small></div>
                  <div className="forum-row-latest">
                    {latestTopic ? <><Link href={routes.topic(placeSlug, latestTopic.id)}>{latestTopic.title}</Link><time dateTime={latestTopic.latestPostAt}>{formatRelativeDate(latestTopic.latestPostAt)}</time></> : <span>No topics yet</span>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )) : <div className="forum-directory-empty" role="status">
        <span className="forum-directory-empty-icon" aria-hidden="true"><MessageSquareText size={20} /></span>
        <div><h3>No public forums</h3><p>This place has not published any forums yet.</p></div>
      </div>}
    </section>
  );
}

function TopicDirectory({
  feed,
  nextCursor,
  path,
  placeId,
  placeSlug,
  tag,
  topics,
}: {
  feed: "following" | "latest" | "popular";
  nextCursor?: string;
  path: string;
  placeId: string;
  placeSlug: string;
  tag?: string;
  topics: TopicContract[];
}) {
  return (
    <section className="public-topics" aria-labelledby="public-topics-heading">
      <div className="public-topic-toolbar">
        <div className="public-topic-toolbar-heading">
          <h2 id="public-topics-heading">Discussions</h2>
          <ForumAuthoringActions placeId={placeId} placeSlug={placeSlug} />
        </div>
        <nav aria-label="Topic filters">
          {(["latest", "popular", "following"] as const).map((value) => (
            <Link className={feed === value ? "active" : ""} href={`${path}?feed=${value}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`} key={value}>{capitalize(value)}</Link>
          ))}
        </nav>
      </div>
      {topics.length ? topics.map((topic) => (
        <article className="public-topic-row" key={topic.id}>
          <TopicRowPreview placeId={placeId} previewImage={topic.previewImage} />
          <div className="public-topic-main">
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
      )) : <div className="forum-directory-empty public-topics-empty" role="status">
        <span className="forum-directory-empty-icon" aria-hidden="true"><MessageSquareText size={20} /></span>
        <div><h3>No discussions found</h3><p>Try another feed or return later.</p></div>
      </div>}
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

function formatRelativeDate(value: string): string {
  const elapsed = Date.now() - Date.parse(value);
  const hours = Math.floor(elapsed / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatPublicDate(value);
}

function initials(value: string): string {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}