"use client";

import { Users } from "lucide-react";
import Link from "next/link";
import { routes } from "@/lib/routes";
import { PlaceMembershipActions } from "./place-access";
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
  return (
    <header className="place-forum-header">
      <div className="place-forum-identity">
        <span className="place-forum-mark" aria-hidden="true">{initials(place.name)}</span>
        <div><p className="eyebrow">{place.visibility} community</p><h1>{place.name}</h1><p>{place.description}</p></div>
      </div>
      <div className="place-header-actions">
        <span><Users size={17} aria-hidden="true" /> {place.joinPolicy === "open" ? "Open membership" : "Membership by request"}</span>
        {showMembershipActions ? <PlaceMembershipActions place={place} /> : null}
      </div>
      <nav className="place-forum-nav" aria-label={`${place.name} navigation`}>
        <PlaceNavLink active={active === "forums"} href={routes.place(place.slug)}>Forums</PlaceNavLink>
        <PlaceNavLink active={active === "members"} href={routes.placeMembers(place.slug)}>Members</PlaceNavLink>
        {showSettings ? <PlaceNavLink active={active === "settings"} href={routes.placeSettings(place.slug)}>Settings</PlaceNavLink> : null}
        {currentSection ? <PlaceNavLink active={active === "chat"} href={currentSection.href}>{currentSection.label}</PlaceNavLink> : null}
      </nav>
    </header>
  );
}

function PlaceNavLink({ active, children, href }: { active: boolean; children: React.ReactNode; href: string }) {
  return <Link aria-current={active ? "page" : undefined} className={active ? "active" : undefined} href={href}>{children}</Link>;
}

function initials(value: string): string {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
