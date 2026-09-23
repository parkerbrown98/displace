import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";
import type { SavedPostContract, SavedTopicContract } from "./forum-contract";
import { SavedLibrary } from "./saved-library";

const mocks = vi.hoisted(() => ({
  listSavedPosts: vi.fn(),
  listSavedTopics: vi.fn(),
  setPostSave: vi.fn(),
  setTopicSave: vi.fn(),
}));

vi.mock("@/features/auth/session-provider", () => ({
  useSession: () => ({ status: "authenticated", user: { id: "viewer" } }),
}));
vi.mock("./forum-client", () => mocks);

const topic: SavedTopicContract = {
  placeId: "makers-id",
  placeName: "Game Makers",
  placeSlug: "game-makers",
  savedAt: "2026-09-22T12:00:00.000Z",
  topic: {
    authorUserId: "author-id",
    createdAt: "2026-09-20T12:00:00.000Z",
    forumId: "forum-id",
    id: "topic-id",
    isPinned: false,
    latestPostAt: "2026-09-23T12:00:00.000Z",
    replyCount: 4,
    status: "open",
    tags: [{ color: null, id: "tag-id", name: "Design", slug: "design" }],
    title: "Designing a better inventory",
    viewCount: 18,
  },
};

const post: SavedPostContract = {
  placeId: "tabletop-id",
  placeName: "Tabletop Studio",
  placeSlug: "tabletop-studio",
  post: {
    author: { displayName: "Mara Vale", handle: "mara", id: "mara-id", joinedAt: "2026-01-01T12:00:00.000Z" },
    authorUserId: "mara-id",
    createdAt: "2026-09-21T12:00:00.000Z",
    document: null,
    id: "post-id",
    isDeleted: false,
    plainText: "Keep the first session narrow enough that every player gets a meaningful turn.",
    reactions: [],
    sanitizedHtml: null,
    topicId: "tabletop-topic-id",
    updatedAt: "2026-09-21T12:00:00.000Z",
    version: 1,
  },
  savedAt: "2026-09-23T12:00:00.000Z",
  topicTitle: "First-session pacing",
};

describe("SavedLibrary", () => {
  beforeEach(() => {
    mocks.listSavedTopics.mockResolvedValue({ items: [topic] });
    mocks.listSavedPosts.mockResolvedValue({ items: [post] });
    mocks.setTopicSave.mockResolvedValue(undefined);
    mocks.setPostSave.mockResolvedValue(undefined);
  });

  it("combines saved items and filters by type, search, and place", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><SavedLibrary /></ToastProvider>);

    expect(await screen.findByRole("heading", { name: "Designing a better inventory" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Keep the first session narrow/ })).toBeInTheDocument();
    const headings = screen.getAllByRole("heading").map((heading) => heading.textContent ?? "");
    expect(headings.indexOf(post.post.plainText ?? "")).toBeLessThan(headings.indexOf(topic.topic.title));

    await user.click(screen.getByRole("button", { name: /^Topics\d/ }));
    expect(screen.getByRole("heading", { name: "Designing a better inventory" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Keep the first session narrow/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^All\d/ }));
    await user.type(screen.getByRole("searchbox", { name: "Search saved items" }), "mara");
    expect(screen.queryByRole("heading", { name: "Designing a better inventory" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Keep the first session narrow/ })).toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: "Search saved items" }));
    await user.click(screen.getByRole("button", { name: /^Game Makers\d/ }));
    expect(screen.getByRole("heading", { name: "Designing a better inventory" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Keep the first session narrow/ })).not.toBeInTheDocument();
  });

  it("removes a saved topic from the API and queue", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><SavedLibrary /></ToastProvider>);

    await screen.findByRole("heading", { name: "Designing a better inventory" });
    await user.click(screen.getByRole("button", { name: "Remove saved topic" }));

    await waitFor(() => expect(mocks.setTopicSave).toHaveBeenCalledWith("makers-id", "topic-id", false));
    expect(screen.queryByRole("heading", { name: "Designing a better inventory" })).not.toBeInTheDocument();
    expect(screen.getByText("Topic removed from Saved.")).toBeInTheDocument();
  });
});
