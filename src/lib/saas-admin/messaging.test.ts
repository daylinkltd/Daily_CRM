import { describe, expect, it } from "vitest";

import { htmlToPlainText } from "./messaging";

/**
 * Regression: the SMTP path passed the HTML body as `text`, so every
 * password reset and sign-in code arrived as visible markup —
 * `<div style="...">` and all. It now sends `html`, with this as the
 * plain-text alternative.
 */
describe("htmlToPlainText", () => {
  it("keeps a link's destination, which a text-only client still needs", () => {
    const out = htmlToPlainText(
      '<p>Reset it:</p><a href="https://dailybuz.com/reset?t=abc">Choose a new password</a>',
    );
    expect(out).toContain("https://dailybuz.com/reset?t=abc");
    expect(out).toContain("Choose a new password");
  });

  it("strips tags rather than shipping them to the reader", () => {
    const out = htmlToPlainText('<div style="color:red"><p>Hello</p></div>');
    expect(out).toBe("Hello");
    expect(out).not.toContain("<");
    expect(out).not.toContain("style");
  });

  it("keeps a six-digit code readable", () => {
    const out = htmlToPlainText(
      '<p>Use this code.</p><p><span style="font-size:28px">418302</span></p>',
    );
    expect(out).toContain("418302");
  });

  it("turns block ends into line breaks, collapsing runs to one blank", () => {
    // A single blank line survives on purpose: it is what separates
    // paragraphs once the markup is gone.
    const out = htmlToPlainText("<p>One</p><p>Two</p><br/><br/><p>Three</p>");
    expect(out).toBe("One\nTwo\n\nThree");
    expect(out).not.toContain("\n\n\n");
  });

  it("decodes the entities these emails actually use", () => {
    expect(htmlToPlainText("<p>Tom &amp; Jerry</p>")).toBe("Tom & Jerry");
    expect(htmlToPlainText("<p>&#8377;799</p>")).toBe("₹799");
  });

  it("survives an empty body", () => {
    expect(htmlToPlainText("")).toBe("");
  });
});
