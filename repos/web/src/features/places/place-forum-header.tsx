"use client";

import { Bell, Search, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { listChatChannels } from "@/features/chat/chat-client";
import type { ChatChannelContract } from "@/features/chat/chat-contracts";
import { listVoiceRooms } from "@/features/voice/voice-client";
import { useSession } from "@/features/auth/session-provider";
import { NotificationIndicator } from "@/features/notifications/notification-indicator";
import { ReportButton } from "@/features/moderation/report-button";
import { routes } from "@/lib/routes";
import { PlaceMembershipActions } from "./place-access";
import { getPlaceContext } from "./place-client";
import type { PlaceContract } from "./place-contract";
import { PlaceIcon } from "./place-icon";

type PlaceSection = "chat" | "forums" | "members" | "moderation" | "settings" | "voice";

interface PlaceForumHeaderProps {
  active?: PlaceSection;
  currentSection?: { href: string; label: string };
  place: PlaceContract;
  showMembershipActions?: boolean;
  showSettings?: boolean;
}

export function PlaceForumHeader({
  active = "forums",
  currentSection,
  place,
  showMembershipActions = true,
  showSettings = false,
}: PlaceForumHeaderProps) {
	const session = useSession();
  const settingsVisible = useSettingsVisibility(place.id, showSettings);
  const moderationVisible = useModerationVisibility(place.id);

  return (
    <header className="place-toolbar">
      <div className="place-toolbar-identity">
        <PlaceIcon className="place-toolbar-mark" place={place} />
        <div className="place-toolbar-title"><p className="eyebrow">{place.visibility} community</p><h1>{place.name}</h1></div>
      </div>
      <nav className="place-toolbar-nav" aria-label={`${place.name} navigation`}>
        <PlaceNavLink active={active === "forums"} href={routes.place(place.slug)}>Forums</PlaceNavLink>
        <PlaceNavLink active={active === "members"} href={routes.placeMembers(place.slug)}>Members</PlaceNavLink>
        <VoiceNavLink active={active === "voice"} place={place} />
        {moderationVisible ? <PlaceNavLink active={active === "moderation"} href={routes.placeModeration(place.slug)}>Moderation</PlaceNavLink> : null}
        {settingsVisible ? <PlaceNavLink active={active === "settings"} href={routes.placeSettings(place.slug)}>Settings</PlaceNavLink> : null}
        <ChatNavLink active={active === "chat"} currentSection={currentSection} place={place} />
      </nav>
      <div className="place-toolbar-actions">
        <span className="place-membership"><Users size={16} aria-hidden="true" /> {place.joinPolicy === "open" ? "Open membership" : "Membership by request"}</span>
        <PlaceSearch place={place} />
        <ReportButton label={place.name} placeId={place.id} targetId={place.id} targetType="place" />
        {session.status === "authenticated" ? <Link className="icon-button notification-button" href={routes.notifications} title="Notifications">
          <Bell size={19} />
          <NotificationIndicator />
          <span className="sr-only">Notifications</span>
        </Link> : null}
        {showMembershipActions ? <PlaceMembershipActions place={place} /> : null}
      </div>
    </header>
  );
}

function VoiceNavLink({ active, place }: { active: boolean; place: PlaceContract }) {
  const session = useSession();
  const [visible, setVisible] = useState(active);
  useEffect(() => {
    if (active || session.status !== "authenticated") return;
    let activeRequest = true;
    void listVoiceRooms(place.id).then((rooms) => { if (activeRequest) setVisible(rooms.length > 0); }).catch(() => undefined);
    return () => { activeRequest = false; };
  }, [active, place.id, session.status]);
  return visible ? <PlaceNavLink active={active} href={routes.voice(place.slug)}>Voice</PlaceNavLink> : null;
}

function useSettingsVisibility(placeId: string, showSettings: boolean) {
  const session = useSession();
  const [authorizedSettingsVisible, setAuthorizedSettingsVisible] = useState(false);

  useEffect(() => {
    if (showSettings || session.status !== "authenticated") return;
    let active = true;
    void getPlaceContext(placeId)
      .then((context) => {
        if (active) setAuthorizedSettingsVisible(context.viewer.permissions.some((permission) => ["place.manage", "role.manage", "member.manage", "forum.manage", "chat.manage", "voice.manage"].includes(permission)));
      })
      .catch(() => {
        if (active) setAuthorizedSettingsVisible(false);
      });
    return () => { active = false; };
  }, [placeId, session.status, showSettings]);

  return showSettings || authorizedSettingsVisible;
}

function useModerationVisibility(placeId: string) {
  const session = useSession();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (session.status !== "authenticated") return;
    let active = true;
    void getPlaceContext(placeId)
      .then((context) => { if (active) setVisible(context.viewer.permissions.includes("moderation.manage")); })
      .catch(() => { if (active) setVisible(false); });
    return () => { active = false; };
  }, [placeId, session.status]);
  return visible;
}

function PlaceSearch({ place }: { place: PlaceContract }) {
  return <Link className="icon-button place-search-toggle" href={routes.discoverInPlace(place.id)} title={`Search in ${place.name}`}><Search size={18} /><span className="sr-only">Search in {place.name}</span></Link>;
}

function ChatNavLink({
  active,
  currentSection,
  place,
}: {
  active: boolean;
  currentSection?: { href: string; label: string };
  place: PlaceContract;
}) {
  const session = useSession();
  const [channel, setChannel] = useState<ChatChannelContract>();

  useEffect(() => {
    if (currentSection || session.status !== "authenticated") return;
    let activeRequest = true;
    void listChatChannels(place.id)
      .then((channels) => {
        if (activeRequest) setChannel(channels.at(0));
      })
      .catch(() => {
        if (activeRequest) setChannel(undefined);
      });
    return () => { activeRequest = false; };
  }, [currentSection, place.id, session.status]);

  if (currentSection) return <PlaceNavLink active={active} href={currentSection.href}>{currentSection.label}</PlaceNavLink>;
  if (!channel) return null;
  return <PlaceNavLink active={active} href={routes.chat(place.slug, channel.slug)}>Chat</PlaceNavLink>;
}

function PlaceNavLink({ active, children, href }: { active: boolean; children: React.ReactNode; href: string }) {
  return <Link aria-current={active ? "page" : undefined} className={active ? "active" : undefined} href={href}>{children}</Link>;
}
