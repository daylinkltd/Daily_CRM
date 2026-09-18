import { describe, expect, it } from "vitest";

import { isLegacyMedia, mediaHref } from "./urls";

describe("mediaHref", () => {
  it("routes durable files through the authenticated proxy", () => {
    expect(
      mediaHref({ id: "abc-123", storage_path: "ws/2026/file.pdf" }),
    ).toBe("/api/media/file?id=abc-123");
  });

  it("returns null for legacy rows instead of a link that 404s", () => {
    // These are the pre-migration uploads whose bytes died with the
    // container. A link that looks alive and isn't wastes the user's
    // time twice: once clicking, once reporting it.
    expect(mediaHref({ id: "x", local_path: "/uploads/Acme/quote.pdf" })).toBeNull();
    expect(isLegacyMedia({ id: "x", local_path: "/uploads/Acme/quote.pdf" })).toBe(true);
  });

  it("escapes ids into the query string", () => {
    expect(mediaHref({ id: "a b&c", storage_path: "k" })).toBe(
      "/api/media/file?id=a%20b%26c",
    );
  });
});
