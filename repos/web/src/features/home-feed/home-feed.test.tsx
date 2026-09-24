import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeFeed } from "./home-feed";
import { listHomeFeed } from "./home-feed-client";
import type { HomeFeedItemContract } from "./home-feed-contract";
import { setReaction, setTopicFollow, setTopicSave } from "@/features/forums/forum-client";

const state = vi.hoisted(() => ({
  push: vi.fn(),
  status: "anonymous" as "anonymous" | "authenticated",
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock("@/features/auth/session-provider", () => ({
  useSession: () => ({ status: state.status, user: state.status === "authenticated" ? { id: "viewer" } : null }),
}));
vi.mock("./home-feed-client", () => ({ listHomeFeed: vi.fn() }));
vi.mock("@/features/forums/forum-client", () => ({
  setReaction: vi.fn(),
  setTopicFollow: vi.fn(),
  setTopicSave: vi.fn(),
}));

const listFeed = vi.mocked(listHomeFeed);
const react = vi.mocked(setReaction);
const follow = vi.mocked(setTopicFollow);
const save = vi.mocked(setTopicSave);

beforeEach(() => {
  state.status = "anonymous";
  state.push.mockReset();
  listFeed.mockReset();
  react.mockReset().mockResolvedValue(undefined);
  follow.mockReset().mockResolvedValue(undefined);
  save.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("IntersectionObserver", class {
    disconnect() {}
    observe() {}
    unobserve() {}
  });
});

describe("HomeFeed", () => {
  it("loads a public trending feed and switches sort order", async () => {
    listFeed.mockResolvedValue({ items: [feedItem()] });
    const user = userEvent.setup();
    render(<HomeFeed />);

    expect(await screen.findByRole("heading", { name: "A durable first discussion" })).toBeInTheDocument();
    expect(listFeed).toHaveBeenCalledWith("best", undefined, false);
    expect(screen.getAllByText("Trending").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("tab", { name: "Hot" }));
    await waitFor(() => expect(listFeed).toHaveBeenLastCalledWith("hot", undefined, false));
  });

  it("uses authenticated mutations for inline engagement", async () => {
    state.status = "authenticated";
    listFeed.mockResolvedValue({ items: [feedItem({ sources: ["joined"] })] });
    const user = userEvent.setup();
    render(<HomeFeed />);
    await screen.findByRole("heading", { name: "A durable first discussion" });
    expect(screen.getByText("Your places")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Like A durable first discussion" }));
    await user.click(screen.getByRole("button", { name: "Follow" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(react).toHaveBeenCalledWith("place-1", "post-1", "like", true);
    expect(follow).toHaveBeenCalledWith("place-1", "topic-1", true);
    expect(save).toHaveBeenCalledWith("place-1", "topic-1", true);
    expect(screen.getAllByText("Following").length).toBeGreaterThan(0);
  });

  it("appends the next cursor page from the accessible load control", async () => {
    listFeed
      .mockResolvedValueOnce({ items: [feedItem()], nextCursor: "cursor-1" })
      .mockResolvedValueOnce({ items: [feedItem({ id: "topic-2", title: "A second useful thread" })] });
    const user = userEvent.setup();
    render(<HomeFeed />);
    await screen.findByRole("heading", { name: "A durable first discussion" });

    await user.click(screen.getByRole("button", { name: "Load more discussions" }));

    expect(await screen.findByRole("heading", { name: "A second useful thread" })).toBeInTheDocument();
    expect(listFeed).toHaveBeenLastCalledWith("best", "cursor-1", false);
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });
});

function feedItem(overrides: { id?: string; sources?: HomeFeedItemContract["sources"]; title?: string } = {}): HomeFeedItemContract {
  const id = overrides.id ?? "topic-1";
  return {
    excerpt: "Long-form conversations should stay easy to find and worth returning to.",
    forum: { id: "forum-1", name: "General" },
    isFollowing: false,
    isSaved: false,
    originalPostId: id === "topic-1" ? "post-1" : "post-2",
    place: { id: "place-1", name: "Open Web Club", slug: "open-web-club" },
    reactionCount: 4,
    sources: overrides.sources ?? ["trending"],
    topic: {
      author: { displayName: "Avery Stone", handle: "avery", id: "author-1", joinedAt: "2026-01-01T00:00:00.000Z" },
      authorUserId: "author-1",
      createdAt: "2026-09-22T12:00:00.000Z",
      forumId: "forum-1",
      id,
      isPinned: false,
      latestPostAt: "2026-09-24T12:00:00.000Z",
      previewImage: null,
      replyCount: 12,
      status: "open",
      tags: [{ color: "#255f5b", id: "tag-1", name: "Discussion", slug: "discussion" }],
      title: overrides.title ?? "A durable first discussion",
      viewCount: 208,
    },
    viewerHasReacted: false,
  };
}