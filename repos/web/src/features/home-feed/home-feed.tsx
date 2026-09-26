"use client";

import {
  ArrowBigUp,
  Bell,
  BellRing,
  Bookmark,
  BookmarkCheck,
  Clock3,
  Compass,
  Eye,
  Flame,
  Hash,
  LoaderCircle,
  MessageCircle,
  RotateCcw,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/features/auth/session-provider";
import { setReaction, setTopicFollow, setTopicSave } from "@/features/forums/forum-client";
import { resolveApiUrl } from "@/lib/api/request";
import { routes } from "@/lib/routes";
import { listHomeFeed } from "./home-feed-client";
import type { HomeFeedItemContract, HomeFeedSort, HomeFeedSource } from "./home-feed-contract";

const sorts: Array<{ icon: typeof Sparkles; id: HomeFeedSort; label: string }> = [
  { icon: Sparkles, id: "best", label: "Best" },
  { icon: Flame, id: "hot", label: "Hot" },
  { icon: Clock3, id: "new", label: "New" },
  { icon: Trophy, id: "top", label: "Top" },
];

export function HomeFeed() {
  const session = useSession();
  const router = useRouter();
  const [sort, setSort] = useState<HomeFeedSort>("best");
  const [items, setItems] = useState<HomeFeedItemContract[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [status, setStatus] = useState<"error" | "loading" | "ready">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingAction, setPendingAction] = useState<string>();
  const [reloadRequest, setReloadRequest] = useState(0);
  const [manualLoadRequest, setManualLoadRequest] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const handledManualLoadRequest = useRef(0);
  const requestPending = useRef(false);
  const authenticated = session.status === "authenticated";
  const sessionReady = session.status !== "loading";

  useEffect(() => {
    if (!sessionReady) return;
    let active = true;
    requestPending.current = true;
    void listHomeFeed(sort, undefined, authenticated)
      .then((page) => {
        if (!active) return;
        startTransition(() => {
          setItems(page.items);
          setCursor(page.nextCursor);
          setStatus("ready");
        });
      })
      .catch(() => { if (active) setStatus("error"); })
      .finally(() => { requestPending.current = false; });
    return () => { active = false; };
  }, [authenticated, reloadRequest, sessionReady, sort]);

  useEffect(() => {
    const target = sentinel.current;
    if (!target || !cursor || status !== "ready") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "360px 0px" });
    observer.observe(target);
    if (manualLoadRequest > handledManualLoadRequest.current) {
      handledManualLoadRequest.current = manualLoadRequest;
      void loadMore();
    }
    return () => observer.disconnect();

    async function loadMore() {
      if (requestPending.current || !cursor) return;
      requestPending.current = true;
      setLoadingMore(true);
      try {
        const page = await listHomeFeed(sort, cursor, authenticated);
        setItems((current) => {
          const known = new Set(current.map((item) => item.topic.id));
          return [...current, ...page.items.filter((item) => !known.has(item.topic.id))];
        });
        setCursor(page.nextCursor);
      } catch {
        toast.error("More discussions could not be loaded.");
      } finally {
        requestPending.current = false;
        setLoadingMore(false);
      }
    }
  }, [authenticated, cursor, manualLoadRequest, sort, status]);

  function signInForEngagement() {
    router.push(`${routes.signIn}?returnTo=${encodeURIComponent(routes.home)}`);
  }

  function updateItem(topicId: string, update: (item: HomeFeedItemContract) => HomeFeedItemContract) {
    setItems((current) => current.map((item) => item.topic.id === topicId ? update(item) : item));
  }

  async function toggleLike(item: HomeFeedItemContract) {
    if (!authenticated) return signInForEngagement();
    const next = !item.viewerHasReacted;
    setPendingAction(`like-${item.topic.id}`);
    try {
      await setReaction(item.place.id, item.originalPostId, "like", next);
      updateItem(item.topic.id, (current) => ({
        ...current,
        reactionCount: Math.max(0, current.reactionCount + (next ? 1 : -1)),
        viewerHasReacted: next,
      }));
    } catch { toast.error("Your reaction could not be saved."); }
    finally { setPendingAction(undefined); }
  }

  async function toggleFollow(item: HomeFeedItemContract) {
    if (!authenticated) return signInForEngagement();
    const next = !item.isFollowing;
    setPendingAction(`follow-${item.topic.id}`);
    try {
      await setTopicFollow(item.place.id, item.topic.id, next);
      updateItem(item.topic.id, (current) => ({
        ...current,
        isFollowing: next,
        sources: next
          ? ["following", ...current.sources.filter((source) => source !== "following")]
          : current.sources.filter((source) => source !== "following"),
      }));
      toast.success(next ? "Discussion followed." : "Discussion unfollowed.");
    } catch { toast.error("Follow status could not be changed."); }
    finally { setPendingAction(undefined); }
  }

  async function toggleSave(item: HomeFeedItemContract) {
    if (!authenticated) return signInForEngagement();
    const next = !item.isSaved;
    setPendingAction(`save-${item.topic.id}`);
    try {
      await setTopicSave(item.place.id, item.topic.id, next);
      updateItem(item.topic.id, (current) => ({ ...current, isSaved: next }));
      toast.success(next ? "Discussion saved." : "Discussion removed from Saved.");
    } catch { toast.error("Save status could not be changed."); }
    finally { setPendingAction(undefined); }
  }

  function retry() {
    setStatus("loading");
    setReloadRequest((current) => current + 1);
  }

  return (
    <main className="home-feed-page" id="main-content">
      <header className="feed-overview">
        <div>
          <h1>Home</h1>
          <p>{authenticated ? "Conversations from your circles, with a little room for discovery." : "The conversations gathering momentum right now."}</p>
        </div>
      </header>

      <div className="feed-layout">
        <section className="feed-stream" aria-labelledby="feed-heading">
          <div className="feed-controls">
            <h2 className="sr-only" id="feed-heading">Discussion feed</h2>
            <div className="feed-sort-tabs" aria-label="Sort discussions" role="tablist">
              {sorts.map((option) => <button
                aria-selected={sort === option.id}
                disabled={status === "loading"}
                key={option.id}
                onClick={() => startTransition(() => {
                  setManualLoadRequest(0);
                  setStatus("loading");
                  setItems([]);
                  setCursor(undefined);
                  setSort(option.id);
                })}
                role="tab"
                type="button"
              ><option.icon aria-hidden="true" size={15} />{option.label}</button>)}
            </div>
            <span className="feed-result-label">{status === "ready" ? `${items.length} loaded` : "Gathering discussions"}</span>
          </div>

          {status === "loading" || !sessionReady ? <FeedSkeleton /> : null}
          {status === "error" ? <FeedError onRetry={retry} /> : null}
          {status === "ready" && items.length === 0 ? <FeedEmpty /> : null}
          {status === "ready" && items.length ? <div className="feed-list">
            {items.map((item) => <FeedCard
              authenticated={authenticated}
              item={item}
              key={item.topic.id}
              onFollow={() => void toggleFollow(item)}
              onLike={() => void toggleLike(item)}
              onSave={() => void toggleSave(item)}
              pendingAction={pendingAction}
            />)}
          </div> : null}

          <div className="feed-sentinel" ref={sentinel}>
            {cursor ? <button className="feed-load-button" disabled={loadingMore} onClick={() => setManualLoadRequest((current) => current + 1)} type="button">
              {loadingMore ? <><LoaderCircle className="spin" size={16} />Loading more</> : "Load more discussions"}
            </button> : status === "ready" && items.length ? <p>You&apos;re caught up.</p> : null}
          </div>
        </section>

        <FeedRail authenticated={authenticated} items={items} />
      </div>
    </main>
  );
}

