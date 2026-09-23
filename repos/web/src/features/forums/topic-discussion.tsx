"use client";

import { Bookmark, Edit3, EyeOff, History, Lock, MessageSquareReply, Pin, Send, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/features/auth/session-provider";
import { ReportButton } from "@/features/moderation/report-button";
import { usePlaceWorkspace, placeErrorMessage } from "@/features/places/place-access";
import type { PlaceContract } from "@/features/places/place-contract";
import type { PostContract, PostPageContract, TopicContract } from "@/features/public-content/public-contracts";
import { RichText } from "@/features/public-content/rich-text";
import { routes } from "@/lib/routes";
import {
  createReply,
  deletePost,
  deleteTopic,
  editPost,
  listPostRevisions,
  markTopicRead,
  markTopicUnread,
  setPostSave,
  setReaction,
  setTopicFollow,
  setTopicLock,
  setTopicPin,
  setTopicSave,
  updateTopic,
} from "./forum-client";
import type { PostRevisionContract, RichTextDocumentContract } from "./forum-contract";
import { ForumEditor } from "./forum-editor";

export function TopicDiscussion({ initialPosts, initialTopic, place }: { initialPosts: PostPageContract; initialTopic: TopicContract; place: PlaceContract }) {
  const router = useRouter();
  const { context } = usePlaceWorkspace(place.id);
  const session = useSession();
  const [topic, setTopic] = useState(initialTopic);
  const [posts, setPosts] = useState(initialPosts.items);
  const [document, setDocument] = useState<RichTextDocumentContract>();
  const [editorEmpty, setEditorEmpty] = useState(true);
  const [pending, setPending] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const canModerate = context?.viewer.permissions.includes("forum.manage") ?? false;
  const canReply = context?.viewer.permissions.includes("post.create") ?? false;
  const canUpload = context?.viewer.permissions.includes("upload.create") ?? false;
  const isTopicAuthor = session.user?.id === topic.authorUserId;

  useEffect(() => {
    if (session.status !== "authenticated") return;
    const lastReadPostId = initialPosts.items.at(-1)?.id;
    void markTopicRead(place.id, initialTopic.id, lastReadPostId).catch(() => undefined);
  }, [initialPosts.items, initialTopic.id, place.id, session.status]);

  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!document || editorEmpty) return;
    setPending(true);
    try {
      const post = await createReply(place.id, topic.id, document);
      setPosts((current) => [...current, post]);
      setDocument(undefined);
      setEditorEmpty(true);
      router.refresh();
    } catch (cause) {
      toast.error(placeErrorMessage(cause, "The reply could not be published."));
    } finally {
      setPending(false);
    }
  }

  async function toggleFollow() {
    const next = !followed;
    try { await setTopicFollow(place.id, topic.id, next); setFollowed(next); }
    catch (cause) { toast.error(placeErrorMessage(cause, "Follow status could not be changed.")); }
  }

  async function toggleSave() {
    const next = !saved;
    try { await setTopicSave(place.id, topic.id, next); setSaved(next); }
    catch (cause) { toast.error(placeErrorMessage(cause, "Save status could not be changed.")); }
  }

  async function renameTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = String(new FormData(event.currentTarget).get("title"));
    try { setTopic(await updateTopic(place.id, topic.id, { title })); setEditingTitle(false); router.refresh(); }
    catch (cause) { toast.error(placeErrorMessage(cause, "The topic title could not be changed.")); }
  }

  async function removeTopic() {
    if (!window.confirm("Delete this topic and its discussion?")) return;
    try { await deleteTopic(place.id, topic.id); router.replace(routes.place(place.slug)); router.refresh(); }
    catch (cause) { toast.error(placeErrorMessage(cause, "The topic could not be deleted.")); }
  }

  return (
    <>
      <header className="topic-header">
        <div className="topic-header-top">
          <div className="topic-flags">
            {topic.isPinned ? <span><Pin size={14} aria-hidden="true" /> Pinned</span> : null}
            {topic.status === "locked" ? <span><Lock size={14} aria-hidden="true" /> Locked</span> : null}
          </div>
          {session.status === "authenticated" ? (
            <section className="topic-member-toolbar" aria-label="Topic actions">
              <button aria-pressed={followed} className="secondary-button" onClick={() => void toggleFollow()} type="button"><Star size={16} />{followed ? "Following" : "Follow"}</button>
              <button aria-pressed={saved} className="secondary-button" onClick={() => void toggleSave()} type="button"><Bookmark size={16} />{saved ? "Saved" : "Save"}</button>
              <button className="secondary-button" onClick={() => void markTopicUnread(place.id, topic.id)} type="button"><EyeOff size={16} />Mark unread</button>
              <ReportButton label="topic" placeId={place.id} targetId={topic.id} targetType="topic" />
              {isTopicAuthor || canModerate ? <button className="icon-button" onClick={() => setEditingTitle((value) => !value)} title="Edit topic title" type="button"><Edit3 size={16} /></button> : null}
              {canModerate ? <>
                <button aria-pressed={topic.status === "locked"} className="icon-button" onClick={() => void setTopicLock(place.id, topic.id, topic.status !== "locked").then(setTopic).catch((cause) => toast.error(placeErrorMessage(cause, "Lock status could not be changed.")))} title={topic.status === "locked" ? "Unlock topic" : "Lock topic"} type="button"><Lock size={16} /></button>
                <button aria-pressed={topic.isPinned} className="icon-button" onClick={() => void setTopicPin(place.id, topic.id, !topic.isPinned).then(setTopic).catch((cause) => toast.error(placeErrorMessage(cause, "Pin status could not be changed.")))} title={topic.isPinned ? "Unpin topic" : "Pin topic"} type="button"><Pin size={16} /></button>
              </> : null}
              {isTopicAuthor || canModerate ? <button className="icon-button destructive-icon-button" onClick={() => void removeTopic()} title="Delete topic" type="button"><Trash2 aria-hidden="true" size={16} /></button> : null}
            </section>
          ) : null}
        </div>
        <h1>{topic.title}</h1>
        <div className="topic-summary">
          <span>{topic.replyCount} replies</span><span>{formatCount(topic.viewCount)} views</span>
          <time dateTime={topic.createdAt}>{formatPublicDate(topic.createdAt)}</time>
        </div>
        {editingTitle ? <form className="topic-title-form" onSubmit={renameTopic}><label className="form-field">Topic title<input defaultValue={topic.title} maxLength={300} name="title" required /></label><button className="primary-button" type="submit">Save title</button></form> : null}
      </header>
      <section className="post-list" aria-label="Posts">
        {posts.map((post, index) => <DiscussionPost canModerate={canModerate} canUpload={canUpload} key={post.id} number={index + 1} onChange={(next) => setPosts((current) => current.map((item) => item.id === next.id ? next : item))} placeId={place.id} post={post} />)}
      </section>
      {session.status === "anonymous" ? <p className="topic-reply-prompt"><Link className="primary-button" href={`${routes.signIn}?returnTo=${encodeURIComponent(routes.topic(place.slug, topic.id))}`}>Sign in to reply</Link></p> : null}
      {canReply && (topic.status === "open" || canModerate) ? (
        <form className="topic-reply-form" onSubmit={reply}>
          <h2><MessageSquareReply size={20} />Join the discussion</h2>
          <ForumEditor canUpload={canUpload} key={posts.length} label="Reply" onChange={(nextDocument, isEmpty) => { setDocument(nextDocument); setEditorEmpty(isEmpty); }} placeId={place.id} />
          <button className="primary-button" disabled={pending || editorEmpty} type="submit"><Send size={16} />{pending ? "Publishing..." : "Publish reply"}</button>
        </form>
      ) : null}
    </>
  );
}

