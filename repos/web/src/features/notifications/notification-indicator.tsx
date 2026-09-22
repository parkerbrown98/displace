"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/features/auth/session-provider";
import { realtimeSocket } from "@/features/realtime/realtime-client";
import { listNotifications, type NotificationContract } from "./notifications-client";

export function NotificationIndicator() {
  const session = useSession();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (session.status !== "authenticated") return;
    let active = true;
    void listNotifications().then((page) => { if (active) setUnread(page.unreadCount); }).catch(() => undefined);
    const socket = realtimeSocket();
    const created = (notification: NotificationContract) => { if (!notification.readAt) setUnread((value) => value + 1); };
    const updated = (notification: NotificationContract & { dismissed?: boolean }) => { if (notification.readAt || notification.dismissed) setUnread((value) => Math.max(0, value - 1)); };
    socket?.on("notification.created", created);
    socket?.on("notification.updated", updated);
    return () => { active = false; socket?.off("notification.created", created); socket?.off("notification.updated", updated); };
  }, [session.status]);

  return unread > 0 ? <span className="notification-dot" aria-label={`${unread} unread notifications`} /> : null;
}