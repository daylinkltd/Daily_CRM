import { describe, expect, it } from "vitest";

import {
  buildFromHeader,
  explainGraphError,
  explainSmtpError,
  graphSendMailPayload,
  htmlToPlainText,
} from "./messaging";

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

/**
 * The shared-mailbox case, which is what daylink.in actually uses: an
 * unlicensed shared mailbox cannot sign in, so SMTP must authenticate
 * as a licensed user and send AS the shared address. Graph sends from
 * it directly.
 */
describe("sending as a shared mailbox over SMTP", () => {
  it("keeps the shared address as From while logging in as someone else", () => {
    // Auth as the licensed user, send as the shared mailbox.
    expect(buildFromHeader("contact@daylink.in", "swaraj@daylink.in")).toBe(
      "contact@daylink.in",
    );
    expect(buildFromHeader('"Dailybuz" <contact@daylink.in>', "swaraj@daylink.in")).toBe(
      '"Dailybuz" <contact@daylink.in>',
    );
  });

  it("only falls back to the login when no From address is given", () => {
    expect(buildFromHeader(undefined, "swaraj@daylink.in")).toContain("swaraj@daylink.in");
  });
});

describe("explainGraphError", () => {
  it("explains the invalid-sender case that blocked the first attempt", () => {
    const out = explainGraphError(
      "The requested user 'hello@dailybuz.com' is invalid.",
      "hello@dailybuz.com",
    );
    expect(out).toContain("not a mailbox in this tenant");
    expect(out).toContain("shared mailbox");
  });

  it("distinguishes a permission problem from a missing mailbox", () => {
    const out = explainGraphError("Access is denied. Check credentials and try again.");
    expect(out).toContain("APPLICATION permission Mail.Send");
    expect(out).not.toContain("not a mailbox in this tenant");
  });

  it("passes an unrecognised message through", () => {
    expect(explainGraphError("some other graph error")).toBe("some other graph error");
  });
});

/**
 * The tenant switched SMTP AUTH off globally:
 *   535 5.7.139 ... SmtpClientAuthentication is disabled for the Tenant
 * Nearly the same string as the per-mailbox refusal, but no per-user
 * setting can fix it — sending people to "Manage email apps" would
 * waste their time.
 */
describe("explainSmtpError — tenant-wide vs per-mailbox", () => {
  const TENANT =
    "Invalid login: 535 5.7.139 Authentication unsuccessful, SmtpClientAuthentication is disabled for the Tenant.";

  it("says tenant-wide, and does not send anyone to a per-user setting", () => {
    const out = explainSmtpError(TENANT);
    expect(out).toContain("WHOLE TENANT");
    expect(out).toContain("Graph");
    expect(out).not.toContain("Manage email apps");
  });

  it("still gives the per-mailbox advice when the tenant is not implicated", () => {
    const out = explainSmtpError("535 5.7.139 Authentication unsuccessful, basic authentication is disabled");
    expect(out).toContain("Manage email apps");
    expect(out).not.toContain("WHOLE TENANT");
  });
});

/**
 * Regression, and the exact twin of the SMTP one above: the SMTP path
 * was fixed to send `html`, but the Graph path still declared its body
 * as Text. The first email Graph ever delivered arrived showing its own
 * markup — `<div style="margin:0;padding:24px;...">` — because Outlook
 * was told, truthfully, that this was plain text.
 *
 * Graph carries ONE body, so this is the only place the content type
 * can be right.
 */
describe("graphSendMailPayload", () => {
  const BODY = '<div style="padding:24px;"><h1>Platform email is working</h1></div>';

  it("declares the body as HTML, so Outlook renders it instead of printing it", () => {
    const payload = graphSendMailPayload({
      to: "someone@example.com",
      subject: "Test",
      body: BODY,
    });
    expect(payload.message.body.contentType).toBe("HTML");
    expect(payload.message.body.contentType).not.toBe("Text");
  });

  it("sends the body through untouched — the wrapper's inline styles must survive", () => {
    const payload = graphSendMailPayload({ to: "a@b.com", subject: "S", body: BODY });
    expect(payload.message.body.content).toBe(BODY);
  });

  it("addresses the single recipient and keeps a copy in Sent Items", () => {
    const payload = graphSendMailPayload({ to: "a@b.com", subject: "S", body: BODY });
    expect(payload.message.toRecipients).toEqual([{ emailAddress: { address: "a@b.com" } }]);
    expect(payload.saveToSentItems).toBe(true);
  });
});
