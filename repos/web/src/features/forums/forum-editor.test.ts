import { describe, expect, it } from "vitest";
import { toForumDocument } from "./forum-editor";

describe("forum editor serialization", () => {
  it("emits only the server rich-text allowlist and normalizes mentions", () => {
    expect(toForumDocument({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2, ignored: true },
          content: [{ type: "text", text: "Welcome", marks: [{ type: "bold", attrs: { ignored: true } }] }],
        },
        {
          type: "paragraph",
          content: [
            { type: "mention", attrs: { handle: "Parker_B", label: "Parker" } },
            { type: "text", text: " hello", marks: [{ type: "link", attrs: { href: "https://example.com", target: "_blank" } }] },
          ],
        },
        { type: "horizontalRule" },
      ],
    })).toEqual({
      type: "doc",
      version: 1,
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Welcome", marks: [{ type: "bold" }] }] },
        { type: "paragraph", content: [
          { type: "mention", attrs: { handle: "parker_b" } },
          { type: "text", text: " hello", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
        ] },
      ],
    });
  });

  it("keeps only asset identifiers and bounded alt text for images", () => {
    const document = toForumDocument({
      type: "doc",
      content: [{
        type: "image",
        attrs: {
          alt: "a".repeat(600),
          assetId: "01994d2a-0f15-7a43-b655-57ec056886b5",
          src: "https://objects.example.test/private-key",
        },
      }],
    });

    expect(document.content).toEqual([{
      type: "image",
      attrs: {
        alt: "a".repeat(500),
        assetId: "01994d2a-0f15-7a43-b655-57ec056886b5",
      },
    }]);
    expect(JSON.stringify(document)).not.toContain("private-key");
  });
});
