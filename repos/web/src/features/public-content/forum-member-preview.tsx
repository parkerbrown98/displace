"use client";

import { ArrowRight, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/features/auth/session-provider";
import { listPlaceMembers } from "@/features/places/place-client";
import type { PlaceMemberContract } from "@/features/places/place-contract";
import { routes } from "@/lib/routes";

export function ForumMemberPreview({ placeId, placeName, placeSlug }: { placeId: string; placeName: string; placeSlug: string }) {
  const session = useSession();
  const [members, setMembers] = useState<PlaceMemberContract[] | null>(null);

  useEffect(() => {
    if (session.status !== "authenticated") return;
    let active = true;
    void listPlaceMembers(placeId, "active", undefined, { limit: 5, sort: "last_seen" })
      .then((page) => { if (active) setMembers(page.items); })
      .catch(() => { if (active) setMembers([]); });
    return () => { active = false; };
  }, [placeId, session.status]);

  return (
    <section className="portal-panel portal-community-panel">
      <header><Users size={17} aria-hidden="true" /><h2>{members?.length ? "Recently seen" : "Community"}</h2></header>
      {members?.length ? <div className="portal-member-list">{members.map((member) => (
        <Link href={routes.placeMember(placeSlug, member.id)} key={member.id}>
          <span className="portal-member-avatar" aria-hidden="true">{initials(member.displayName)}</span>
          <span><strong>{member.displayName}</strong><small>{member.lastSeenAt ? formatRelativeDate(member.lastSeenAt) : `@${member.handle}`}</small></span>
        </Link>
      ))}</div> : <p>Meet the people taking part in {placeName}.</p>}
      <Link className="portal-panel-link" href={routes.placeMembers(placeSlug)}>Browse members <ArrowRight size={15} aria-hidden="true" /></Link>
    </section>
  );
}

function initials(value: string): string {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatRelativeDate(value: string): string {
  const hours = Math.floor((Date.now() - Date.parse(value)) / 3_600_000);
  if (hours < 1) return "Seen recently";
  if (hours < 24) return `Seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `Seen ${days}d ago` : "Seen this month";
}