"use client";

import { io, type Socket } from "socket.io-client";
import { currentAuthentication } from "@/features/auth/auth-client";
import { resolveApiUrl } from "@/lib/api/request";

let socket: Socket | null = null;

export function realtimeSocket(): Socket | null {
  const authentication = currentAuthentication();
  if (!authentication) return null;
  if (!socket) {
    const apiUrl = new URL(resolveApiUrl("browser", "/"), window.location.origin);
    socket = io(`${apiUrl.origin}/realtime`, {
      auth: { token: authentication.accessToken },
      path: "/socket.io",
      transports: ["websocket"],
    });
    return socket;
  }
  socket.auth = { token: authentication.accessToken };
  if (!socket.connected) socket.connect();
  return socket;
}