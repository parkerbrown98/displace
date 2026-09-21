export type FixtureState =
  | "anonymous"
  | "deleted"
  | "empty"
  | "failed"
  | "forbidden"
  | "pending"
  | "ready"
  | "slow"
  | "unauthenticated";

export interface PlaceSummary {
  name: string;
  slug: string;
  imageUrl: string;
  active?: boolean;
}

export interface TopicSummary {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  initials: string;
  updated: string;
  replies: number;
  views: string;
  unread: boolean;
}

export interface VoiceRoomSummary {
  slug: string;
  name: string;
  people: string[];
  count: number;
}

export interface CommunityFixture {
  state: FixtureState;
  place: {
    name: string;
    slug: string;
    description: string;
    memberCount: string;
    onlineCount: string;
  };
  places: PlaceSummary[];
  topics: TopicSummary[];
  voiceRooms: VoiceRoomSummary[];
}

const readyFixture: CommunityFixture = {
  state: "ready",
  place: {
    name: "Game Makers",
    slug: "game-makers",
    description: "Thoughtful discussion for people making games at every scale.",
    memberCount: "12.8k",
    onlineCount: "486",
  },
  places: [
    {
      name: "Game Makers",
      slug: "game-makers",
      imageUrl:
        "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=96&q=80",
      active: true,
    },
    {
      name: "Open Source",
      slug: "open-source",
      imageUrl:
        "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=96&q=80",
    },
    {
      name: "Sound Design",
      slug: "sound-design",
      imageUrl:
        "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=96&q=80",
    },
  ],
  topics: [
    {
      slug: "what-are-you-building-this-week",
      title: "What are you building this week?",
      excerpt: "Progress notes, stubborn bugs, and the small wins that keep a project moving.",
      category: "Showcase",
      author: "Mara V.",
      initials: "MV",
      updated: "8 min",
      replies: 42,
      views: "1.2k",
      unread: true,
    },
    {
      slug: "rollback-netcode-practical-resources",
      title: "Rollback netcode: practical resources and tradeoffs",
      excerpt: "Implementation notes for small teams, especially around prediction and state sync.",
      category: "Engineering",
      author: "Jon Bell",
      initials: "JB",
      updated: "34 min",
      replies: 18,
      views: "684",
      unread: true,
    },
    {
      slug: "monthly-playtest-exchange-september",
      title: "Monthly playtest exchange - September",
      excerpt: "Post a build, the feedback you need, and two windows when you can return the favor.",
      category: "Playtesting",
      author: "Aya",
      initials: "AY",
      updated: "2 hr",
      replies: 27,
      views: "912",
      unread: false,
    },
    {
      slug: "tools-for-dialogue-heavy-prototypes",
      title: "Good tools for dialogue-heavy prototypes",
      excerpt: "Lightweight narrative systems that do not require rebuilding the whole content pipeline.",
      category: "Tools",
      author: "Theo R.",
      initials: "TR",
      updated: "Yesterday",
      replies: 11,
      views: "406",
      unread: false,
    },
  ],
  voiceRooms: [
    { slug: "quiet-coworking", name: "Quiet coworking", people: ["MV", "JB", "SK"], count: 6 },
    { slug: "audio-critique", name: "Audio critique", people: ["AY", "NP"], count: 2 },
  ],
};

export function createCommunityFixture(
  state: FixtureState = "ready",
): CommunityFixture {
  const fixture: CommunityFixture = {
    ...readyFixture,
    state,
    place: { ...readyFixture.place },
    places: readyFixture.places.map((place) => ({ ...place })),
    topics: readyFixture.topics.map((topic) => ({ ...topic })),
    voiceRooms: readyFixture.voiceRooms.map((room) => ({
      ...room,
      people: [...room.people],
    })),
  };

  if (state === "empty") {
    return { ...fixture, topics: [], voiceRooms: [] };
  }

  return fixture;
}