import { Edit3, Hash, MessageCircle, Send, Trash2, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { RouteState } from '../../components/route-state/route-state';
import { useConfirmation, useToast } from '../../components/ui/feedback-context';
import { DesktopApiError } from '../../lib/api/desktop-api';
import { useRealtime, useRealtimeState } from '../../lib/realtime/realtime-context';
import { useRemoteResource } from '../../lib/remote-resource';
import { useSession } from '../auth/session-provider';
import { PlaceToolbar } from '../places/place-toolbar';
import { usePlaceClient } from '../places/use-place-client';
import { ChatClient, type ChatChannel, type ChatMessage, type ChatMessagePage } from './chat-client';

export function ChatRoute() {
  const session = useSession();
  const placeClient = usePlaceClient();
  const { placeSlug = '' } = useParams();
  const resource = useRemoteResource(`chat-place:${placeSlug}:${session.status}`, async () => {
    const place = await placeClient.get(placeSlug);
    const context = await placeClient.context(place.id);
    return { context, place };
  });
  if (session.status !== 'authenticated') return <RouteState state="error" title="Sign in to open live chat" message="Live conversations are available to place members." />;
  if (resource.state.status === 'loading') return <RouteState state="loading" title="Opening live chat" />;
  if (resource.state.status === 'error') return <RouteState state="error" title="Live chat unavailable" message={chatError(resource.state.error)} onRetry={resource.reload} />;
  return <ChatWorkspace placeId={resource.state.data.place.id} placeSlug={resource.state.data.place.slug} place={resource.state.data.place} context={resource.state.data.context} />;
}

function ChatWorkspace({ context, place, placeId, placeSlug }: { context: Parameters<typeof PlaceToolbar>[0]['context']; place: Parameters<typeof PlaceToolbar>[0]['place']; placeId: string; placeSlug: string }) {
  const session = useSession();
  const realtime = useRealtime();
  const realtimeState = useRealtimeState();
  const [client] = useState(() => new ChatClient(session.client));
  const [parameters, setParameters] = useSearchParams();
  const resource = useRemoteResource(`chat-channels:${placeId}`, () => client.listChannels(placeId));
  const requestedChannel = parameters.get('channel');
  useEffect(() => {
    const socket = realtime.socket;
    if (!socket || realtimeState === 'stopped') return;
    const changed = () => resource.reload();
    socket.on('chat.channel.updated', changed);
    return () => { socket.off('chat.channel.updated', changed); };
  }, [realtime.socket, realtimeState, resource]);
  if (resource.state.status === 'loading') return <RouteState state="loading" title="Loading channels" />;
  if (resource.state.status === 'error') return <RouteState state="error" title="Chat unavailable" message={chatError(resource.state.error)} onRetry={resource.reload} />;
  const channels = resource.state.data.filter((channel) => !channel.archived);
  const selected = channels.find((channel) => channel.id === requestedChannel || channel.slug === requestedChannel) ?? channels[0];
  return <div className="community-view place-workspace-page chat-view">
    <PlaceToolbar active="live" context={context} place={place} />
    <div className="chat-workbench">
      <aside className="chat-channel-rail" aria-label="Text channels">
        <header><MessageCircle aria-hidden="true" size={16} /><span>Text channels</span></header>
        {channels.map((channel) => <button aria-pressed={channel.id === selected?.id} key={channel.id} onClick={() => setParameters({ channel: channel.id })} type="button"><Hash aria-hidden="true" size={15} /><span>{channel.name}</span></button>)}
        {!channels.length ? <p>No channels are available.</p> : null}
      </aside>
      {selected ? <Conversation channel={selected} client={client} key={selected.id} placeId={placeId} placeSlug={placeSlug} /> : <div className="empty-content"><span><MessageCircle /></span><div><h3>Chat unavailable</h3><p>No text channels are available to your roles.</p></div></div>}
    </div>
  </div>;
}

function Conversation({ channel, client, placeId, placeSlug }: { channel: ChatChannel; client: ChatClient; placeId: string; placeSlug: string }) {
  const session = useSession();
  const realtime = useRealtime();
  const realtimeState = useRealtimeState();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirmation();
  const [page, setPage] = useState<ChatMessagePage>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const typingTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void client.listMessages(placeId, channel.id).then((next) => {
      if (!active) return;
      setPage(next);
      setMessages(next.items);
    }).catch((cause) => {
      if (!active) return;
      if (cause instanceof DesktopApiError && cause.kind === 'forbidden') navigate(`/places/${placeSlug}`, { replace: true });
      else setError(chatError(cause));
    });
    return () => { active = false; };
  }, [channel.id, client, navigate, placeId, placeSlug]);

  useEffect(() => {
    const socket = realtime.socket;
    if (!socket || !page) return;
    const leavePlace = realtime.joinPlace(placeId);
    const leaveChat = realtime.joinChat(placeId, channel.id);
    if (realtimeState === 'connected') {
      void client.listMessages(placeId, channel.id).then((latest) => setMessages((items) => reconcileMessages(items, latest.items))).catch((cause) => {
        if (cause instanceof DesktopApiError && cause.kind === 'forbidden') navigate(`/places/${placeSlug}`, { replace: true });
      });
    }
    const created = (message: ChatMessage) => {
      if (message.channelId === channel.id) setMessages((items) => mergeMessage(items, message));
    };
    const updated = (message: ChatMessage) => {
      if (message.channelId === channel.id) setMessages((items) => mergeMessage(items, message));
    };
    const typing = (event: { active: boolean; channelId: string; userId: string }) => {
      if (event.channelId !== channel.id || event.userId === session.user?.id) return;
      setTypingUsers((items) => event.active ? [...new Set([...items, event.userId])] : items.filter((id) => id !== event.userId));
    };
    const joined = (event: { channelId: string }) => {
      if (event.channelId !== channel.id) return;
      void client.listMessages(placeId, channel.id).then((latest) => setMessages((items) => reconcileMessages(items, latest.items))).catch(() => undefined);
    };
    socket.on('chat.message.created', created);
    socket.on('chat.message.updated', updated);
    socket.on('chat.typing', typing);
    socket.on('chat.joined', joined);
    return () => {
      window.clearTimeout(typingTimer.current);
      socket.emit('chat.typing', { active: false, channelId: channel.id, placeId });
      socket.off('chat.message.created', created);
      socket.off('chat.message.updated', updated);
      socket.off('chat.typing', typing);
      socket.off('chat.joined', joined);
      leaveChat();
      leavePlace();
    };
  }, [channel.id, client, navigate, page, placeId, placeSlug, realtime, realtimeState, session.user?.id]);

  useEffect(() => {
    const latest = messages.at(-1);
    if (latest) void client.markRead(placeId, channel.id, latest.id).catch(() => undefined);
  }, [channel.id, client, messages, placeId]);

  function updateDraft(value: string) {
    setDraft(value);
    const socket = realtime.socket;
    if (!socket?.connected) return;
    socket.emit('chat.typing', { active: true, channelId: channel.id, placeId });
    window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => socket.emit('chat.typing', { active: false, channelId: channel.id, placeId }), 1_500);
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || pending) return;
    const commandId = crypto.randomUUID();
    setPending(true);
    try {
      const message = await client.send(placeId, channel.id, body, commandId);
      setMessages((items) => mergeMessage(items, message));
      setDraft('');
      realtime.socket?.emit('chat.typing', { active: false, channelId: channel.id, placeId });
    } catch (cause) { handleFailure(cause); }
    finally { setPending(false); }
  }

  async function remove(message: ChatMessage) {
    if (!await confirm({ title: 'Delete message?', message: 'The message will remain as a tombstone in the conversation.', confirmLabel: 'Delete' })) return;
    try {
      await client.delete(placeId, message.id);
      setMessages((items) => items.map((item) => item.id === message.id ? { ...item, body: null, isDeleted: true } : item));
    } catch (cause) { handleFailure(cause); }
  }

  async function save(message: ChatMessage, body: string) {
    try {
      const updated = await client.edit(placeId, message.id, body);
      setMessages((items) => mergeMessage(items, updated));
      setEditingId(undefined);
    } catch (cause) { handleFailure(cause); }
  }

  async function loadOlder() {
    if (!page?.nextCursor || pending) return;
    setPending(true);
    try {
      const older = await client.listMessages(placeId, channel.id, page.nextCursor);
      setMessages((items) => reconcileMessages(older.items, items));
      setPage((current) => current ? { ...current, nextCursor: older.nextCursor } : older);
    } catch (cause) { handleFailure(cause); }
    finally { setPending(false); }
  }

  function handleFailure(cause: unknown) {
    if (cause instanceof DesktopApiError && cause.kind === 'forbidden') {
      navigate(`/places/${placeSlug}`, { replace: true });
      return;
    }
    toast(chatError(cause));
  }

  if (error) return <section className="chat-conversation"><RouteState state="error" title="Conversation unavailable" message={error} /></section>;
  if (!page) return <section className="chat-conversation"><RouteState state="loading" title={`Opening #${channel.name}`} /></section>;
  return <section className="chat-conversation" aria-label={`${channel.name} chat`}>
    <header className="chat-heading"><h2><Hash aria-hidden="true" />{channel.name}</h2><span className={`realtime-state ${realtimeState}`}>{realtimeState === 'connected' ? 'Live' : <><WifiOff size={13} />{realtimeState === 'offline' ? 'Offline' : 'Reconnecting'}</>}</span></header>
    {page.nextCursor ? <button className="chat-history-button" disabled={pending} onClick={() => void loadOlder()} type="button">Load older messages</button> : null}
    <div className="chat-message-list" aria-live="polite">{messages.length ? messages.map((message) => <ChatMessageRow canManage={page.permissions.canManage} currentUserId={session.user?.id} editing={editingId === message.id} key={message.id} message={message} onCancel={() => setEditingId(undefined)} onDelete={() => void remove(message)} onEdit={() => setEditingId(message.id)} onSave={(body) => void save(message, body)} />) : <p className="chat-empty">No messages yet. Start the conversation.</p>}</div>
    <p className="chat-typing" role="status">{typingUsers.length ? `${typingUsers.length === 1 ? 'Someone is' : 'Several people are'} typing...` : '\u00a0'}</p>
    {page.permissions.canSend ? <form className="chat-composer" onSubmit={send}><label className="sr-only" htmlFor={`chat-message-${channel.id}`}>Message {channel.name}</label><textarea id={`chat-message-${channel.id}`} maxLength={4_000} onChange={(event) => updateDraft(event.target.value)} onKeyDown={submitOnEnter} placeholder={`Message #${channel.name}`} value={draft} /><button className="icon-button" disabled={pending || !draft.trim()} title="Send message" type="submit"><Send aria-hidden="true" /><span className="sr-only">Send message</span></button></form> : <p className="chat-readonly">You can read this channel, but cannot send messages.</p>}
  </section>;
}

