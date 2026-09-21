import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { browserMutation, browserRead } from "./browser";
import { withCursor } from "./request";
import { mockServer } from "@/test/mocks/server";

describe("API request boundary", () => {
  it("sends browser credentials and centralized mutation headers", async () => {
    mockServer.use(
      http.post("http://localhost:3001/api/v1/topics", async ({ request }) => {
        expect(request.credentials).toBe("include");
        expect(request.headers.get("X-CSRF-Token")).toBe("csrf-token");
        expect(request.headers.get("Idempotency-Key")).toBe("command-id");
        expect(request.headers.get("X-Request-Id")).toBe("request-id");
        expect(await request.json()).toEqual({ title: "A topic" });
        return HttpResponse.json({ id: "topic-id" }, { status: 201 });
      }),
    );

    await expect(
      browserMutation<{ id: string }>("/topics", {
        method: "POST",
        body: { title: "A topic" },
        csrfToken: "csrf-token",
        idempotencyKey: "command-id",
        requestId: "request-id",
      }),
    ).resolves.toEqual({ id: "topic-id" });
  });

  it("normalizes RFC 9457 failures", async () => {
    mockServer.use(
      http.get("http://localhost:3001/api/v1/private", () =>
        HttpResponse.json(
          { title: "Forbidden", status: 403, detail: "Membership is required." },
          { status: 403, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    await expect(browserRead("/private")).rejects.toMatchObject({
      problem: { title: "Forbidden", status: 403, detail: "Membership is required." },
    });
  });

  it("keeps opaque cursors intact", () => {
    expect(withCursor("/topics", "opaque+/=", { feed: "latest" })).toBe(
      "/topics?cursor=opaque%2B%2F%3D&feed=latest",
    );
  });
});