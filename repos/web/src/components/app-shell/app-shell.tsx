"use client";

import Link from "next/link";
import {
  Bell,
  Bookmark,
  Compass,
  Home as HomeIcon,
  Plus,
  Search,
  Settings,
  Shield,
  Wrench,
} from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useSession } from "@/features/auth/session-provider";
import { NotificationIndicator } from "@/features/notifications/notification-indicator";
import { PlaceSwitcher } from "@/features/places/place-access";
import { routes } from "@/lib/routes";

interface AppShellProps {
  activeNavigation?: "discover" | "home" | "saved" | null;
  activePlaceSlug?: string;
  children: ReactNode;
}

export function AppShell({ activeNavigation, activePlaceSlug, children }: AppShellProps) {
  const pathname = usePathname();
  const session = useSession();
  const singlePlace = Boolean(process.env.NEXT_PUBLIC_SINGLE_PLACE_SLUG);
  const authenticated = session.status === "authenticated";
  const currentPlaceSlug = activePlaceSlug ?? pathname.match(/^\/places\/([^/]+)/)?.[1];
  const currentNavigation = activeNavigation === undefined
    ? pathname === routes.discover
      ? "discover"
      : pathname === routes.saved
        ? "saved"
        : pathname.startsWith("/places/")
          ? "home"
          : null
    : activeNavigation;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href={routes.home} aria-label="Displace home">
          <span className="brand-mark">D</span>
          <span>Displace</span>
        </Link>

        <nav className="primary-nav" aria-label="Primary navigation">
          <Link className={`nav-item${currentNavigation === "home" ? " active" : ""}`} href={currentPlaceSlug ? routes.place(currentPlaceSlug) : routes.home}>
            <HomeIcon size={18} /> Home
          </Link>
          {!singlePlace ? <Link className={`nav-item${currentNavigation === "discover" ? " active" : ""}`} href={routes.discover}>
            <Compass size={18} /> Discover
          </Link> : null}
          {authenticated ? <Link className={`nav-item${currentNavigation === "saved" ? " active" : ""}`} href={routes.saved}>
            <Bookmark size={18} /> Saved
          </Link> : null}
          {authenticated ? <Link className={`nav-item${pathname.startsWith(routes.moderation) ? " active" : ""}`} href={routes.moderation}>
            <Shield size={18} /> Moderation
          </Link> : null}
          {session.user?.isInstanceAdmin ? <Link className={`nav-item${pathname.startsWith(routes.administration) ? " active" : ""}`} href={routes.administration}>
            <Wrench size={18} /> Administration
          </Link> : null}
        </nav>

        {authenticated ? <section className="places" aria-labelledby="places-heading">
          <div className="section-label-row">
            <h2 id="places-heading">Your places</h2>
            {!singlePlace ? <Link className="icon-button" href={routes.createPlace} title="Create a place">
              <Plus size={17} />
              <span className="sr-only">Create a place</span>
            </Link> : null}
          </div>
          <PlaceSwitcher activeSlug={currentPlaceSlug} />
        </section> : session.status === "loading" ? <section className="sidebar-session-status" aria-live="polite">
          <p>Checking your session...</p>
        </section> : <section className="sidebar-auth-callout" aria-labelledby="sidebar-auth-heading">
          <h2 id="sidebar-auth-heading">Join the conversation</h2>
          <p>Create an account to join places, save discussions, and write replies.</p>
          <div className="sidebar-auth-actions">
            <Link className="primary-button" href={routes.register}>Create account</Link>
            <Link className="secondary-button" href={`${routes.signIn}?returnTo=${encodeURIComponent(pathname)}`}>Sign in</Link>
          </div>
        </section>}

        {authenticated ? <div className="profile-row">
          <span className="profile-copy">
            <strong>{session.user?.displayName}</strong>
            <small>@{session.user?.handle}</small>
          </span>
          <Link className="icon-button" href={routes.settings} title="Settings">
            <Settings size={17} />
            <span className="sr-only">Settings</span>
          </Link>
        </div> : null}
      </aside>

      {children}
    </div>
  );
}

export function ShellTopbar() {
  const pathname = usePathname();
  const session = useSession();
  const isPlaceRoute = pathname.startsWith("/places/");
  if (isPlaceRoute) return null;
  return (
    <header className="topbar">
      <form className="search-box" action={routes.search} role="search">
        <Search size={18} aria-hidden="true" />
        <label className="sr-only" htmlFor="global-search">Search discussions</label>
        <input id="global-search" name="q" placeholder="Search discussions" type="search" />
      </form>
      {session.status === "authenticated" ? <Link className="icon-button notification-button" href={routes.notifications} title="Notifications">
        <Bell size={19} />
        <NotificationIndicator />
        <span className="sr-only">Notifications</span>
      </Link> : null}
    </header>
  );
}