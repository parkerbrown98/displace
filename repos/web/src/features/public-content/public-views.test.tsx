import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { placeContractFixture } from "@/features/places/place-fixtures";
import { postPageFixture, publicIds, topicPageFixture } from "./public-fixtures";
import { RichText } from "./rich-text";
import { TopicView } from "./public-views";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/features/auth/session-provider", () => ({
  useSession: () => ({ status: "anonymous", user: null }),
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
    expect(screen.queryByText("deterministic previews")).not.toBeInTheDocument();
  });
});