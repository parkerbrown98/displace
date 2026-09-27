import { Bell, BellOff, Check, MessageCircle, Volume2, VolumeX, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../../components/ui/feedback-context';
import { RouteState } from '../../components/route-state/route-state';
import { useSession } from '../auth/session-provider';
import { notificationTarget, useNotifications } from './notification-context';
import type { Notification } from './notification-client';

export function NotificationRoute() {
  const session = useSession();
  const inbox = useNotifications();
  const toast = useToast();
  if (session.status !== 'authenticated') return <RouteState state="error" title="Sign in to see notifications" message="Your inbox is available after you sign in." />;

  async function run(action: () => Promise<void>, failure: string) {
    try { await action(); } catch { toast(failure); }
  }

  return <div className="community-view notification-view">
    <header className="compact-page-heading"><span className="eyebrow">Inbox</span><h2>Notifications</h2><p>Mentions, replies, and updates from your places.</p></header>
    <section className="notification-preferences" aria-label="Desktop notification preferences">
      <label><input checked={inbox.preferences.enabled} onChange={(event) => inbox.setEnabled(event.target.checked)} type="checkbox" />Desktop alerts</label>
      <label><input checked={inbox.preferences.showPreviews} disabled={!inbox.preferences.enabled} onChange={(event) => inbox.setShowPreviews(event.target.checked)} type="checkbox" />Show message previews</label>
    </section>
    {inbox.error ? <p className="inline-notice error" role="alert">{inbox.error}</p> : null}
    {inbox.loading && !inbox.notifications.length ? <RouteState state="loading" title="Loading notifications" /> : inbox.notifications.length ? <ol className="notification-list">{inbox.notifications.map((notification) => <NotificationRow key={notification.id} notification={notification} onDismiss={() => void run(() => inbox.dismiss(notification.id), 'The notification could not be dismissed.')} onRead={() => void run(() => inbox.markRead(notification.id), 'The notification could not be marked read.')} onToggleChannel={(channelId) => inbox.toggleChannel(channelId)} muted={typeof notification.payload.channelId === 'string' && inbox.preferences.mutedChannelIds.includes(notification.payload.channelId)} />)}</ol> : <div className="empty-content"><span><BellOff /></span><div><h3>Your inbox is clear</h3><p>New activity will appear here.</p></div></div>}
    {inbox.hasMore ? <button className="button secondary notification-more" disabled={inbox.loading} onClick={() => void run(inbox.loadMore, 'Older notifications could not be loaded.')} type="button">Load older</button> : null}
  </div>;
}

function NotificationRow({ muted, notification, onDismiss, onRead, onToggleChannel }: { muted: boolean; notification: Notification; onDismiss: () => void; onRead: () => void; onToggleChannel: (channelId: string) => void }) {
  const target = notificationTarget(notification);
  const channelId = typeof notification.payload.channelId === 'string' ? notification.payload.channelId : null;
  const content = <><strong>{notification.type === 'chat.mention' ? 'You were mentioned in chat' : 'New activity'}</strong><p>{channelId ? 'A conversation is waiting for you.' : 'There is an update in one of your places.'}</p></>;
  return <li className={notification.readAt ? 'read' : 'unread'}>
    <span className="notification-kind">{notification.type === 'chat.mention' ? <MessageCircle /> : <Bell />}</span>
    <div className="notification-copy">{target ? <Link onClick={onRead} to={target}>{content}</Link> : content}<time dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString()}</time></div>
    <span className="notification-actions">
      {channelId ? <button className="icon-button" onClick={() => onToggleChannel(channelId)} title={muted ? 'Unmute channel alerts' : 'Mute channel alerts'} type="button">{muted ? <VolumeX /> : <Volume2 />}</button> : null}
      {!notification.readAt ? <button className="icon-button" onClick={onRead} title="Mark as read" type="button"><Check /></button> : null}
      <button className="icon-button" onClick={onDismiss} title="Dismiss" type="button"><X /></button>
    </span>
  </li>;
}