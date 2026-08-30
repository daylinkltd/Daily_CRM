import { describe, expect, it } from "vitest";

import { buildFromHeader, explainSmtpError, htmlToPlainText } from "./messaging";

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

/**
 * Regression: `PLATFORM_SMTP_FROM="Dailybuz" <contact@daylink.in>` in an
 * env file arrives as just `Dailybuz` — the parser stops at the closing
 * quote. That was being handed to SMTP as the From header, which has no
 * mailbox in it at all.
 */
describe("buildFromHeader", () => {
  const BOX = "contact@daylink.in";

  it("pairs a bare display name with the authenticated mailbox", () => {
    expect(buildFromHeader("Dailybuz", BOX)).toBe('"Dailybuz" <contact@daylink.in>');
  });

  it("leaves a complete address alone", () => {
    expect(buildFromHeader('"Support" <help@x.com>', BOX)).toBe('"Support" <help@x.com>');
    expect(buildFromHeader("help@x.com", BOX)).toBe("help@x.com");
  });

  it("falls back to the brand name when nothing is set", () => {
    expect(buildFromHeader(undefined, BOX)).toBe('"Dailybuz" <contact@daylink.in>');
    expect(buildFromHeader("   ", BOX)).toBe('"Dailybuz" <contact@daylink.in>');
  });

  it("does not double-quote a name that already carries quotes", () => {
    expect(buildFromHeader('"Dailybuz"', BOX)).toBe('"Dailybuz" <contact@daylink.in>');
  });

  it("always produces a header containing a mailbox", () => {
    for (const input of ["Dailybuz", '"X"', undefined, "", "  ", "Some Name"]) {
      expect(buildFromHeader(input, BOX)).toContain("@");
    }
  });
});

describe("explainSmtpError", () => {
  it("turns a 535 into the fix rather than the symptom", () => {
    const out = explainSmtpError("Invalid login: 535 5.7.3 Authentication unsuccessful");
    expect(out).toContain("535 5.7.3");
    expect(out).toMatch(/SMTP AUTH|Authenticated SMTP/);
    expect(out).toContain("Graph");
  });

  it("names the mailbox-permission case separately", () => {
    expect(explainSmtpError("550 5.7.60 Client does not have permissions to send as this sender"))
      .toContain("From address");
  });

  it("distinguishes a network failure from an auth failure", () => {
    const out = explainSmtpError("connect ETIMEDOUT 52.96.0.1:587");
    expect(out).toContain("host and port");
    expect(out).not.toContain("SMTP AUTH");
  });

  it("passes an unrecognised error through unchanged", () => {
    expect(explainSmtpError("something odd happened")).toBe("something odd happened");
  });
});
