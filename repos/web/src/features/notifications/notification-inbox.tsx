"use client";

import { BellOff, Check, MessageCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell, ShellTopbar } from "@/components/app-shell/app-shell";
import { LoadingPanel, StatusPanel } from "@/components/ui/status-panel";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/features/auth/session-provider";
import { placeErrorMessage } from "@/features/places/place-access";
import { realtimeSocket } from "@/features/realtime/realtime-client";
import { dismissNotification, listNotifications, markNotificationRead, type NotificationContract } from "./notifications-client";

export function NotificationInbox() {
  const session = useSession();
  const [notifications, setNotifications] = useState<NotificationContract[]>([]);
  const [loadError, setLoadError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session.status !== "authenticated") return;
    let active = true;
    void listNotifications().then((page) => { if (active) setNotifications(page.items); }).catch((cause) => { if (active) setLoadError(placeErrorMessage(cause, "Notifications could not be loaded.")); }).finally(() => { if (active) setLoading(false); });
    const socket = realtimeSocket();
    const created = (notification: NotificationContract) => setNotifications((current) => current.some((item) => item.id === notification.id) ? current : [notification, ...current]);
    const updated = (notification: NotificationContract & { dismissed?: boolean }) => setNotifications((current) => notification.dismissed ? current.filter((item) => item.id !== notification.id) : current.map((item) => item.id === notification.id ? notification : item));
    socket?.on("notification.created", created);
    socket?.on("notification.updated", updated);
    return () => { active = false; socket?.off("notification.created", created); socket?.off("notification.updated", updated); };
  }, [session.status]);

  async function read(notification: NotificationContract) {
    if (notification.readAt) return;
    try { const next = await markNotificationRead(notification.id); setNotifications((current) => current.map((item) => item.id === next.id ? next : item)); }
    catch (cause) { toast.error(placeErrorMessage(cause, "Notification could not be marked read.")); }
  }

  async function dismiss(notificationId: string) {
    try { await dismissNotification(notificationId); setNotifications((current) => current.filter((item) => item.id !== notificationId)); }
    catch (cause) { toast.error(placeErrorMessage(cause, "Notification could not be dismissed.")); }
  }

  return <AppShell><main className="main-content notification-page" id="main-content"><ShellTopbar /><section className="notification-heading"><p className="eyebrow">Inbox</p><h1>Notifications</h1></section>{loadError ? <p className="form-message form-message-error" role="alert">{loadError}</p> : null}{loading ? <LoadingPanel label="Loading notifications" /> : notifications.length ? <ol className="notification-list">{notifications.map((notification) => <li className={notification.readAt ? "read" : "unread"} key={notification.id}><MessageCircle size={19} /><div><strong>{notification.type === "chat.mention" ? "You were mentioned in chat" : "New notification"}</strong><p>{notification.payload.channelId ? "A conversation is waiting for you." : "There is an update in one of your places."}</p><time dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString()}</time></div><span className="notification-actions">{!notification.readAt ? <button className="icon-button" onClick={() => void read(notification)} title="Mark as read" type="button"><Check size={16} /></button> : null}<button className="icon-button" onClick={() => void dismiss(notification.id)} title="Dismiss notification" type="button"><X size={16} /></button></span></li>)}</ol> : <StatusPanel title="Your inbox is clear" description="Updates from places and chat mentions will appear here." action={<BellOff size={22} />} />}</main></AppShell>;
}