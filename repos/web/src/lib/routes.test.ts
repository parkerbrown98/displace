import { describe, expect, it } from "vitest";
import { routes } from "./routes";

describe("application routes", () => {
  it("builds stable place-scoped URLs", () => {
    expect(routes.place("game-makers")).toBe("/places/game-makers");
    expect(routes.forum("game-makers", "engineering")).toBe(
      "/places/game-makers/forums/engineering",
    );
    expect(routes.topic("game-makers", "weekly-thread")).toBe(
      "/places/game-makers/topics/weekly-thread",
    );
    expect(routes.live("game-makers")).toBe("/places/game-makers/live");
    expect(routes.chat("game-makers", "general")).toBe(
      "/places/game-makers/chat/general",
    );
  });
});