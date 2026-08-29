import { describe, expect, it } from "vitest";

import { isPlatformMailConfigured, wrapPlatformEmail } from "./mailer";
import { hashCode } from "./email-codes";

describe("isPlatformMailConfigured", () => {
  it("accepts a mailbox and password with no host — Office 365 is filled in", () => {
    // The whole point of the default: an operator supplies the mailbox
    // they actually have and nothing else.
    expect(
      isPlatformMailConfigured({
        smtp_user: "contact@daylink.in",
        smtp_pass: "secret",
      }),
    ).toBe(true);
  });

  it("refuses a mailbox with no password", () => {
    expect(isPlatformMailConfigured({ smtp_user: "contact@daylink.in" })).toBe(false);
  });

  it("refuses an empty config", () => {
    expect(isPlatformMailConfigured({})).toBe(false);
  });

  it("checks the Microsoft Graph fields when that provider is selected", () => {
    const partial = {
      email_provider: "microsoft",
      ms_tenant_id: "t",
      ms_client_id: "c",
      // secret missing
      ms_sender: "no-reply@example.com",
    };
    expect(isPlatformMailConfigured(partial)).toBe(false);
    expect(
      isPlatformMailConfigured({ ...partial, ms_client_secret: "s" }),
    ).toBe(true);
  });

  it("does not accept SMTP credentials as Microsoft credentials", () => {
    expect(
      isPlatformMailConfigured({
        email_provider: "microsoft",
        smtp_user: "contact@daylink.in",
        smtp_pass: "secret",
      }),
    ).toBe(false);
  });
});

describe("wrapPlatformEmail", () => {
  it("keeps the body and names the sender", () => {
    const html = wrapPlatformEmail("Reset your password", "<p>Click below.</p>");
    expect(html).toContain("<p>Click below.</p>");
    expect(html).toContain("Reset your password");
    // Inline styles only: these must render without a stylesheet.
    expect(html).not.toContain("<style");
    expect(html).not.toContain("class=");
  });
});

describe("hashCode", () => {
  it("is deterministic and hides the code", () => {
    const h = hashCode("123456");
    expect(h).toBe(hashCode("123456"));
    expect(h).not.toContain("123456");
    expect(h).toHaveLength(64);
  });

  it("separates codes that differ by one digit", () => {
    expect(hashCode("123456")).not.toBe(hashCode("123457"));
  });
});
