"use client";

import { Laptop, LogOut, Smartphone, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { FormField } from "@/components/ui/form-field";
import { LoadingPanel, StatusPanel } from "@/components/ui/status-panel";
import { getProfileImage, setProfileImage } from "@/features/assets/asset-client";
import { ImageUploader } from "@/features/assets/image-uploader";
import { getPlaceContext, listMyPlaces } from "@/features/places/place-client";
import { routes } from "@/lib/routes";
import type { AccountSession } from "./auth-contracts";
import { changeEmail, changePassword, listSessions, revokeSession, updateProfile } from "./auth-client";
import { authErrorMessage } from "./auth-error-message";
import { useSession } from "./session-provider";

type Notice = { kind: "error" | "success"; text: string } | null;

export function AccountSettings() {
  const router = useRouter();
  const session = useSession();
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [sessionsFailed, setSessionsFailed] = useState(false);

  useEffect(() => {
    if (session.status !== "authenticated") return;
    let active = true;
    void listSessions()
      .then((items) => { if (active) setSessions(items); })
      .catch(() => { if (active) setSessionsFailed(true); });
    return () => { active = false; };
  }, [session.status]);

  if (session.status === "loading") return <main className="settings-main" id="main-content"><LoadingPanel label="Loading account" /></main>;
  if (session.status === "unavailable") return <main className="settings-main" id="main-content"><StatusPanel title="Account unavailable" description="Your account could not be loaded. Try again shortly." tone="error" /></main>;
  if (session.status === "anonymous" || !session.user) {
    return <main className="settings-main" id="main-content"><StatusPanel title="Sign in required" description="Sign in to manage your account and active sessions." action={<Link className="primary-button" href={`${routes.signIn}?returnTo=${encodeURIComponent(routes.settings)}`}>Sign in</Link>} /></main>;
  }

  async function leave(all: boolean) {
    await session.signOutAccount(all);
    router.replace(routes.home);
    router.refresh();
  }

  return (
    <main className="settings-main" id="main-content">
      <header className="settings-heading">
        <p className="eyebrow">Account</p><h1>Settings</h1>
        <p>Manage your public identity, credentials, and signed-in devices.</p>
      </header>
      <div className="settings-layout">
        <nav aria-label="Settings sections">
          <a href="#profile">Profile</a><a href="#profile-image">Profile image</a><a href="#email">Email</a><a href="#password">Password</a><a href="#sessions">Sessions</a>
        </nav>
        <div className="settings-sections">
          <ProfileSettings user={session.user} onSaved={session.refreshProfile} />
          <ProfileImageSettings />
          <EmailSettings email={session.user.email} verified={session.user.emailVerified} />
          <PasswordSettings />
          <section className="settings-section" id="sessions">
            <div className="settings-section-heading"><div><p className="eyebrow">Security</p><h2>Active sessions</h2></div><button className="danger-button" onClick={() => void leave(true)} type="button"><LogOut size={16} aria-hidden="true" /> Sign out everywhere</button></div>
            {sessionsFailed ? <p className="form-message form-message-error" role="alert">Sessions could not be loaded.</p> : <SessionList sessions={sessions} onRevoke={async (id) => { await revokeSession(id); setSessions((items) => items.filter((item) => item.id !== id)); }} />}
            <button className="secondary-button" onClick={() => void leave(false)} type="button">Sign out on this device</button>
          </section>
        </div>
      </div>
    </main>
  );
}

function ProfileImageSettings() {
  const [places, setPlaces] = useState<Array<{ id: string; name: string }>>([]);
  const [placeId, setPlaceId] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void listMyPlaces()
      .then(async (page) => {
        const contexts = await Promise.all(
          page.items.map((place) => getPlaceContext(place.id).catch(() => undefined)),
        );
        const available = contexts
          .filter((context) => context?.viewer.permissions.includes("upload.create"))
          .map((context) => ({ id: context!.place.id, name: context!.place.name }));
        const references = await Promise.all(available.map((place) =>
          getProfileImage(place.id, "avatar").catch(() => ({ assetId: null })),
        ));
        const currentPlace = available[references.findIndex((reference) => reference.assetId)];
        if (active) {
          setPlaces(available);
          setPlaceId(currentPlace?.id ?? available[0]?.id ?? "");
        }
      })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  return (
    <section className="settings-section" id="profile-image">
      <p className="eyebrow">Portrait</p>
      <h2>Profile image</h2>
      {failed ? (
        <p className="form-message form-message-error" role="alert">Upload access could not be loaded.</p>
      ) : places.length ? (
        <>
          {places.length > 1 ? (
            <label className="form-field">
              Upload storage
              <select onChange={(event) => setPlaceId(event.target.value)} value={placeId}>
                {places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
              </select>
              <small>The image remains private in this place&apos;s storage.</small>
            </label>
          ) : null}
          <ImageUploader
            currentImage="profile-avatar"
            description="JPEG, PNG, or WebP up to 25 MB. Square images work best."
            label="Profile photo"
            onUploaded={async (asset) => { await setProfileImage(placeId, "avatar", asset.id); }}
            placeId={placeId}
          />
        </>
      ) : (
        <p className="settings-muted">Join a place with upload access to add a profile image.</p>
      )}
    </section>
  );
}

function ProfileSettings({ user, onSaved }: { user: { displayName: string; handle: string }; onSaved: () => Promise<void> }) {
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setNotice(null);
    const form = new FormData(event.currentTarget);
    try {
      await updateProfile({ displayName: String(form.get("displayName") ?? ""), handle: String(form.get("handle") ?? "") });
      await onSaved(); setNotice({ kind: "success", text: "Profile saved." });
    } catch (cause) { setNotice({ kind: "error", text: authErrorMessage(cause, "Profile could not be saved.") }); }
    finally { setPending(false); }
  }
  return <section className="settings-section" id="profile"><p className="eyebrow">Public identity</p><h2>Profile</h2><form className="settings-form" method="post" onSubmit={submit}>
    <FormField defaultValue={user.displayName} label="Display name" maxLength={100} name="displayName" required />
    <FormField defaultValue={user.handle} hint="3-32 lowercase letters, numbers, or underscores." label="Handle" maxLength={32} minLength={3} name="handle" pattern="[a-z0-9_]{3,32}" required />
    <NoticeMessage notice={notice} /><button className="primary-button" disabled={pending} type="submit">{pending ? "Saving..." : "Save profile"}</button>
  </form></section>;
}

function EmailSettings({ email, verified }: { email: string; verified: boolean }) {
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setNotice(null);
    try { await changeEmail(String(new FormData(event.currentTarget).get("email") ?? "")); setNotice({ kind: "success", text: "A verification message has been queued." }); }
    catch (cause) { setNotice({ kind: "error", text: authErrorMessage(cause, "Email could not be changed.") }); }
    finally { setPending(false); }
  }
  return <section className="settings-section" id="email"><div className="settings-section-heading"><div><p className="eyebrow">Contact</p><h2>Email</h2></div><span className={`verification-state ${verified ? "verified" : ""}`}>{verified ? "Verified" : "Verification pending"}</span></div><form className="settings-form" method="post" onSubmit={submit}>
    <FormField autoComplete="email" defaultValue={email} label="Email address" name="email" type="email" required />
    <NoticeMessage notice={notice} /><button className="primary-button" disabled={pending} type="submit">{pending ? "Sending..." : "Change email"}</button>
  </form></section>;
}

