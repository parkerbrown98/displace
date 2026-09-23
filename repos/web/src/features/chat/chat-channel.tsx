"use client";

import { Edit3, Hash, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { LoadingPanel, StatusPanel } from "@/components/ui/status-panel";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/features/auth/session-provider";
import { ReportButton } from "@/features/moderation/report-button";
import { PlaceForumHeader } from "@/features/places/place-forum-header";
import { PlaceWorkspaceGate, placeErrorMessage } from "@/features/places/place-access";
import type { PlaceContract } from "@/features/places/place-contract";
import { realtimeSocket } from "@/features/realtime/realtime-client";
import { PlaceVoicePanel } from "@/features/voice/voice-experience";
import { routes } from "@/lib/routes";
import { deleteChatMessage, editChatMessage, listChatChannels, listChatMessages, markChatRead, sendChatMessage } from "./chat-client";
import type { ChatChannelContract, ChatMessageContract, ChatMessagePageContract } from "./chat-contracts";

export function ChatChannel({ channelSlug, placeSlug }: { channelSlug: string; placeSlug: string }) {
  return <PlaceWorkspaceGate placeId={placeSlug} returnTo={routes.chat(placeSlug, channelSlug)}>{({ context }) => <ChatWorkspace channelSlug={channelSlug} place={context.place} />}</PlaceWorkspaceGate>;
}

export function LiveExperience({ placeSlug }: { placeSlug: string }) {
  return <PlaceWorkspaceGate placeId={placeSlug} returnTo={routes.live(placeSlug)}>{({ context }) => <LiveWorkspace place={context.place} />}</PlaceWorkspaceGate>;
}

function LiveWorkspace({ place }: { place: PlaceContract }) {
  const [channels, setChannels] = useState<ChatChannelContract[]>();

  useEffect(() => {
    let active = true;
    void listChatChannels(place.id).then((items) => { if (active) setChannels(items); }).catch(() => { if (active) setChannels([]); });
    return () => { active = false; };
  }, [place.id]);

  if (!channels) return <main className="public-main standalone-public-state" id="main-content"><LoadingPanel label="Loading live spaces" /></main>;
  if (channels[0]) return <ChatWorkspace channelSlug={channels[0].slug} place={place} />;

  return <main className="public-main place-workspace-page live-page" id="main-content">
    <PlaceForumHeader active="live" currentSection={{ href: routes.live(place.slug), label: "Live" }} place={place} />
    <section className="live-voice-only" aria-label="Live workspace"><PlaceVoicePanel place={place} /></section>
  </main>;
}

function ChatWorkspace({ channelSlug, place }: { channelSlug: string; place: PlaceContract }) {
  const session = useSession();
  const [channels, setChannels] = useState<ChatChannelContract[]>([]);
  const [page, setPage] = useState<ChatMessagePageContract>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessageContract[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const typingStop = useRef<number | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void Promise.all([listChatChannels(place.id), listChatMessages(place.id, channelSlug)]).then(([nextChannels, nextPage]) => {
      if (!active) return;
      setChannels(nextChannels);
      setMessages(nextPage.items);
      setPage(nextPage);
    }).catch((cause) => {
      if (active) setError(placeErrorMessage(cause, "The chat history could not be loaded."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [channelSlug, place.id]);

  useEffect(() => {
    if (!page || session.status !== "authenticated") return;
    const socket = realtimeSocket();
    if (!socket) return;
    const join = () => {
      setRealtimeConnected(false);
      socket.emit("place.join", { placeId: place.id });
      socket.emit("chat.join", { channelId: page.channel.id, placeId: place.id });
    };
    const connect = () => join();
    const joined = (event: { channelId: string }) => {
      if (event.channelId !== page.channel.id) return;
      setRealtimeConnected(true);
      void listChatMessages(place.id, page.channel.id).then((latest) => setMessages(latest.items)).catch(() => setRealtimeConnected(false));
    };
    const created = (message: ChatMessageContract) => {
      if (message.channelId !== page.channel.id) return;
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    };
    const updated = (message: ChatMessageContract) => {
      if (message.channelId !== page.channel.id) return;
      setMessages((current) => current.map((item) => item.id === message.id ? message : item));
    };
    const typing = (event: { active: boolean; channelId: string; userId: string }) => {
      if (event.channelId !== page.channel.id || event.userId === session.user?.id) return;
      setTypingUsers((current) => event.active ? [...new Set([...current, event.userId])] : current.filter((userId) => userId !== event.userId));
    };
    const disconnect = () => setRealtimeConnected(false);
    socket.on("connect", connect);
    socket.on("disconnect", disconnect);
    socket.on("chat.joined", joined);
    socket.on("chat.message.created", created);
    socket.on("chat.message.updated", updated);
    socket.on("chat.typing", typing);
    if (socket.connected) connect();
    return () => {
      socket.off("connect", connect);
      socket.off("disconnect", disconnect);
      socket.off("chat.joined", joined);
      socket.off("chat.message.created", created);
      socket.off("chat.message.updated", updated);
      socket.off("chat.typing", typing);
    };
  }, [page, place.id, session.status, session.user?.id]);

  useEffect(() => {
    const latest = messages.at(-1);
    if (page && latest) void markChatRead(place.id, page.channel.id, latest.id).catch(() => undefined);
  }, [messages, page, place.id]);

  function updateDraft(value: string) {
    setDraft(value);
    if (!page) return;
    const socket = realtimeSocket();
    socket?.emit("chat.typing", { active: true, channelId: page.channel.id, placeId: place.id });
    window.clearTimeout(typingStop.current);
    typingStop.current = window.setTimeout(() => socket?.emit("chat.typing", { active: false, channelId: page.channel.id, placeId: place.id }), 1_500);
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!page || !draft.trim()) return;
    try {
      const message = await sendChatMessage(place.id, page.channel.id, draft.trim());
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setDraft("");
    } catch (cause) { toast.error(placeErrorMessage(cause, "The message could not be sent.")); }
  }

  async function saveEdit(messageId: string, body: string) {
    try {
      const message = await editChatMessage(place.id, messageId, body);
      setMessages((current) => current.map((item) => item.id === message.id ? message : item));
      setEditingId(undefined);
    } catch (cause) { toast.error(placeErrorMessage(cause, "The message could not be updated.")); }
  }

  async function remove(messageId: string) {
    if (!window.confirm("Delete this message?")) return;
    try { await deleteChatMessage(place.id, messageId); }
    catch (cause) { toast.error(placeErrorMessage(cause, "The message could not be deleted.")); }
  }

  if (loading) return <main className="public-main standalone-public-state" id="main-content"><LoadingPanel label="Loading chat" /></main>;
  if (!page) return <main className="public-main standalone-public-state" id="main-content"><StatusPanel tone="error" title="Chat unavailable" description={error ?? "This channel is unavailable."} action={<Link className="secondary-button" href={routes.place(place.slug)}>Return to place</Link>} /></main>;

  return <main className="public-main place-workspace-page live-page chat-page" id="main-content">
    <PlaceForumHeader active="live" currentSection={{ href: routes.live(place.slug), label: "Live" }} place={place} />
    <section className="live-layout" aria-label="Live workspace">
      <aside className="chat-channel-list"><p className="eyebrow">Channels</p>{channels.map((channel) => <Link className={`chat-channel-link${channel.id === page.channel.id ? " active" : ""}`} href={routes.chat(place.slug, channel.slug)} key={channel.id}><Hash size={15} />{channel.name}</Link>)}</aside>
      <section className="chat-conversation" aria-label={`${page.channel.name} chat`}>
        <header className="chat-heading"><div><p className="eyebrow">Live discussion</p><h1><Hash size={24} />{page.channel.name}</h1></div><span className="chat-live-status">{realtimeConnected ? "Live" : "Connecting"}</span></header>
        <div className="chat-message-list">{messages.length ? messages.map((message) => <ChatMessage canManage={page.permissions.canManage} currentUserId={session.user?.id} editing={editingId === message.id} key={message.id} message={message} onCancel={() => setEditingId(undefined)} onDelete={() => void remove(message.id)} onEdit={() => setEditingId(message.id)} onSave={saveEdit} placeId={place.id} />) : <p className="chat-empty">No messages yet. Start the conversation.</p>}</div>
        {typingUsers.length ? <p className="chat-typing" role="status">Someone is typing...</p> : null}
        {page.permissions.canSend ? <form className="chat-composer" onSubmit={send}><label className="sr-only" htmlFor="chat-message">Message {page.channel.name}</label><textarea id="chat-message" maxLength={10_000} onChange={(event) => updateDraft(event.target.value)} placeholder={`Message #${page.channel.name}`} value={draft} /><button className="icon-button chat-send" disabled={!draft.trim()} title="Send message" type="submit"><Send size={18} /><span className="sr-only">Send message</span></button></form> : <p className="chat-readonly">You can read this channel, but cannot send messages.</p>}
      </section>
      <PlaceVoicePanel place={place} />
    </section>
  </main>;
}

function ChatMessage({ canManage, currentUserId, editing, message, onCancel, onDelete, onEdit, onSave, placeId }: { canManage: boolean; currentUserId?: string; editing: boolean; message: ChatMessageContract; onCancel: () => void; onDelete: () => void; onEdit: () => void; onSave: (messageId: string, body: string) => Promise<void>; placeId: string }) {
  const [draft, setDraft] = useState(message.body ?? "");
  const canChange = !message.isDeleted && (canManage || currentUserId === message.author.id);
  return <article className={`chat-message${message.isDeleted ? " deleted" : ""}`}><header><strong>{message.isDeleted ? "Deleted member" : message.author.displayName}</strong><span>@{message.author.handle}</span><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>{!message.isDeleted ? <span className="chat-message-controls"><ReportButton label="chat message" placeId={placeId} targetId={message.id} targetType="chat_message" />{canChange ? <><button className="icon-button" onClick={onEdit} title="Edit message" type="button"><Edit3 aria-hidden="true" size={15} /></button><button className="icon-button destructive-icon-button" onClick={onDelete} title="Delete message" type="button"><Trash2 aria-hidden="true" size={15} /></button></> : null}</span> : null}</header>{message.isDeleted ? <p className="tombstone">This message was removed.</p> : editing ? <form className="chat-edit-form" onSubmit={(event) => { event.preventDefault(); void onSave(message.id, draft.trim()); }}><textarea autoFocus maxLength={10_000} onChange={(event) => setDraft(event.target.value)} value={draft} /><div><button className="primary-button" disabled={!draft.trim()} type="submit">Save</button><button className="secondary-button" onClick={onCancel} type="button">Cancel</button></div></form> : <p>{message.body}</p>}</article>;
}