function FeedCard({
  authenticated,
  item,
  onFollow,
  onLike,
  onSave,
  pendingAction,
}: {
  authenticated: boolean;
  item: HomeFeedItemContract;
  onFollow: () => void;
  onLike: () => void;
  onSave: () => void;
  pendingAction?: string;
}) {
  const href = routes.topic(item.place.slug, item.topic.id);
  const source = primarySource(item.sources);
  return (
    <article className="feed-card">
      <div className="feed-vote-column">
        <button
          aria-label={`${item.viewerHasReacted ? "Remove like from" : "Like"} ${item.topic.title}`}
          aria-pressed={item.viewerHasReacted}
          disabled={pendingAction === `like-${item.topic.id}`}
          onClick={onLike}
          title={authenticated ? (item.viewerHasReacted ? "Remove like" : "Like discussion") : "Sign in to react"}
          type="button"
        ><ArrowBigUp aria-hidden="true" size={22} /><strong>{compactNumber(item.reactionCount)}</strong></button>
      </div>
      <div className="feed-card-content">
        <header className="feed-card-context">
          <Link className="feed-place-mark" href={routes.place(item.place.slug)} aria-label={item.place.name}>{initials(item.place.name)}</Link>
          <p><Link href={routes.place(item.place.slug)}>{item.place.name}</Link><span>in {item.forum.name}</span></p>
          <span className={`feed-source feed-source-${source}`}><SourceIcon source={source} />{sourceLabel(source)}</span>
          <time dateTime={item.topic.latestPostAt}>{relativeTime(item.topic.latestPostAt)}</time>
        </header>
        <div className={item.topic.previewImage ? "feed-card-story has-image" : "feed-card-story"}>
          <div>
            <h2><Link href={href}>{item.topic.title}</Link></h2>
            <p className="feed-author">Started by <Link href={routes.member(item.topic.author.handle)}>{item.topic.author.displayName}</Link></p>
            {item.excerpt ? <p className="feed-excerpt">{item.excerpt}</p> : null}
            {item.topic.tags.length ? <div className="feed-tags">{item.topic.tags.slice(0, 4).map((tag) => <span key={tag.id}><i style={{ backgroundColor: tag.color ?? "var(--teal)" }} /><Hash aria-hidden="true" size={10} />{tag.name}</span>)}</div> : null}
          </div>
          {item.topic.previewImage ? <FeedImage item={item} /> : null}
        </div>
        <footer className="feed-card-actions">
          <Link href={href}><MessageCircle aria-hidden="true" size={15} />{item.topic.replyCount} {item.topic.replyCount === 1 ? "reply" : "replies"}</Link>
          <span><Eye aria-hidden="true" size={15} />{compactNumber(item.topic.viewCount)}</span>
          <button aria-pressed={item.isFollowing} disabled={pendingAction === `follow-${item.topic.id}`} onClick={onFollow} title={item.isFollowing ? "Unfollow discussion" : "Follow discussion"} type="button">
            {item.isFollowing ? <BellRing aria-hidden="true" size={15} /> : <Bell aria-hidden="true" size={15} />}<span>{item.isFollowing ? "Following" : "Follow"}</span>
          </button>
          <button aria-pressed={item.isSaved} disabled={pendingAction === `save-${item.topic.id}`} onClick={onSave} title={item.isSaved ? "Remove from Saved" : "Save discussion"} type="button">
            {item.isSaved ? <BookmarkCheck aria-hidden="true" size={15} /> : <Bookmark aria-hidden="true" size={15} />}<span>{item.isSaved ? "Saved" : "Save"}</span>
          </button>
        </footer>
      </div>
    </article>
  );
}