function PasswordSettings() {
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setNotice(null);
    const form = new FormData(event.currentTarget);
    try { await changePassword(String(form.get("currentPassword") ?? ""), String(form.get("newPassword") ?? "")); event.currentTarget.reset(); setNotice({ kind: "success", text: "Password changed." }); }
    catch (cause) { setNotice({ kind: "error", text: authErrorMessage(cause, "Password could not be changed. Check your current password.") }); }
    finally { setPending(false); }
  }
  return <section className="settings-section" id="password"><p className="eyebrow">Credentials</p><h2>Password</h2><form className="settings-form" method="post" onSubmit={submit}>
    <FormField autoComplete="current-password" label="Current password" name="currentPassword" type="password" required />
    <FormField autoComplete="new-password" hint="Use at least 12 characters." label="New password" minLength={12} maxLength={256} name="newPassword" type="password" required />
    <NoticeMessage notice={notice} /><button className="primary-button" disabled={pending} type="submit">{pending ? "Updating..." : "Change password"}</button>
  </form></section>;
}

function SessionList({ sessions, onRevoke }: { sessions: AccountSession[]; onRevoke: (id: string) => Promise<void> }) {
  if (!sessions.length) return <p className="settings-muted">No active sessions were returned.</p>;
  return <div className="session-list">{sessions.map((session) => <article className="session-row" key={session.id}>
    {session.userAgent?.toLowerCase().includes("iphone") ? <Smartphone aria-hidden="true" /> : <Laptop aria-hidden="true" />}
    <div><strong>{session.userAgent ?? "Unknown device"}{session.current ? " (current)" : ""}</strong><span>Last active {formatSessionDate(session.lastSeenAt)}{session.ipAddress ? ` · ${session.ipAddress}` : ""}</span></div>
    {!session.current ? <button className="icon-button" onClick={() => void onRevoke(session.id)} title="Revoke session" type="button"><Trash2 size={17} /><span className="sr-only">Revoke {session.userAgent ?? "session"}</span></button> : null}
  </article>)}</div>;
}

function NoticeMessage({ notice }: { notice: Notice }) {
  return notice ? <p className={`form-message form-message-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p> : null;
}

function formatSessionDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}