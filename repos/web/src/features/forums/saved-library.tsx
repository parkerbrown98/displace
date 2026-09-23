"use client";

import { ArrowRight, Bookmark, BookmarkX, Clock3, FileText, Hash, MessageSquareText, Search } from "lucide-react";
import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { LoadingPanel, StatusPanel } from "@/components/ui/status-panel";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/features/auth/session-provider";
import { routes } from "@/lib/routes";
import { listSavedPosts, listSavedTopics, setPostSave, setTopicSave } from "./forum-client";
import type { SavedPostContract, SavedTopicContract } from "./forum-contract";

type SavedFilter = "all" | "posts" | "topics";
type SavedItem = { id: string; savedAt: string; type: "post"; value: SavedPostContract } | { id: string; savedAt: string; type: "topic"; value: SavedTopicContract };

export function SavedLibrary() {
  const session = useSession();
  const [topics, setTopics] = useState<SavedTopicContract[]>([]);
  const [posts, setPosts] = useState<SavedPostContract[]>([]);
  const [topicCursor, setTopicCursor] = useState<string>();
  const [postCursor, setPostCursor] = useState<string>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [filter, setFilter] = useState<SavedFilter>("all");
  const [placeId, setPlaceId] = useState("all");
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<string>();

  useEffect(() => {
    if (session.status !== "authenticated") return;
    let active = true;
    void Promise.all([listSavedTopics(), listSavedPosts()]).then(([topicPage, postPage]) => {
      if (!active) return;
      startTransition(() => {
        setTopics(topicPage.items);
        setPosts(postPage.items);
        setTopicCursor(topicPage.nextCursor);
        setPostCursor(postPage.nextCursor);
        setStatus("ready");
      });
    }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [session.status]);

  if (session.status === "loading" || (session.status === "authenticated" && status === "loading")) return <LoadingPanel label="Loading saved items" />;
  if (session.status !== "authenticated") return <StatusPanel action={<Link className="primary-button" href={`${routes.signIn}?returnTo=${encodeURIComponent(routes.saved)}`}>Sign in</Link>} description="Saved topics and posts are private to your account." title="Sign in to view saved items" />;
  if (status === "error") return <StatusPanel description="Your saved items could not be loaded. Try again shortly." title="Saved items unavailable" tone="error" />;

  async function moreTopics() {
    setPending("more-topics");
    try {
      const page = await listSavedTopics(topicCursor);
      setTopics((items) => [...items, ...page.items]);
      setTopicCursor(page.nextCursor);
    } catch { toast.error("More saved topics could not be loaded."); }
    finally { setPending(undefined); }
  }

  async function morePosts() {
    setPending("more-posts");
    try {
      const page = await listSavedPosts(postCursor);
      setPosts((items) => [...items, ...page.items]);
      setPostCursor(page.nextCursor);
    } catch { toast.error("More saved posts could not be loaded."); }
    finally { setPending(undefined); }
  }

  async function removeTopic(item: SavedTopicContract) {
    const key = `topic-${item.topic.id}`;
    setPending(key);
    try {
      await setTopicSave(item.placeId, item.topic.id, false);
      setTopics((items) => items.filter((current) => current !== item));
      toast.success("Topic removed from Saved.");
    } catch { toast.error("The saved topic could not be removed."); }
    finally { setPending(undefined); }
  }

  async function removePost(item: SavedPostContract) {
    const key = `post-${item.post.id}`;
    setPending(key);
    try {
      await setPostSave(item.placeId, item.post.id, false);
      setPosts((items) => items.filter((current) => current !== item));
      toast.success("Post removed from Saved.");
    } catch { toast.error("The saved post could not be removed."); }
    finally { setPending(undefined); }
  }

  const places = savedPlaces(topics, posts);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const items: SavedItem[] = [
    ...topics.map((value) => ({ id: `topic-${value.topic.id}`, savedAt: value.savedAt, type: "topic" as const, value })),
    ...posts.map((value) => ({ id: `post-${value.post.id}`, savedAt: value.savedAt, type: "post" as const, value })),
  ].filter((item) => filter === "all" || `${item.type}s` === filter)
    .filter((item) => placeId === "all" || item.value.placeId === placeId)
    .filter((item) => !normalizedQuery || searchableText(item).includes(normalizedQuery))
    .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt));

  const filtered = filter !== "all" || placeId !== "all" || Boolean(normalizedQuery);

  return (
    <div className="saved-library">
      <header className="saved-library-header">
        <div><p className="eyebrow">Personal library</p><h1>Saved</h1><p>Keep the discussions worth returning to close at hand.</p></div>
        <dl className="saved-totals"><div><dt>Topics</dt><dd>{topics.length}</dd></div><div><dt>Posts</dt><dd>{posts.length}</dd></div></dl>
      </header>

      <div className="saved-command-bar">
        <div className="saved-filter-tabs" aria-label="Saved item type">
          <FilterButton active={filter === "all"} count={topics.length + posts.length} label="All" onClick={() => setFilter("all")} />
          <FilterButton active={filter === "topics"} count={topics.length} label="Topics" onClick={() => setFilter("topics")} />
          <FilterButton active={filter === "posts"} count={posts.length} label="Posts" onClick={() => setFilter("posts")} />
        </div>
        <label className="saved-search"><Search aria-hidden="true" size={17} /><span className="sr-only">Search saved items</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Search saved items" type="search" value={query} /></label>
      </div>

      <div className="saved-workspace">
        <aside className="saved-place-filter" aria-label="Filter by place">
          <p className="eyebrow">Places</p>
          <button aria-pressed={placeId === "all"} onClick={() => setPlaceId("all")} type="button"><Bookmark size={15} /><span>All places</span><small>{topics.length + posts.length}</small></button>
          {places.map((place) => <button aria-pressed={placeId === place.id} key={place.id} onClick={() => setPlaceId(place.id)} type="button"><span className="saved-place-mark" aria-hidden="true">{initials(place.name)}</span><span>{place.name}</span><small>{place.count}</small></button>)}
        </aside>

        <section className="saved-results" aria-labelledby="saved-results-heading">
          <header><div><p className="eyebrow">Reading queue</p><h2 id="saved-results-heading">{resultsTitle(filter, placeId, places)}</h2></div><span>{items.length} {items.length === 1 ? "item" : "items"}</span></header>
          {items.length ? <div className="saved-list">{items.map((item) => item.type === "topic" ? <SavedTopic key={item.id} item={item.value} onRemove={removeTopic} pending={pending === item.id} /> : <SavedPost key={item.id} item={item.value} onRemove={removePost} pending={pending === item.id} />)}</div> : <SavedEmpty filtered={filtered} onReset={() => { setFilter("all"); setPlaceId("all"); setQuery(""); }} />}
          <div className="saved-load-more">
            {topicCursor && filter !== "posts" ? <button className="secondary-button" disabled={Boolean(pending)} onClick={() => void moreTopics()} type="button">{pending === "more-topics" ? "Loading..." : "More topics"}</button> : null}
            {postCursor && filter !== "topics" ? <button className="secondary-button" disabled={Boolean(pending)} onClick={() => void morePosts()} type="button">{pending === "more-posts" ? "Loading..." : "More posts"}</button> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function FilterButton({ active, count, label, onClick }: { active: boolean; count: number; label: string; onClick: () => void }) {
  return <button aria-pressed={active} onClick={onClick} type="button"><span>{label}</span><small>{count}</small></button>;
}

function SavedTopic({ item, onRemove, pending }: { item: SavedTopicContract; onRemove: (item: SavedTopicContract) => Promise<void>; pending: boolean }) {
  return <article className="saved-item saved-topic-item"><span className="saved-item-type" aria-hidden="true"><MessageSquareText size={17} /></span><div className="saved-item-content"><div className="saved-item-context"><span>{item.placeName}</span><span>Topic</span></div><h3><Link href={routes.topic(item.placeSlug, item.topic.id)}>{item.topic.title}</Link></h3>{item.topic.tags.length ? <div className="saved-item-tags">{item.topic.tags.map((tag) => <span key={tag.id}><Hash size={10} />{tag.name}</span>)}</div> : null}<p className="saved-item-meta"><span>{item.topic.replyCount} {item.topic.replyCount === 1 ? "reply" : "replies"}</span><span>Active {formatRelativeDate(item.topic.latestPostAt)}</span><span>Saved {formatRelativeDate(item.savedAt)}</span></p></div><div className="saved-item-actions"><Link className="icon-button" href={routes.topic(item.placeSlug, item.topic.id)} title={`Open ${item.topic.title}`}><ArrowRight size={17} /><span className="sr-only">Open {item.topic.title}</span></Link><button className="icon-button destructive-icon-button" disabled={pending} onClick={() => void onRemove(item)} title="Remove saved topic" type="button"><BookmarkX size={17} /><span className="sr-only">Remove saved topic</span></button></div></article>;
}

function SavedPost({ item, onRemove, pending }: { item: SavedPostContract; onRemove: (item: SavedPostContract) => Promise<void>; pending: boolean }) {
  const href = `${routes.topic(item.placeSlug, item.post.topicId)}#post-${item.post.id}`;
  return <article className="saved-item saved-post-item"><span className="saved-item-type" aria-hidden="true"><FileText size={17} /></span><div className="saved-item-content"><div className="saved-item-context"><span>{item.placeName}</span><span>Post in {item.topicTitle}</span></div><h3><Link href={href}>{excerpt(item.post.plainText)}</Link></h3><p className="saved-post-author">By {item.post.author.displayName} <span>@{item.post.author.handle}</span></p><p className="saved-item-meta"><span><Clock3 size={12} />Posted {formatRelativeDate(item.post.createdAt)}</span><span>Saved {formatRelativeDate(item.savedAt)}</span></p></div><div className="saved-item-actions"><Link className="icon-button" href={href} title="Open saved post"><ArrowRight size={17} /><span className="sr-only">Open saved post</span></Link><button className="icon-button destructive-icon-button" disabled={pending} onClick={() => void onRemove(item)} title="Remove saved post" type="button"><BookmarkX size={17} /><span className="sr-only">Remove saved post</span></button></div></article>;
}

function SavedEmpty({ filtered, onReset }: { filtered: boolean; onReset: () => void }) {
  return <div className="saved-empty"><span aria-hidden="true"><Bookmark size={24} /></span><h3>{filtered ? "Nothing matches these filters" : "Your reading queue is empty"}</h3><p>{filtered ? "Try another place, item type, or search." : "Save useful topics and individual posts to find them here later."}</p>{filtered ? <button className="secondary-button" onClick={onReset} type="button">Clear filters</button> : <Link className="secondary-button" href={routes.discover}>Find discussions</Link>}</div>;
}

function savedPlaces(topics: SavedTopicContract[], posts: SavedPostContract[]) {
  const places = new Map<string, { count: number; id: string; name: string }>();
  for (const item of [...topics, ...posts]) {
    const current = places.get(item.placeId);
    places.set(item.placeId, { count: (current?.count ?? 0) + 1, id: item.placeId, name: item.placeName });
  }
  return [...places.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function searchableText(item: SavedItem) {
  const text = item.type === "topic" ? `${item.value.placeName} ${item.value.topic.title} ${item.value.topic.tags.map((tag) => tag.name).join(" ")}` : `${item.value.placeName} ${item.value.topicTitle} ${item.value.post.author.displayName} ${item.value.post.author.handle} ${item.value.post.plainText ?? ""}`;
  return text.toLocaleLowerCase();
}

function resultsTitle(filter: SavedFilter, placeId: string, places: Array<{ id: string; name: string }>) {
  const place = places.find((item) => item.id === placeId)?.name;
  const type = filter === "all" ? "Saved items" : filter === "topics" ? "Saved topics" : "Saved posts";
  return place ? `${type} in ${place}` : type;
}

function excerpt(value: string | null) {
  const text = value?.trim() || "Post content unavailable";
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}

function initials(value: string) {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatRelativeDate(value: string): string {
  const date = new Date(value);
  const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
  if (Math.abs(days) < 1) return "today";
  if (days === -1) return "yesterday";
  if (days > -7 && days < 0) return `${Math.abs(days)} days ago`;
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}
