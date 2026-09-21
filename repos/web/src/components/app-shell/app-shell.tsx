import Link from "next/link";
import {
  Bell,
  Bookmark,
  Compass,
  Home as HomeIcon,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import type { ReactNode } from "react";
import { PlaceSwitcher } from "@/features/places/place-access";
import { routes } from "@/lib/routes";

interface AppShellProps {
  activeNavigation?: "discover" | "home" | "saved" | null;
  activePlaceSlug?: string;
  children: ReactNode;
}

export function AppShell({ activeNavigation = "home", activePlaceSlug, children }: AppShellProps) {
  const singlePlace = Boolean(process.env.NEXT_PUBLIC_SINGLE_PLACE_SLUG);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href={routes.home} aria-label="Displace home">
          <span className="brand-mark">D</span>
          <span>Displace</span>
        </Link>

        <nav className="primary-nav" aria-label="Primary navigation">
          <Link className={`nav-item${activeNavigation === "home" ? " active" : ""}`} href={activePlaceSlug ? routes.place(activePlaceSlug) : routes.home}>
            <HomeIcon size={18} /> Home
          </Link>
          {!singlePlace ? <Link className={`nav-item${activeNavigation === "discover" ? " active" : ""}`} href={routes.discover}>
            <Compass size={18} /> Discover
          </Link> : null}
          <Link className={`nav-item${activeNavigation === "saved" ? " active" : ""}`} href={routes.saved}>
            <Bookmark size={18} /> Saved
          </Link>
        </nav>

        <section className="places" aria-labelledby="places-heading">
          <div className="section-label-row">
            <h2 id="places-heading">Your places</h2>
            {!singlePlace ? <Link className="icon-button" href={routes.createPlace} title="Create a place">
              <Plus size={17} />
              <span className="sr-only">Create a place</span>
            </Link> : null}
          </div>
          <PlaceSwitcher activeSlug={activePlaceSlug} />
        </section>

        <div className="profile-row">
          <span className="profile-copy">
            <strong>Account</strong>
            <small>Settings and sessions</small>
          </span>
          <Link className="icon-button" href={routes.settings} title="Settings">
            <Settings size={17} />
            <span className="sr-only">Settings</span>
          </Link>
        </div>
      </aside>

      {children}
    </div>
  );
}

export function ShellTopbar() {
  return (
    <header className="topbar">
      <form className="search-box" action={routes.search} role="search">
        <Search size={18} aria-hidden="true" />
        <label className="sr-only" htmlFor="global-search">Search discussions</label>
        <input id="global-search" name="q" placeholder="Search discussions" type="search" />
      </form>
      <Link className="icon-button notification-button" href={routes.notifications} title="Notifications">
        <Bell size={19} />
        <span className="notification-dot" />
        <span className="sr-only">Notifications</span>
      </Link>
    </header>
  );
}