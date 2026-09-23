"use client";

import { ArrowRight, MessageCircle, Radio, Volume2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/features/auth/session-provider";
import { listChatChannels } from "@/features/chat/chat-client";
import type { ChatChannelContract } from "@/features/chat/chat-contracts";
import { listVoiceRooms } from "@/features/voice/voice-client";
import type { VoiceRoomContract } from "@/features/voice/voice-contracts";
import { routes } from "@/lib/routes";

interface LiveSpaces {
  channels: ChatChannelContract[];
  rooms: VoiceRoomContract[];
}

export function ForumLiveSpaces({ placeId, placeSlug }: { placeId: string; placeSlug: string }) {
  const session = useSession();
  const [spaces, setSpaces] = useState<LiveSpaces>();

  useEffect(() => {
    if (session.status !== "authenticated") return;
    let active = true;
    void Promise.all([
      listChatChannels(placeId).catch(() => []),
      listVoiceRooms(placeId).catch(() => []),
    ]).then(([channels, rooms]) => {
      if (active) setSpaces({ channels: channels.filter((channel) => !channel.archived), rooms: rooms.filter((room) => !room.archived) });
    });
    return () => { active = false; };
  }, [placeId, session.status]);

  const firstChannel = spaces?.channels[0];
  const rooms = spaces?.rooms ?? [];
  if (!firstChannel && rooms.length === 0) return null;

  const participantCount = rooms.reduce((count, room) => count + room.participants.length, 0);
  return (
    <section className="portal-panel portal-live-spaces">
      <header><Radio size={17} aria-hidden="true" /><h2>Live spaces</h2></header>
      <div className="portal-space-list">
        {firstChannel ? <Link href={routes.chat(placeSlug, firstChannel.slug)}>
          <span className="portal-space-icon" aria-hidden="true"><MessageCircle size={17} /></span>
          <span><strong>Chat</strong><small>#{firstChannel.name} · {spaces!.channels.length} {spaces!.channels.length === 1 ? "channel" : "channels"}</small></span>
          <ArrowRight size={15} aria-hidden="true" />
        </Link> : null}
        {rooms.length ? <Link href={routes.voice(placeSlug)}>
          <span className="portal-space-icon voice" aria-hidden="true"><Volume2 size={17} /></span>
          <span><strong>Voice</strong><small>{participantCount ? `${participantCount} listening now` : `${rooms.length} ${rooms.length === 1 ? "room" : "rooms"} ready`}</small></span>
          <ArrowRight size={15} aria-hidden="true" />
        </Link> : null}
      </div>
    </section>
  );
}