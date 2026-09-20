import Image from "next/image";
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
  Users,
  Volume2,
} from "lucide-react";

const places = [
  {
    name: "Game Makers",
    image:
      "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=96&q=80",
    active: true,
  },
  {
    name: "Open Source",
    image:
      "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=96&q=80",
  },
  {
    name: "Sound Design",
    image:
      "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=96&q=80",
  },
];

const topics = [
  {
    title: "What are you building this week?",
    excerpt:
      "Progress notes, stubborn bugs, and the small wins that keep a project moving.",
    category: "Showcase",
    author: "Mara V.",
    initials: "MV",
    updated: "8 min",
    replies: 42,
    views: "1.2k",
    unread: true,
  },
  {
    title: "Rollback netcode: practical resources and tradeoffs",
    excerpt:
      "Implementation notes for small teams, especially around prediction and state sync.",
    category: "Engineering",
    author: "Jon Bell",
    initials: "JB",
    updated: "34 min",
    replies: 18,
    views: "684",
    unread: true,
  },
  {
    title: "Monthly playtest exchange — September",
    excerpt:
      "Post a build, the feedback you need, and two windows when you can return the favor.",
    category: "Playtesting",
    author: "Aya",
    initials: "AY",
    updated: "2 hr",
    replies: 27,
    views: "912",
    unread: false,
  },
  {
    title: "Good tools for dialogue-heavy prototypes",
    excerpt:
      "Lightweight narrative systems that do not require rebuilding the whole content pipeline.",
    category: "Tools",
    author: "Theo R.",
    initials: "TR",
    updated: "Yesterday",
    replies: 11,
    views: "406",
    unread: false,
  },
];

const voiceRooms = [
  { name: "Quiet coworking", people: ["MV", "JB", "SK"], count: 6 },
  { name: "Audio critique", people: ["AY", "NP"], count: 2 },
];

export default function Home() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Displace home">
          <span className="brand-mark">D</span>
          <span>Displace</span>
        </a>

        <nav className="primary-nav" aria-label="Primary navigation">
          <a className="nav-item active" href="#latest">
            <HomeIcon size={18} /> Home
          </a>
          <a className="nav-item" href="#discover">
            <Compass size={18} /> Discover
          </a>
          <a className="nav-item" href="#saved">
            <Bookmark size={18} /> Saved
          </a>
        </nav>

        <section className="places" aria-labelledby="places-heading">
          <div className="section-label-row">
            <h2 id="places-heading">Your places</h2>
            <button className="icon-button" type="button" title="Create a place">
              <Plus size={17} />
              <span className="sr-only">Create a place</span>
            </button>
          </div>
          <div className="place-list">
            {places.map((place) => (
              <a
                className={`place-item${place.active ? " active" : ""}`}
                href="#community"
                key={place.name}
              >
                <Image
                  alt=""
                  className="place-image"
                  height={36}
                  src={place.image}
                  width={36}
                />
                <span>{place.name}</span>
              </a>
            ))}
          </div>
        </section>

        <div className="profile-row">
          <span className="avatar avatar-coral">PK</span>
          <span className="profile-copy">
            <strong>Parker</strong>
            <small>Available</small>
          </span>
          <button className="icon-button" type="button" title="Settings">
            <Settings size={17} />
            <span className="sr-only">Settings</span>
          </button>
        </div>
      </aside>

      <main className="main-content" id="community">
        <header className="topbar">
          <label className="search-box">
            <Search size={18} />
            <span className="sr-only">Search discussions</span>
            <input placeholder="Search discussions" type="search" />
          </label>
          <button className="icon-button notification-button" type="button" title="Notifications">
            <Bell size={19} />
            <span className="notification-dot" />
            <span className="sr-only">Notifications</span>
          </button>
        </header>

        <section className="community-header">
          <div>
            <p className="eyebrow">PLACE / PUBLIC</p>
            <h1>Game Makers</h1>
            <p className="community-description">
              Thoughtful discussion for people making games at every scale.
            </p>
          </div>
          <div className="community-stats" aria-label="Community statistics">
            <span>
              <Users size={16} /> 12.8k members
            </span>
            <span className="online-status">486 online</span>
          </div>
        </section>

        <div className="content-toolbar">
          <nav className="topic-tabs" aria-label="Topic filters">
            <a className="active" href="#latest" id="latest">Latest</a>
            <a href="#popular">Popular</a>
            <a href="#following">Following</a>
          </nav>
          <button className="primary-button" type="button">
            <Plus size={18} /> New topic
          </button>
        </div>

        <section className="topic-list" aria-labelledby="topics-heading">
          <div className="list-heading">
            <h2 id="topics-heading">Recent discussions</h2>
            <span>Updated now</span>
          </div>
          {topics.map((topic) => (
            <article className="topic-row" key={topic.title}>
              <span className={`unread-marker${topic.unread ? " visible" : ""}`} />
              <div className="topic-copy">
                <div className="topic-title-row">
                  <a href="#topic">{topic.title}</a>
                  <span className="category-tag">{topic.category}</span>
                </div>
                <p>{topic.excerpt}</p>
                <div className="topic-byline">
                  <span className="avatar avatar-small">{topic.initials}</span>
                  <span>{topic.author}</span>
                  <span aria-hidden="true">·</span>
                  <time>{topic.updated}</time>
                </div>
              </div>
              <dl className="topic-metrics">
                <div>
                  <dt>Replies</dt>
                  <dd>{topic.replies}</dd>
                </div>
                <div>
                  <dt>Views</dt>
                  <dd>{topic.views}</dd>
                </div>
              </dl>
            </article>
          ))}
        </section>
      </main>

      <aside className="context-rail">
        <div className="rail-heading">
          <div>
            <p className="eyebrow">LIVE NOW</p>
            <h2>Voice rooms</h2>
          </div>
          <button className="icon-button" type="button" title="More voice options">
            <MoreHorizontal size={19} />
            <span className="sr-only">More voice options</span>
          </button>
        </div>

        <div className="voice-list">
          {voiceRooms.map((room) => (
            <article className="voice-room" key={room.name}>
              <div className="voice-room-title">
                <span className="voice-icon">
                  <Volume2 size={17} />
                </span>
                <div>
                  <h3>{room.name}</h3>
                  <p>{room.count} listening</p>
                </div>
              </div>
              <div className="voice-footer">
                <div className="avatar-stack" aria-label={`${room.count} participants`}>
                  {room.people.map((person) => (
                    <span className="avatar avatar-small" key={person}>{person}</span>
                  ))}
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
          <a className="channel-row" href="#general">
            <MessageSquareText size={17} />
            <span>general</span>
            <strong>14</strong>
          </a>
          <a className="channel-row" href="#playtesting">
            <Mic2 size={17} />
            <span>playtesting</span>
          </a>
        </section>
      </aside>
    </div>
  );
}
