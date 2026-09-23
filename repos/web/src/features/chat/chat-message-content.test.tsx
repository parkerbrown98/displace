import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatMessageContent } from "./chat-message-content";

describe("ChatMessageContent", () => {
  it("linkifies safe web URLs without including trailing punctuation", () => {
    render(<ChatMessageContent body="Read https://example.test/notes, then reply." />);

    expect(screen.getByRole("link", { name: "https://example.test/notes" })).toHaveAttribute("href", "https://example.test/notes");
    expect(screen.getByText(/, then reply\./)).toBeInTheDocument();
  });

  it("lazily embeds direct image and GIF links in square previews", () => {
    const { container } = render(<ChatMessageContent body="https://images.example.test/photo.webp https://images.example.test/reaction.gif" />);

    const images = [...container.querySelectorAll("img")];
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("loading", "lazy");
    expect(images[0]).toHaveAttribute("src", "https://images.example.test/photo.webp");
    expect(images[1]).toHaveAttribute("src", "https://images.example.test/reaction.gif");
  });

  it("renders a metadata-style fallback card for non-image links", () => {
    render(<ChatMessageContent body="See https://example.test/projects/displace" />);

    const card = screen.getByRole("link", { name: /example\.testdisplace/i });
    expect(card).toHaveClass("chat-link-card");
    expect(card).toHaveAttribute("target", "_blank");
  });
});
