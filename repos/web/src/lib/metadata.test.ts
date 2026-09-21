import { describe, expect, it } from "vitest";
import { createPublicMetadata, unavailableMetadata } from "./metadata";

describe("public metadata", () => {
  it("provides canonical and Open Graph metadata", () => {
    expect(createPublicMetadata({ description: "A place", path: "/places/example", title: "Example" })).toMatchObject({
      title: "Example",
      description: "A place",
      alternates: { canonical: "/places/example" },
      openGraph: { description: "A place", title: "Example", url: "/places/example" },
    });
  });

  it("keeps unavailable resources out of indexes", () => {
    expect(unavailableMetadata.robots).toEqual({ follow: false, index: false });
  });
});