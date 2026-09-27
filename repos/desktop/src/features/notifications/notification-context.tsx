import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSession } from '../auth/session-provider';
import { useNativePlatform } from '../../lib/platform/platform-context';
import { useRealtime, useRealtimeState } from '../../lib/realtime/realtime-context';
import { NotificationClient, type Notification } from './notification-client';

interface NotificationPreferences {
  enabled: boolean;
  mutedChannelIds: string[];
  showPreviews: boolean;
}

interface NotificationContextValue {
  dismiss(notificationId: string): Promise<void>;
  error: string | null;
  hasMore: boolean;
  loading: boolean;
  loadMore(): Promise<void>;
  markRead(notificationId: string): Promise<void>;
  notifications: Notification[];
  preferences: NotificationPreferences;
  setEnabled(enabled: boolean): void;
  setShowPreviews(showPreviews: boolean): void;
  toggleChannel(channelId: string): void;
  unreadCount: number;
}

const STORAGE_KEY = 'displace.notification-preferences';
const defaults: NotificationPreferences = { enabled: false, mutedChannelIds: [], showPreviews: false };
const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const platform = useNativePlatform();
  const realtime = useRealtime();
  const realtimeState = useRealtimeState();
  const [client] = useState(() => new NotificationClient(session.client));
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState(readPreferences);
  const seenIds = useRef(new Set<string>());
  const unreadIds = useRef(new Set<string>());

  useEffect(() => {
    if (session.status !== 'authenticated') {
      queueMicrotask(() => {
        unreadIds.current.clear();
        seenIds.current.clear();
        setNotifications([]);
        setUnreadCount(0);
      });
      return;
    }
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setLoading(true);
      setError(null);
    });
    void client.list().then((page) => {
      if (!active) return;
      setNotifications(page.items);
      setNextCursor(page.nextCursor);
      setUnreadCount(page.unreadCount);
      seenIds.current = new Set(page.items.map((item) => item.id));
      unreadIds.current = new Set(page.items.filter((item) => !item.readAt).map((item) => item.id));
    }).catch(() => {
      if (active) setError('Notifications could not be loaded.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [client, session.status]);

  useEffect(() => {
    if (session.status !== 'authenticated' || realtimeState === 'stopped') return;
    const socket = realtime.socket;
    if (!socket) return;
    const created = (notification: Notification) => {
      if (seenIds.current.has(notification.id)) return;
      seenIds.current.add(notification.id);
      setNotifications((current) => [notification, ...current]);
      if (!notification.readAt && !unreadIds.current.has(notification.id)) {
        unreadIds.current.add(notification.id);
        setUnreadCount((count) => count + 1);
      }
      const channelId = stringPayload(notification, 'channelId');
      const shouldNotify = preferences.enabled
        && (!channelId || !preferences.mutedChannelIds.includes(channelId))
        && (document.visibilityState !== 'visible' || !document.hasFocus());
      if (shouldNotify) void platform.notify(notificationTitle(notification), notificationBody(notification, preferences.showPreviews));
    };
    const updated = (notification: Notification & { dismissed?: boolean }) => {
      setNotifications((current) => notification.dismissed
        ? current.filter((item) => item.id !== notification.id)
        : current.map((item) => item.id === notification.id ? notification : item));
      if ((notification.dismissed || notification.readAt) && unreadIds.current.delete(notification.id)) {
        setUnreadCount((count) => Math.max(0, count - 1));
      } else if (!notification.dismissed && !notification.readAt && !unreadIds.current.has(notification.id)) {
        unreadIds.current.add(notification.id);
        setUnreadCount((count) => count + 1);
      }
    };
    socket.on('notification.created', created);
    socket.on('notification.updated', updated);
    return () => {
      socket.off('notification.created', created);
      socket.off('notification.updated', updated);
    };
  }, [platform, preferences, realtime.socket, realtimeState, session.status]);

  function updatePreferences(next: NotificationPreferences) {
    setPreferences(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Preferences remain session-scoped. */ }
  }

  async function markRead(notificationId: string) {
    const current = notifications.find((notification) => notification.id === notificationId);
    if (!current || current.readAt) return;
    const notification = await client.markRead(notificationId);
    setNotifications((items) => items.map((item) => item.id === notification.id ? notification : item));
    if (unreadIds.current.delete(notificationId)) setUnreadCount((count) => Math.max(0, count - 1));
  }

  async function dismiss(notificationId: string) {
    const current = notifications.find((notification) => notification.id === notificationId);
    await client.dismiss(notificationId);
    setNotifications((items) => items.filter((item) => item.id !== notificationId));
    if (current && unreadIds.current.delete(notificationId)) setUnreadCount((count) => Math.max(0, count - 1));
  }

  async function loadMore() {
    if (!nextCursor || loading) return;
    setLoading(true);
    try {
      const page = await client.list(nextCursor);
      setNotifications((items) => [...items, ...page.items.filter((item) => !items.some((current) => current.id === item.id))]);
      setNextCursor(page.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  return <NotificationContext value={{
    dismiss,
    error,
    hasMore: Boolean(nextCursor),
    loading,
    loadMore,
    markRead,
    notifications,
    preferences,
    setEnabled: (enabled) => updatePreferences({ ...preferences, enabled }),
    setShowPreviews: (showPreviews) => updatePreferences({ ...preferences, showPreviews }),
    toggleChannel: (channelId) => updatePreferences({
      ...preferences,
      mutedChannelIds: preferences.mutedChannelIds.includes(channelId)
        ? preferences.mutedChannelIds.filter((id) => id !== channelId)
        : [...preferences.mutedChannelIds, channelId],
    }),
    unreadCount,
  }}>{children}</NotificationContext>;
}

export function useNotifications(): NotificationContextValue {
  const context = use(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider.');
  return context;
}

export function notificationTarget(notification: Notification): string | null {
  const topicId = stringPayload(notification, 'topicId');
  const channelId = stringPayload(notification, 'channelId');
  const place = stringPayload(notification, 'placeSlug') ?? notification.placeId;
  if (place && topicId) return `/places/${encodeURIComponent(place)}/topics/${encodeURIComponent(topicId)}`;
  if (place && channelId) return `/places/${encodeURIComponent(place)}/live?channel=${encodeURIComponent(channelId)}`;
  if (place) return `/places/${encodeURIComponent(place)}`;
  return null;
}

function notificationTitle(notification: Notification): string {
  if (notification.type === 'chat.mention') return 'You were mentioned';
  if (notification.type.includes('reply')) return 'New reply';
  return 'New Displace activity';
}

function notificationBody(notification: Notification, showPreview: boolean): string {
  const preview = stringPayload(notification, 'preview');
  return showPreview && preview ? preview : 'Open Displace to view this update.';
}

function stringPayload(notification: Notification, key: string): string | null {
  const value = notification.payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readPreferences(): NotificationPreferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as Partial<NotificationPreferences>;
    return {
      enabled: parsed.enabled ?? defaults.enabled,
      mutedChannelIds: Array.isArray(parsed.mutedChannelIds) ? parsed.mutedChannelIds.filter((value): value is string => typeof value === 'string') : [],
      showPreviews: parsed.showPreviews ?? defaults.showPreviews,
    };
  } catch {
    return defaults;
  }
}