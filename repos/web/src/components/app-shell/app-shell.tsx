import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  Bookmark,
  Compass,
  Headphones,
  Home as HomeIcon,
  MessageSquareText,
  Mic2,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Volume2,
} from "lucide-react";
import type { ReactNode } from "react";
import type { CommunityFixture } from "@/features/community/community-fixtures";
import { routes } from "@/lib/routes";
import { Avatar } from "@/components/ui/avatar";

interface AppShellProps {
  activeNavigation?: "discover" | "home" | "saved";
  children: ReactNode;
  fixture: CommunityFixture;
}

export function AppShell({ activeNavigation = "home", children, fixture }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href={routes.home} aria-label="Displace home">
          <span className="brand-mark">D</span>
          <span>Displace</span>
        </Link>

        <nav className="primary-nav" aria-label="Primary navigation">
          <Link className={`nav-item${activeNavigation === "home" ? " active" : ""}`} href={routes.place(fixture.place.slug)}>
            <HomeIcon size={18} /> Home
          </Link>
          <Link className={`nav-item${activeNavigation === "discover" ? " active" : ""}`} href={routes.discover}>
            <Compass size={18} /> Discover
          </Link>
          <Link className={`nav-item${activeNavigation === "saved" ? " active" : ""}`} href={routes.saved}>
            <Bookmark size={18} /> Saved
          </Link>
        </nav>

        <section className="places" aria-labelledby="places-heading">
          <div className="section-label-row">
            <h2 id="places-heading">Your places</h2>
            <Link className="icon-button" href={routes.createPlace} title="Create a place">
              <Plus size={17} />
              <span className="sr-only">Create a place</span>
            </Link>
          </div>
          <div className="place-list">
            {fixture.places.map((place) => (
              <Link
                className={`place-item${place.active ? " active" : ""}`}
                href={routes.place(place.slug)}
                key={place.slug}
              >
                <Image alt="" className="place-image" height={36} src={place.imageUrl} width={36} />
                <span>{place.name}</span>
              </Link>
            ))}
          </div>
        </section>

        <div className="profile-row">
          <Avatar initials="PK" tone="coral" />
          <span className="profile-copy">
            <strong>Parker</strong>
            <small>Available</small>
          </span>
          <Link className="icon-button" href={routes.settings} title="Settings">
            <Settings size={17} />
            <span className="sr-only">Settings</span>
          </Link>
        </div>
      </aside>

      {children}

      <aside className="context-rail">
        <div className="rail-heading">
          <div>
            <p className="eyebrow">Live now</p>
            <h2>Voice rooms</h2>
          </div>
          <button className="icon-button" type="button" title="More voice options">
            <MoreHorizontal size={19} />
            <span className="sr-only">More voice options</span>
          </button>
        </div>

        <div className="voice-list">
          {fixture.voiceRooms.map((room) => (
            <article className="voice-room" key={room.slug}>
              <div className="voice-room-title">
                <span className="voice-icon"><Volume2 size={17} /></span>
                <div>
                  <h3>{room.name}</h3>
                  <p>{room.count} listening</p>
                </div>
              </div>
              <div className="voice-footer">
                <div className="avatar-stack" aria-label={`${room.count} participants`}>
                  {room.people.map((person) => <Avatar initials={person} key={person} size="small" />)}
                </div>
                <button className="join-button" type="button">
                  <Headphones size={16} /> Join
                </button>
              </div>
            </article>
          ))}
        </div>

        <section className="rail-section" aria-labelledby="channels-heading">
          <div className="section-label-row">
            <h2 id="channels-heading">Chat channels</h2>
            <button className="icon-button" type="button" title="Add channel">
              <Plus size={17} />
              <span className="sr-only">Add channel</span>
            </button>
          </div>
          <Link className="channel-row" href={routes.chat(fixture.place.slug, "general")}>
            <MessageSquareText size={17} />
            <span>general</span>
            <strong>14</strong>
          </Link>
          <Link className="channel-row" href={routes.chat(fixture.place.slug, "playtesting")}>
            <Mic2 size={17} />
            <span>playtesting</span>
          </Link>
        </section>
      </aside>
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