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
});
