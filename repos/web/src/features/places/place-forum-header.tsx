"use client";

import { Bell, Search, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { listChatChannels } from "@/features/chat/chat-client";
import type { ChatChannelContract } from "@/features/chat/chat-contracts";
import { useSession } from "@/features/auth/session-provider";
import { NotificationIndicator } from "@/features/notifications/notification-indicator";
import { routes } from "@/lib/routes";
import { PlaceMembershipActions } from "./place-access";
import { getPlaceContext } from "./place-client";
import type { PlaceContract } from "./place-contract";

type PlaceSection = "chat" | "forums" | "members" | "settings";

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

  return (
    <header className="place-toolbar">
      <div className="place-toolbar-identity">
        <span className="place-toolbar-mark" aria-hidden="true">{initials(place.name)}</span>
        <div className="place-toolbar-title"><p className="eyebrow">{place.visibility} community</p><h1>{place.name}</h1></div>
      </div>
      <nav className="place-toolbar-nav" aria-label={`${place.name} navigation`}>
        <PlaceNavLink active={active === "forums"} href={routes.place(place.slug)}>Forums</PlaceNavLink>
        <PlaceNavLink active={active === "members"} href={routes.placeMembers(place.slug)}>Members</PlaceNavLink>
        {settingsVisible ? <PlaceNavLink active={active === "settings"} href={routes.placeSettings(place.slug)}>Settings</PlaceNavLink> : null}
        <ChatNavLink active={active === "chat"} currentSection={currentSection} place={place} />
      </nav>
      <div className="place-toolbar-actions">
        <span className="place-membership"><Users size={16} aria-hidden="true" /> {place.joinPolicy === "open" ? "Open membership" : "Membership by request"}</span>
        <PlaceSearch />
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

function useSettingsVisibility(placeId: string, showSettings: boolean) {
  const session = useSession();
  const [settingsVisible, setSettingsVisible] = useState(showSettings);

  useEffect(() => {
    setSettingsVisible(showSettings);
    if (showSettings || session.status !== "authenticated") return;
    let active = true;
    void getPlaceContext(placeId)
      .then((context) => {
        if (active) setSettingsVisible(context.viewer.permissions.some((permission) => ["place.manage", "role.manage", "member.manage", "forum.manage"].includes(permission)));
      })
      .catch(() => {
        if (active) setSettingsVisible(false);
      });
    return () => { active = false; };
  }, [placeId, session.status, showSettings]);

  return settingsVisible;
}

function PlaceSearch() {
  const input = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (expanded) input.current?.focus();
  }, [expanded]);

  if (!expanded) {
    return <button aria-expanded="false" className="icon-button place-search-toggle" onClick={() => setExpanded(true)} title="Search discussions" type="button"><Search size={18} /><span className="sr-only">Search discussions</span></button>;
  }

  return <form action={routes.search} className="place-toolbar-search" role="search">
    <Search aria-hidden="true" size={17} />
    <label className="sr-only" htmlFor="place-search">Search discussions</label>
    <input id="place-search" name="q" placeholder="Search discussions" ref={input} required type="search" />
    <button aria-label="Close search" className="icon-button" onClick={() => setExpanded(false)} title="Close search" type="button"><X size={16} /></button>
  </form>;
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

function initials(value: string): string {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
