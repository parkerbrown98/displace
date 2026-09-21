import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommunityHome } from "./community-home";
import { createCommunityFixture } from "./community-fixtures";

describe("CommunityHome", () => {
  it("renders fixture topics as stable application routes", () => {
    render(<CommunityHome fixture={createCommunityFixture()} />);

    expect(screen.getByRole("heading", { name: "Game Makers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "What are you building this week?" })).toHaveAttribute(
      "href",
      "/places/game-makers/topics/what-are-you-building-this-week",
    );
  });

  it("renders an accessible empty state", () => {
    render(<CommunityHome fixture={createCommunityFixture("empty")} />);
    expect(screen.getByRole("status")).toHaveTextContent("No discussions yet");
  });
});