function ChatMessageRow({ canManage, currentUserId, editing, message, onCancel, onDelete, onEdit, onSave }: { canManage: boolean; currentUserId?: string; editing: boolean; message: ChatMessage; onCancel: () => void; onDelete: () => void; onEdit: () => void; onSave: (body: string) => void }) {
  const [draft, setDraft] = useState(message.body ?? '');
  const canChange = !message.isDeleted && (canManage || currentUserId === message.author.id);
  return <article className={`chat-message${message.isDeleted ? ' deleted' : ''}`}>
    <span className="avatar small" aria-hidden="true">{initials(message.author.displayName)}</span>
    <div><header><strong>{message.author.displayName}</strong><span>@{message.author.handle}</span><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>{canChange ? <span className="chat-message-actions"><button className="icon-button" onClick={onEdit} title="Edit message" type="button"><Edit3 /></button><button className="icon-button danger-icon" onClick={onDelete} title="Delete message" type="button"><Trash2 /></button></span> : null}</header>{message.isDeleted ? <p className="deleted-copy">This message was removed.</p> : editing ? <form className="chat-edit-form" onSubmit={(event) => { event.preventDefault(); if (draft.trim()) onSave(draft.trim()); }}><textarea autoFocus maxLength={4_000} onChange={(event) => setDraft(event.target.value)} value={draft} /><span><button className="button primary compact" disabled={!draft.trim()} type="submit">Save</button><button className="button quiet compact" onClick={onCancel} type="button">Cancel</button></span></form> : <p>{message.body}</p>}</div>
  </article>;
}

function mergeMessage(messages: ChatMessage[], message: ChatMessage): ChatMessage[] {
  return messages.some((item) => item.id === message.id)
    ? messages.map((item) => item.id === message.id ? message : item)
    : [...messages, message];
}

function reconcileMessages(first: ChatMessage[], second: ChatMessage[]): ChatMessage[] {
  const messages = new Map(first.map((message) => [message.id, message]));
  second.forEach((message) => messages.set(message.id, message));
  return [...messages.values()].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
}

function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}

function chatError(error: unknown): string {
  if (error instanceof DesktopApiError) {
    if (error.kind === 'offline') return 'You are offline. Messages will be available after reconnecting.';
    if (error.kind === 'forbidden') return 'Your access to this conversation has changed.';
    if (error.kind === 'rate-limited') return 'Messages are moving quickly. Wait a moment and try again.';
    return error.message;
  }
  return 'The conversation could not be loaded.';
}

function initials(value: string): string {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}