function DiscussionPost({ canModerate, canUpload, number, onChange, placeId, post }: { canModerate: boolean; canUpload: boolean; number: number; onChange: (post: PostContract) => void; placeId: string; post: PostContract }) {
  const session = useSession();
  const author = post.author;
  const [editing, setEditing] = useState(false);
  const [document, setDocument] = useState<RichTextDocumentContract>();
  const [editorEmpty, setEditorEmpty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [revisions, setRevisions] = useState<PostRevisionContract[]>();
  const canEdit = !post.isDeleted && (canModerate || session.user?.id === post.authorUserId);

  async function saveEdit() {
    if (!document || editorEmpty) return;
    try { onChange(await editPost(placeId, post.id, document, post.version)); setEditing(false); }
    catch (cause) { toast.error(placeErrorMessage(cause, "The post could not be updated. Reload if another edit was made.")); }
  }

  async function remove() {
    if (!window.confirm("Delete this post?")) return;
    try { await deletePost(placeId, post.id); onChange({ ...post, document: null, isDeleted: true, sanitizedHtml: null, plainText: null }); }
    catch (cause) { toast.error(placeErrorMessage(cause, "The post could not be deleted.")); }
  }

  async function react(reaction: string, enabled: boolean) {
    try {
      await setReaction(placeId, post.id, reaction, enabled);
      const existing = post.reactions.find((item) => item.reaction === reaction);
      const reactions = existing
        ? post.reactions.map((item) => item.reaction === reaction ? { ...item, count: Math.max(0, item.count + (enabled ? 1 : -1)), reacted: enabled } : item)
        : [...post.reactions, { count: 1, reacted: true, reaction }];
      onChange({ ...post, reactions });
    } catch (cause) { toast.error(placeErrorMessage(cause, "The reaction could not be changed.")); }
  }

  return (
    <article className={`post${post.isDeleted ? " post-deleted" : ""}`}>
      <aside className="post-profile">
        <Avatar initials={post.isDeleted ? "-" : author ? initials(author.displayName) : "CM"} size="small" />
        <div className="post-profile-details">
          {post.isDeleted ? <strong>Deleted member</strong> : <>
            {author ? <>
              <Link className="post-profile-name" href={routes.member(author.handle)}><strong>{author.displayName}</strong></Link>
              <span className="post-profile-handle">@{author.handle}</span>
              <time dateTime={author.joinedAt}>Joined {new Date(author.joinedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</time>
            </> : <strong>Community member</strong>}
          </>}
        </div>
      </aside>
      <div className="post-content">
        <header className="post-content-header"><time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString()}</time><a href={`#post-${post.id}`} id={`post-${post.id}`} aria-label={`Post ${number}`}>#{number}</a></header>
        <div className="post-body">{post.isDeleted || !post.document ? <p className="tombstone">This post was removed.</p> : editing ? <div className="post-editor"><ForumEditor canUpload={canUpload} initialDocument={post.document as RichTextDocumentContract} label="Edit post" onChange={(next, isEmpty) => { setDocument(next); setEditorEmpty(isEmpty); }} placeId={placeId} /><div><button className="primary-button" disabled={editorEmpty} onClick={() => void saveEdit()} type="button">Save edit</button><button className="secondary-button" onClick={() => setEditing(false)} type="button">Cancel</button></div></div> : <RichText document={post.document} placeId={placeId} />}</div>
        {!post.isDeleted && session.status === "authenticated" ? <footer className="post-actions">
          {["like", "helpful", "insightful"].map((reaction) => { const summary = post.reactions.find((item) => item.reaction === reaction); return <button aria-pressed={summary?.reacted ?? false} key={reaction} onClick={() => void react(reaction, !(summary?.reacted ?? false))} type="button">{reaction}{summary?.count ? ` ${summary.count}` : ""}</button>; })}
          <button aria-pressed={saved} onClick={() => void setPostSave(placeId, post.id, !saved).then(() => setSaved(!saved)).catch((cause) => toast.error(placeErrorMessage(cause, "Save status could not be changed.")))} type="button"><Bookmark size={14} />{saved ? "Saved" : "Save"}</button>
          <ReportButton label={`post ${number}`} placeId={placeId} targetId={post.id} targetType="post" />
          {canEdit ? <button onClick={() => setEditing(true)} type="button"><Edit3 size={14} />Edit</button> : null}
          {canEdit ? <button onClick={() => void remove()} type="button"><Trash2 size={14} />Delete</button> : null}
          {canModerate ? <button onClick={() => void listPostRevisions(placeId, post.id).then(setRevisions).catch((cause) => toast.error(placeErrorMessage(cause, "Revisions could not be loaded.")))} type="button"><History size={14} />History</button> : null}
        </footer> : null}
        {revisions ? <div className="post-revisions"><strong>Revision history</strong>{revisions.length ? <ol>{revisions.map((revision) => <li key={revision.id}>Version {revision.version} · {new Date(revision.createdAt).toLocaleString()}</li>)}</ol> : <p>No earlier revisions.</p>}</div> : null}
      </div>
    </article>
  );
}

function initials(value: string): string {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en", { notation: value >= 1_000 ? "compact" : "standard" }).format(value);
}

function formatPublicDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}
