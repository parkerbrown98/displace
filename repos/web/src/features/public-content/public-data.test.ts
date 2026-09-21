import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicProfile, listPublicTopics, PublicResourceError } from "./public-data";

describe("public content data", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("forwards opaque cursors and filters with public cache policy", async () => {
    vi.stubEnv("WEB_DATA_SOURCE", "api");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await listPublicTopics("game-makers", {
      cursor: "opaque+/=",
      feed: "popular",
      forumId: "forum-id",
      tag: "devlog",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/places/game-makers/topics?cursor=opaque%2B%2F%3D&feed=popular&forumId=forum-id&tag=devlog",
      expect.objectContaining({
        cache: "force-cache",
        credentials: "omit",
        next: { revalidate: 60, tags: ["place:game-makers:topics"] },
      }),
    );
  });

  it("normalizes missing and unavailable public resources", async () => {
    vi.stubEnv("WEB_DATA_SOURCE", "api");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 404, title: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/problem+json" },
      }),
    ).mockRejectedValueOnce(new Error("offline")));

    await expect(listPublicTopics("missing")).rejects.toEqual(
      expect.objectContaining<Partial<PublicResourceError>>({ reason: "not-found" }),
    );
    await expect(listPublicTopics("game-makers")).rejects.toEqual(
      expect.objectContaining<Partial<PublicResourceError>>({ reason: "unavailable" }),
    );
  });

  it("filters deterministic fixtures and treats cursors as opaque", async () => {
    vi.stubEnv("WEB_DATA_SOURCE", "fixture");
    await expect(listPublicTopics("game-makers", { tag: "networking" })).resolves.toMatchObject({
      items: [{ title: "Rollback netcode: practical resources and tradeoffs" }],
    });
    await expect(listPublicTopics("game-makers", { cursor: "anything" })).resolves.toEqual({ items: [] });
  });

  it("does not substitute profile fixtures when API mode has no public profile operation", async () => {
    vi.stubEnv("WEB_DATA_SOURCE", "api");
    await expect(getPublicProfile("mara-v")).rejects.toEqual(
      expect.objectContaining<Partial<PublicResourceError>>({ reason: "unavailable" }),
    );
  });
});