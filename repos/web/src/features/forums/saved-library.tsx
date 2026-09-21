"use client";

import { BookmarkX, FileText, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { LoadingPanel, StatusPanel } from "@/components/ui/status-panel";
import { useSession } from "@/features/auth/session-provider";
import { routes } from "@/lib/routes";
import { listSavedPosts, listSavedTopics, setPostSave, setTopicSave } from "./forum-client";
import type { SavedPostContract, SavedTopicContract } from "./forum-contract";

export function SavedLibrary() {
  const session = useSession();
  const [topics, setTopics] = useState<SavedTopicContract[]>([]);
  const [posts, setPosts] = useState<SavedPostContract[]>([]);
  const [topicCursor, setTopicCursor] = useState<string>();
  const [postCursor, setPostCursor] = useState<string>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

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
    const page = await listSavedTopics(topicCursor);
    setTopics((items) => [...items, ...page.items]);
    setTopicCursor(page.nextCursor);
  }

  async function morePosts() {
    const page = await listSavedPosts(postCursor);
    setPosts((items) => [...items, ...page.items]);
    setPostCursor(page.nextCursor);
  }

  return (
    <div className="saved-library">
      <section aria-labelledby="saved-topics-heading">
        <header><MessageSquareText size={20} /><div><p className="eyebrow">Discussions</p><h2 id="saved-topics-heading">Saved topics</h2></div></header>
        {topics.length ? <div className="saved-list">{topics.map((item) => <article key={`${item.placeId}-${item.topic.id}`}><div><small>{item.placeName}</small><h3><Link href={routes.topic(item.placeSlug, item.topic.id)}>{item.topic.title}</Link></h3><p>{item.topic.replyCount} replies · saved {formatDate(item.savedAt)}</p></div><button className="icon-button" onClick={() => void setTopicSave(item.placeId, item.topic.id, false).then(() => setTopics((items) => items.filter((current) => current !== item)))} title="Remove saved topic" type="button"><BookmarkX size={17} /></button></article>)}</div> : <p className="saved-empty">Topics you save will appear here.</p>}
        {topicCursor ? <button className="secondary-button" onClick={() => void moreTopics()} type="button">Load more topics</button> : null}
      </section>
      <section aria-labelledby="saved-posts-heading">
        <header><FileText size={20} /><div><p className="eyebrow">Posts</p><h2 id="saved-posts-heading">Saved posts</h2></div></header>
        {posts.length ? <div className="saved-list">{posts.map((item) => <article key={`${item.placeId}-${item.post.id}`}><div><small>{item.placeName} / {item.topicTitle}</small><h3><Link href={`${routes.topic(item.placeSlug, item.post.topicId)}#post-${item.post.id}`}>{item.post.plainText}</Link></h3><p>Saved {formatDate(item.savedAt)}</p></div><button className="icon-button" onClick={() => void setPostSave(item.placeId, item.post.id, false).then(() => setPosts((items) => items.filter((current) => current !== item)))} title="Remove saved post" type="button"><BookmarkX size={17} /></button></article>)}</div> : <p className="saved-empty">Posts you save will appear here.</p>}
        {postCursor ? <button className="secondary-button" onClick={() => void morePosts()} type="button">Load more posts</button> : null}
      </section>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}
