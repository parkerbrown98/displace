"use client";

import { Edit3, Hash, MessageCircle, Mic, MicOff, Send, Trash2, Volume2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { StatusPanel } from "@/components/ui/status-panel";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/features/auth/session-provider";
import { ReportButton } from "@/features/moderation/report-button";
import { PlaceForumHeader } from "@/features/places/place-forum-header";
import { PlaceWorkspaceGate, placeErrorMessage } from "@/features/places/place-access";
import type { PlaceContract } from "@/features/places/place-contract";
import { realtimeSocket } from "@/features/realtime/realtime-client";
import { PlaceVoicePanel } from "@/features/voice/voice-experience";
import type { VoiceRoomContract } from "@/features/voice/voice-contracts";
import { routes } from "@/lib/routes";
import { deleteChatMessage, editChatMessage, listChatChannels, listChatMessages, markChatRead, sendChatMessage } from "./chat-client";
import type { ChatChannelContract, ChatMessageContract, ChatMessagePageContract } from "./chat-contracts";
import { ChatEmojiPicker } from "./chat-emoji-picker";
import { ChatMessageContent } from "./chat-message-content";

export function LiveExperience({ placeSlug }: { placeSlug: string }) {
  return <PlaceWorkspaceGate placeId={placeSlug} returnTo={routes.live(placeSlug)}>{({ context }) => <LiveWorkspace place={context.place} />}</PlaceWorkspaceGate>;
}

function LiveWorkspace({ place }: { place: PlaceContract }) {
  const [channels, setChannels] = useState<ChatChannelContract[]>();
  const [selectedChannelId, setSelectedChannelId] = useState<string>();
  const [voiceRooms, setVoiceRooms] = useState<VoiceRoomContract[]>();
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>();
  const [activeView, setActiveView] = useState<"text" | "voice">("text");
  const [channelError, setChannelError] = useState<string>();

  useEffect(() => {
    let active = true;
    void listChatChannels(place.id).then((items) => {
      if (!active) return;
      setChannels(items);
      setSelectedChannelId((current) => items.some((channel) => channel.id === current) ? current : items[0]?.id);
    }).catch((cause) => {
      if (!active) return;
      setChannels([]);
      setChannelError(placeErrorMessage(cause, "Text channels could not be loaded."));
    });
    return () => { active = false; };
  }, [place.id]);

  const selectedChannel = channels?.find((channel) => channel.id === selectedChannelId) ?? channels?.[0];
  const selectedVoice = voiceRooms?.find((room) => room.id === selectedVoiceId) ?? voiceRooms?.[0];
  const currentView = activeView === "text" && channels?.length === 0 && voiceRooms?.length ? "voice" : activeView;

  return <main className="public-main place-workspace-page live-page" id="main-content">
    <PlaceForumHeader active="live" currentSection={{ href: routes.live(place.slug), label: "Live" }} place={place} />
    <section className="live-studio" aria-label="Live workspace">
      <div className="live-studio-body">
        <aside className="live-channel-rail" aria-label="Channels">
          <section className="live-rail-section" aria-labelledby="text-channels-heading">
            <h2 className="live-rail-label" id="text-channels-heading"><MessageCircle size={14} />Text Channels</h2>
            <div className="live-channel-buttons">
              {!channels ? <span className="live-rail-loading">Loading channels...</span> : channels.map((channel) => <button aria-pressed={currentView === "text" && channel.id === selectedChannel?.id} className="live-channel-button" key={channel.id} onClick={() => { setSelectedChannelId(channel.id); setActiveView("text"); }} type="button"><Hash size={15} /><span>{channel.name}</span></button>)}
            </div>
          </section>
          <section className="live-rail-section live-voice-channels" aria-labelledby="voice-channels-heading">
            <h2 className="live-rail-label" id="voice-channels-heading"><Volume2 size={14} />Voice Channels</h2>
            <div className="live-channel-buttons">
              {!voiceRooms ? <span className="live-rail-loading">Loading voice...</span> : voiceRooms.map((room) => <div className="live-voice-channel" key={room.id}>
                <button aria-pressed={currentView === "voice" && room.id === selectedVoice?.id} className="live-channel-button" onClick={() => { setSelectedVoiceId(room.id); setActiveView("voice"); }} type="button"><Volume2 size={15} /><span>{room.name}</span><small>{room.participants.length}</small></button>
                {room.participants.length ? <div className="live-channel-presence" aria-label={`${room.name} participants`}>{room.participants.map((participant) => <div className="live-presence-member" key={participant.identity}><span className="live-presence-avatar" aria-hidden="true">{participant.displayName.slice(0, 2).toUpperCase()}</span><span>{participant.displayName}</span>{participant.microphoneMuted || !participant.canPublish ? <MicOff aria-label="Muted" size={12} /> : <Mic aria-label="Microphone on" size={12} />}</div>)}</div> : null}
              </div>)}
            </div>
          </section>
        </aside>
        <div className="live-stage-stack">
          <div className="live-stage" hidden={currentView !== "text"}>{selectedChannel ? <ChatConversation channel={selectedChannel} key={selectedChannel.id} place={place} /> : <section className="chat-conversation chat-conversation-empty" aria-label="Text chat"><StatusPanel description={channelError ?? "No text channels are available to your current roles."} title="Text chat unavailable" /></section>}</div>
          <div className="live-stage" hidden={currentView !== "voice"}><PlaceVoicePanel onRoomsChanged={setVoiceRooms} place={place} selectedRoomId={selectedVoice?.id} /></div>
        </div>
      </div>
    </section>
  </main>;
}

function ChatConversation({ channel, place }: { channel: ChatChannelContract; place: PlaceContract }) {
  const session = useSession();
  const [page, setPage] = useState<ChatMessagePageContract>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessageContract[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [sendPending, setSendPending] = useState(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  const sending = useRef(false);
  const typingStop = useRef<number | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void listChatMessages(place.id, channel.slug).then((nextPage) => {
      if (!active) return;
      setMessages(nextPage.items);
      setPage(nextPage);
    }).catch((cause) => {
      if (active) setError(placeErrorMessage(cause, "The chat history could not be loaded."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [channel.slug, place.id]);

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

  function insertEmoji(emoji: string) {
    const textarea = composer.current;
    const start = textarea?.selectionStart ?? draft.length;
    const end = textarea?.selectionEnd ?? start;
    const next = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`;
    updateDraft(next);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!page || !draft.trim() || sending.current) return;
    sending.current = true;
    setSendPending(true);
    try {
      const message = await sendChatMessage(place.id, page.channel.id, draft.trim());
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setDraft("");
    } catch (cause) { toast.error(placeErrorMessage(cause, "The message could not be sent.")); }
    finally { sending.current = false; setSendPending(false); }
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

  if (loading) return <section className="chat-conversation chat-conversation-empty" aria-label={`${channel.name} chat`}><p className="live-loading-copy">Opening #{channel.name}...</p></section>;
  if (!page) return <section className="chat-conversation chat-conversation-empty" aria-label={`${channel.name} chat`}><StatusPanel tone="error" title="Chat unavailable" description={error ?? "This channel is unavailable."} /></section>;

  return <section className="chat-conversation" aria-label={`${page.channel.name} chat`}>
        <header className="chat-heading"><div><p className="eyebrow">Text room</p><h1><Hash size={24} />{page.channel.name}</h1></div><span className="chat-live-status"><span aria-hidden="true" />{realtimeConnected ? "Live" : "Connecting"}</span></header>
        <div className="chat-message-list">{messages.length ? messages.map((message) => <ChatMessage canManage={page.permissions.canManage} currentUserId={session.user?.id} editing={editingId === message.id} key={message.id} message={message} onCancel={() => setEditingId(undefined)} onDelete={() => void remove(message.id)} onEdit={() => setEditingId(message.id)} onSave={saveEdit} placeId={place.id} />) : <p className="chat-empty">No messages yet. Start the conversation.</p>}</div>
        {typingUsers.length ? <p className="chat-typing" role="status">Someone is typing...</p> : null}
        {page.permissions.canSend ? <form className="chat-composer" onSubmit={send}><label className="sr-only" htmlFor="chat-message">Message {page.channel.name}</label><textarea id="chat-message" maxLength={4_000} onChange={(event) => updateDraft(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder={`Message #${page.channel.name}`} ref={composer} value={draft} /><ChatEmojiPicker onSelect={insertEmoji} /><button className="icon-button chat-send" disabled={!draft.trim() || sendPending} title="Send message" type="submit"><Send size={18} /><span className="sr-only">Send message</span></button></form> : <p className="chat-readonly">You can read this channel, but cannot send messages.</p>}
      </section>;
}

function ChatMessage({ canManage, currentUserId, editing, message, onCancel, onDelete, onEdit, onSave, placeId }: { canManage: boolean; currentUserId?: string; editing: boolean; message: ChatMessageContract; onCancel: () => void; onDelete: () => void; onEdit: () => void; onSave: (messageId: string, body: string) => Promise<void>; placeId: string }) {
  const [draft, setDraft] = useState(message.body ?? "");
  const canChange = !message.isDeleted && (canManage || currentUserId === message.author.id);
  return <article className={`chat-message${message.isDeleted ? " deleted" : ""}`}><header><strong>{message.isDeleted ? "Deleted member" : message.author.displayName}</strong><span>@{message.author.handle}</span><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>{!message.isDeleted ? <span className="chat-message-controls"><ReportButton label="chat message" placeId={placeId} targetId={message.id} targetType="chat_message" />{canChange ? <><button className="icon-button" onClick={onEdit} title="Edit message" type="button"><Edit3 aria-hidden="true" size={15} /></button><button className="icon-button destructive-icon-button" onClick={onDelete} title="Delete message" type="button"><Trash2 aria-hidden="true" size={15} /></button></> : null}</span> : null}</header>{message.isDeleted ? <p className="tombstone">This message was removed.</p> : editing ? <form className="chat-edit-form" onSubmit={(event) => { event.preventDefault(); void onSave(message.id, draft.trim()); }}><textarea autoFocus maxLength={4_000} onChange={(event) => setDraft(event.target.value)} value={draft} /><div><button className="primary-button" disabled={!draft.trim()} type="submit">Save</button><button className="secondary-button" onClick={onCancel} type="button">Cancel</button></div></form> : <ChatMessageContent body={message.body ?? ""} />}</article>;
}