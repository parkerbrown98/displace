"use client";

import { Check, LogIn, LogOut, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState, type FormEvent } from "react";
import { LoadingPanel, StatusPanel } from "@/components/ui/status-panel";
import { useSession } from "@/features/auth/session-provider";
import { ApiError } from "@/lib/api/problem-details";
import { routes } from "@/lib/routes";
import type { PlaceContextContract, PlaceContract } from "./place-contract";
import { acceptPlaceInvite, getPlaceContext, joinPlace, leavePlace, listMyPlaces, singlePlaceSlug } from "./place-client";
import { PlaceIcon } from "./place-icon";

export function usePlaceWorkspace(placeId: string) {
  const session = useSession();
  const [context, setContext] = useState<PlaceContextContract | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  async function reload() {
    setStatus("loading");
    try {
      const next = await getPlaceContext(placeId);
      startTransition(() => { setContext(next); setStatus("ready"); });
    } catch {
      setContext(null);
      setStatus("error");
    }
  }

  useEffect(() => {
    if (session.status !== "authenticated") return;
    let active = true;
    void getPlaceContext(placeId).then((next) => {
      if (active) startTransition(() => { setContext(next); setStatus("ready"); });
    }).catch(() => {
      if (active) { setContext(null); setStatus("error"); }
    });
    return () => { active = false; };
  }, [placeId, session.status]);

  const workspaceStatus = session.status === "authenticated" ? status : session.status === "loading" ? "loading" : "error";
  return { context, reload, session, status: workspaceStatus };
}

export function PlaceWorkspaceGate({ children, placeId, returnTo = routes.place(placeId) }: { children: (workspace: { context: PlaceContextContract; reload: () => Promise<void> }) => React.ReactNode; placeId: string; returnTo?: string }) {
  const workspace = usePlaceWorkspace(placeId);
  if (workspace.session.status === "loading" || workspace.status === "loading") return <main className="public-main standalone-public-state" id="main-content"><LoadingPanel label="Loading place" /></main>;
  if (workspace.session.status === "anonymous") return <main className="public-main standalone-public-state" id="main-content"><StatusPanel title="Sign in required" description="Sign in to access this page." action={<Link className="primary-button" href={`${routes.signIn}?returnTo=${encodeURIComponent(returnTo)}`}>Sign in</Link>} /></main>;
  if (!workspace.context) return <main className="public-main standalone-public-state" id="main-content"><StatusPanel tone="error" title="Place unavailable" description="Your membership or permissions may have changed. Return to the place and try again." action={<Link className="secondary-button" href={routes.place(placeId)}>Return to place</Link>} /></main>;
  return children({ context: workspace.context, reload: workspace.reload });
}

export function PlaceMembershipButton({ place }: { place: PlaceContract }) {
  const session = useSession();
  const router = useRouter();
  const [context, setContext] = useState<PlaceContextContract | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (session.status !== "authenticated") return;
    let active = true;
    void getPlaceContext(place.id).then((value) => { if (active) setContext(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [place.id, session.status]);

  if (session.status === "loading") return <button className="place-membership-button" disabled type="button">Checking...</button>;
  if (session.status !== "authenticated") return <Link className="place-membership-button" href={`${routes.signIn}?returnTo=${encodeURIComponent(routes.place(place.slug))}`}><LogIn size={15} /> Sign in</Link>;

  async function join() {
    setPending(true);
    try {
      const result = await joinPlace(place.id);
      if (result.status === "pending") setRequestSent(true);
      else setContext(await getPlaceContext(place.id));
    } catch { return; }
    finally { setPending(false); }
  }

  async function leave() {
    setPending(true);
    try { await leavePlace(place.id); setContext(null); router.refresh(); }
    catch { return; }
    finally { setPending(false); }
  }

  if (context) return <button className="place-membership-button" disabled={pending || context.viewer.isOwner} onClick={() => void leave()} title={context.viewer.isOwner ? "Transfer ownership before leaving" : undefined} type="button"><LogOut size={15} /> {pending ? "Leaving..." : "Leave"}</button>;
  if (place.joinPolicy === "invite_only") return <button className="place-membership-button" disabled title="An invitation is required to join" type="button">Invite only</button>;
  return <button className="place-membership-button" disabled={pending || requestSent} onClick={() => void join()} type="button"><UserPlus size={15} /> {requestSent ? "Request sent" : pending ? "Joining..." : place.joinPolicy === "approval" ? "Request to join" : "Join"}</button>;
}

export function PlaceSwitcher({ activeSlug }: { activeSlug?: string }) {
  const session = useSession();
  const [places, setPlaces] = useState<PlaceContract[]>([]);
  const configuredSlug = singlePlaceSlug();
  useEffect(() => {
    if (session.status !== "authenticated") return;
    let active = true;
    void listMyPlaces().then((page) => { if (active) setPlaces(page.items); }).catch(() => undefined);
    return () => { active = false; };
  }, [session.status]);
  const visible = places.filter((place) => !configuredSlug || place.slug === configuredSlug);
  return <div className="place-list">{visible.map((place, index) => <Link className={`place-item${place.slug === activeSlug ? " active" : ""}`} href={routes.place(place.slug)} key={place.slug}>
    <PlaceIcon className={`place-switcher-mark place-switcher-mark-${index % 3}`} place={place} /><span>{place.name}</span>
  </Link>)}</div>;
}

export function InviteAcceptance({ placeSlug, token }: { placeSlug: string; token?: string }) {
  const session = useSession();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(null);
    const value = String(new FormData(event.currentTarget).get("token") ?? "");
    try { await acceptPlaceInvite(placeSlug, value); setMessage("Invitation accepted. Opening the place..."); router.replace(routes.place(placeSlug)); router.refresh(); }
    catch (error) { setMessage(placeErrorMessage(error, "The invitation could not be accepted.")); }
    finally { setPending(false); }
  }
  if (session.status === "anonymous") return <StatusPanel title="Sign in to accept" description="This invitation must be connected to a verified account." action={<Link className="primary-button" href={`${routes.signIn}?returnTo=${encodeURIComponent(`${routes.acceptPlaceInvite(placeSlug)}?token=${token ?? ""}`)}`}>Sign in</Link>} />;
  return <section className="settings-section invite-acceptance"><p className="eyebrow">Invitation</p><h1>Join this place</h1><p>Accept the invitation to activate your membership and assigned role.</p><form className="settings-form" method="post" onSubmit={submit}><label className="form-field">Invite token<input defaultValue={token} minLength={32} name="token" required /></label>{message ? <p className="form-message" role="status">{message}</p> : null}<button className="primary-button" disabled={pending} type="submit"><Check size={16} /> {pending ? "Accepting..." : "Accept invitation"}</button></form></section>;
}

export function placeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.problem.detail ?? error.problem.title;
  return fallback;
}