function FeedImage({ item }: { item: HomeFeedItemContract }) {
  const [failed, setFailed] = useState(false);
  if (!item.topic.previewImage || failed) return null;
  return <Link className="feed-preview-image" href={routes.topic(item.place.slug, item.topic.id)} tabIndex={-1}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      alt={item.topic.previewImage.alt}
      loading="lazy"
      onError={() => setFailed(true)}
      src={resolveApiUrl("browser", `/public/places/${encodeURIComponent(item.place.id)}/images/posts/${encodeURIComponent(item.topic.previewImage.assetId)}`)}
    />
  </Link>;
}

function FeedRail({ authenticated, items }: { authenticated: boolean; items: HomeFeedItemContract[] }) {
  const places = [...items.reduce((counts, item) => {
    const current = counts.get(item.place.id);
    counts.set(item.place.id, { count: (current?.count ?? 0) + 1, ...item.place });
    return counts;
  }, new Map<string, HomeFeedItemContract["place"] & { count: number }>()).values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
  return <aside className="feed-rail" aria-label="Feed context">
    <section>
      <header><Compass aria-hidden="true" size={17} /><h2>Active places</h2></header>
      {places.length ? <ol className="feed-place-list">{places.map((place, index) => <li key={place.id}><span>{index + 1}</span><Link href={routes.place(place.slug)}><strong>{place.name}</strong><small>{place.count} in your feed</small></Link></li>)}</ol> : <div className="feed-rail-placeholder" />}
      <Link className="feed-rail-link" href={routes.discover}>Explore all places <span aria-hidden="true">→</span></Link>
    </section>
    <section>
      <header><Users aria-hidden="true" size={17} /><h2>{authenticated ? "Your shortcuts" : "Join the discussion"}</h2></header>
      <p>{authenticated ? "Keep useful conversations close, or find another community to call home." : "Follow conversations, save useful posts, and shape a feed around your interests."}</p>
      <div className="feed-rail-actions">
        {authenticated ? <Link href={routes.saved}><Bookmark aria-hidden="true" size={15} />Saved discussions</Link> : <Link href={routes.register}>Create an account</Link>}
        {!authenticated ? <Link href={`${routes.signIn}?returnTo=${encodeURIComponent(routes.home)}`}>Sign in</Link> : null}
      </div>
    </section>
  </aside>;
}

function FeedSkeleton() {
  return <div className="feed-list feed-skeleton" aria-label="Loading discussions" aria-live="polite">{[0, 1, 2].map((item) => <div className="feed-card" key={item}><span /><div><i /><i /><i /><i /></div></div>)}</div>;
}

function FeedError({ onRetry }: { onRetry: () => void }) {
  return <div className="feed-state" role="alert"><span><RotateCcw aria-hidden="true" size={22} /></span><h2>The feed missed a beat</h2><p>Discussions could not be loaded right now.</p><button className="secondary-button" onClick={onRetry} type="button">Try again</button></div>;
}

function FeedEmpty() {
  return <div className="feed-state"><span><MessageCircle aria-hidden="true" size={22} /></span><h2>Quiet for now</h2><p>Fresh conversations will appear here as communities get talking.</p><Link className="secondary-button" href={routes.discover}>Explore places</Link></div>;
}

function primarySource(sources: HomeFeedSource[]): HomeFeedSource {
  if (sources.includes("following")) return "following";
  if (sources.includes("joined")) return "joined";
  return "trending";
}

function SourceIcon({ source }: { source: HomeFeedSource }) {
  if (source === "following") return <BellRing aria-hidden="true" size={11} />;
  if (source === "joined") return <Users aria-hidden="true" size={11} />;
  return <Flame aria-hidden="true" size={11} />;
}

function sourceLabel(source: HomeFeedSource) {
  if (source === "following") return "Following";
  if (source === "joined") return "Your places";
  return "Trending";
}

function initials(value: string) {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function relativeTime(value: string) {
  const elapsed = Date.parse(value) - Date.now();
  const minutes = Math.round(elapsed / 60_000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return formatter.format(days, "day");
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}