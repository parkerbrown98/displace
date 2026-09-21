import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicProfile, listPublicTopics, PublicResourceError, searchPublicContent } from "./public-data";

describe("public content data", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("forwards opaque cursors and filters with public cache policy", async () => {
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

  it("loads public profiles from the API", async () => {
    const profile = {
      displayName: "Mara V.",
      handle: "mara_v",
      joinedAt: "2024-02-12T00:00:00.000Z",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(profile), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPublicProfile("mara_v")).resolves.toEqual(profile);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/profiles/mara_v",
      expect.objectContaining({
        credentials: "omit",
        next: { revalidate: 60, tags: ["profile:mara_v"] },
      }),
    );
  });

  it("forwards search filters without caching eventually consistent results", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await searchPublicContent({
      cursor: "signed-cursor",
      placeId: "018f8dd0-5d14-7f9d-93f7-9bf1b39ebd9e",
      query: "deterministic previews",
      type: "topic",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/search?cursor=signed-cursor&placeId=018f8dd0-5d14-7f9d-93f7-9bf1b39ebd9e&q=deterministic+previews&type=topic",
      expect.objectContaining({ cache: "no-store", credentials: "omit" }),
    );
  });
});