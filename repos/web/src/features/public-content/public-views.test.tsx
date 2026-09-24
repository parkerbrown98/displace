import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { placeContractFixture } from "@/features/places/place-fixtures";
import { postPageFixture, publicIds, topicPageFixture } from "./public-fixtures";
import { RichText } from "./rich-text";
import { TopicView } from "./public-views";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));
const sessionState = vi.hoisted(() => ({ authenticated: false }));

vi.mock("@/features/auth/session-provider", () => ({
  useSession: () => sessionState.authenticated
    ? { status: "authenticated", user: { id: "01990000-7000-8000-8000-000000000301" } }
    : { status: "anonymous", user: null },
}));

describe("public content rendering", () => {
  it("renders only allowlisted rich-text nodes and safe links", () => {
    const { container } = render(
      <RichText document={{
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Safe", marks: [{ type: "bold" }] },
              { type: "text", text: " blocked", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
              { type: "script", text: "never rendered" },
            ],
          },
        ],
      }} />,
    );

    expect(screen.getByText("Safe").tagName).toBe("STRONG");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent("never rendered");
  });

  it("renders inaccessible media as an alt-text fallback", () => {
    render(<RichText document={{
      type: "doc",
      version: 1,
      content: [{ type: "image", attrs: { alt: "Meeting notes diagram", assetId: "asset-id" } }],
    }} />);

    expect(screen.getByText("Meeting notes diagram")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders deleted posts as content-free tombstones", () => {
    const deletedPost = postPageFixture.items[1]!;
    render(
      <TopicView
        place={placeContractFixture}
        posts={{ items: [deletedPost] }}
        topic={topicPageFixture.items.find((topic) => topic.id === publicIds.weeklyTopic)!}
      />,
    );

    expect(screen.getByText("This post was removed.")).toBeInTheDocument();
    expect(screen.getByText("3 members")).toBeInTheDocument();
    expect(screen.queryByText("deterministic previews")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in to join" })).not.toBeInTheDocument();
  });

  it("renders a post author's public profile summary", () => {
    const post = postPageFixture.items[0]!;
    render(
      <TopicView
        place={placeContractFixture}
        posts={{ items: [post] }}
        topic={topicPageFixture.items.find((topic) => topic.id === publicIds.weeklyTopic)!}
      />,
    );

    expect(screen.getByRole("link", { name: post.author.displayName })).toHaveAttribute("href", `/members/${post.author.handle}`);
    expect(screen.getByText(`@${post.author.handle}`)).toBeInTheDocument();
    expect(screen.getByText(/Joined/)).toBeInTheDocument();
  });

  it("keeps authenticated topic controls inside the heading card", () => {
    sessionState.authenticated = true;
    const topic = topicPageFixture.items.find((item) => item.id === publicIds.weeklyTopic)!;
    render(<TopicView place={placeContractFixture} posts={postPageFixture} topic={topic} />);

    const headingCard = screen.getByRole("heading", { name: topic.title }).closest("header");
    expect(headingCard).not.toBeNull();
    expect(within(headingCard!).getByRole("region", { name: "Topic actions" })).toBeInTheDocument();
    const deleteButton = within(headingCard!).getByTitle("Delete topic");
    expect(deleteButton).toHaveClass("icon-button", "destructive-icon-button");
    expect(deleteButton.querySelector("svg")).not.toBeNull();
    sessionState.authenticated = false;
  });
});