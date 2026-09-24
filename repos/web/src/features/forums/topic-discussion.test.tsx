import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { placeContractFixture } from "@/features/places/place-fixtures";
import { postPageFixture, topicPageFixture } from "@/features/public-content/public-fixtures";
import { TopicDiscussion } from "./topic-discussion";
import {
  getTopicViewerState,
  markTopicRead,
  markTopicUnread,
  setTopicFollow,
} from "./forum-client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/features/auth/session-provider", () => ({
  useSession: () => ({
    status: "authenticated",
    user: { id: "01990000-7000-8000-8000-000000000301" },
  }),
}));
vi.mock("@/features/places/place-access", () => ({
  placeErrorMessage: (_cause: unknown, fallback: string) => fallback,
  usePlaceWorkspace: () => ({ context: { viewer: { permissions: ["forum.manage"] } } }),
}));
vi.mock("@/features/moderation/report-button", () => ({ ReportButton: () => <button type="button">Report</button> }));
vi.mock("@/features/public-content/rich-text", () => ({ RichText: () => <p>Post content</p> }));
vi.mock("./forum-editor", () => ({ ForumEditor: () => <div /> }));
vi.mock("./forum-client", () => ({
  createReply: vi.fn(),
  deletePost: vi.fn(),
  deleteTopic: vi.fn(),
  editPost: vi.fn(),
  getTopicViewerState: vi.fn(),
  listPostRevisions: vi.fn(),
  markTopicRead: vi.fn(),
  markTopicUnread: vi.fn(),
  setPostSave: vi.fn(),
  setReaction: vi.fn(),
  setTopicFollow: vi.fn(),
  setTopicLock: vi.fn(),
  setTopicPin: vi.fn(),
  setTopicSave: vi.fn(),
  updateTopic: vi.fn(),
}));

const viewerState = vi.mocked(getTopicViewerState);
const markRead = vi.mocked(markTopicRead);
const markUnread = vi.mocked(markTopicUnread);
const follow = vi.mocked(setTopicFollow);

describe("TopicDiscussion action state", () => {
  beforeEach(() => {
    const firstPost = postPageFixture.items[0]!;
    viewerState.mockReset().mockResolvedValue({
      isFollowing: true,
      isSaved: true,
      posts: [{ isSaved: true, postId: firstPost.id, reactions: ["like"] }],
    });
    markRead.mockReset().mockResolvedValue(undefined);
    markUnread.mockReset().mockResolvedValue(undefined);
    follow.mockReset().mockResolvedValue(undefined);
  });

  it("hydrates persisted states and visibly toggles read status", async () => {
    const user = userEvent.setup();
    const topic = topicPageFixture.items[0]!;
    const firstPost = postPageFixture.items[0]!;
    render(<TopicDiscussion initialPosts={{ items: [firstPost] }} initialTopic={topic} place={placeContractFixture} />);

    const topicActions = screen.getByRole("region", { name: "Topic actions" });
    const followingButton = await within(topicActions).findByRole("button", { name: "Following" });
    expect(followingButton).toHaveAttribute("aria-pressed", "true");
    expect(within(topicActions).getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true");
    expect(within(topicActions).getByTitle("Unpin topic")).toHaveAttribute("aria-pressed", "true");

    const post = screen.getByRole("article");
    await waitFor(() => expect(within(post).getByRole("button", { name: "like 7" })).toHaveAttribute("aria-pressed", "true"));
    expect(within(post).getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true");

    await user.click(within(topicActions).getByRole("button", { name: "Mark unread" }));
    expect(markUnread).toHaveBeenCalledWith(placeContractFixture.id, topic.id);
    expect(within(topicActions).getByRole("button", { name: "Unread" })).toHaveAttribute("aria-pressed", "true");

    await user.click(within(topicActions).getByRole("button", { name: "Unread" }));
    expect(markRead).toHaveBeenLastCalledWith(placeContractFixture.id, topic.id, firstPost.id);
    expect(within(topicActions).getByRole("button", { name: "Mark unread" })).toHaveAttribute("aria-pressed", "false");

    await user.click(followingButton);
    expect(follow).toHaveBeenCalledWith(placeContractFixture.id, topic.id, false);
    expect(within(topicActions).getByRole("button", { name: "Follow" })).toHaveAttribute("aria-pressed", "false");
  });
});