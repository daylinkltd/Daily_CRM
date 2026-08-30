import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * The platform mailbox and a tenant's mailbox must never meet.
 *
 * `contact@daylink.in` is the PRODUCT speaking to its users — password
 * resets, sign-in codes, invitations, billing. A workspace's own
 * Outlook connection is that CUSTOMER speaking to their contacts, and
 * their marketing campaigns must never leave from our mailbox (nor be
 * billed to, rate-limited by, or reputation-linked to it).
 *
 * The boundary is which table each side reads:
 *   platform → platform_settings
 *   tenant   → workspace_integrations
 *
 * These tests fail if either side starts reading the other's config,
 * which is the cheap, mechanical way to keep the boundary honest.
 */
const root = join(process.cwd(), "src");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("platform mail never reads tenant configuration", () => {
  const platformFiles = [
    "lib/platform/mailer.ts",
    "lib/platform/email-codes.ts",
    "lib/saas-admin/messaging-config.ts",
  ];

  it("reads platform_settings and never workspace_integrations", () => {
    for (const f of platformFiles) {
      const src = read(f);
      expect(src, `${f} must not read tenant integration config`).not.toContain(
        "workspace_integrations",
      );
    }
  });

  it("loads its credentials from platform_settings", () => {
    expect(read("lib/saas-admin/messaging-config.ts")).toContain("platform_settings");
  });
});

describe("tenant mail never reads platform configuration", () => {
  const tenantFiles = ["lib/integrations/outlook.ts"];

  it("never reaches into platform_settings", () => {
    for (const f of tenantFiles) {
      expect(read(f), `${f} must not read platform config`).not.toContain(
        "platform_settings",
      );
    }
  });

  it("does not import the platform mailer", () => {
    for (const f of tenantFiles) {
      expect(read(f)).not.toContain("platform/mailer");
    }
  });
});

describe("every password reset leaves from the platform mailbox", () => {
  // Supabase's own mailer composes its own message and takes the
  // destination from the project's Site URL setting — the localhost
  // bug. Every reset path must mint the link and send it itself.
  const resetPaths = [
    "app/api/auth/reset-request/route.ts",
    "app/api/workspace/users/password/route.ts",
    "app/api/saas-admin/users/[id]/actions/route.ts",
  ];

  it("never calls Supabase's mailer", () => {
    for (const f of resetPaths) {
      const src = read(f);
      const calls = src
        .split("\n")
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
        .join("\n");
      expect(calls, `${f} must not use Supabase's mailer`).not.toContain(
        "auth.resetPasswordForEmail(",
      );
    }
  });

  it("sends through the platform mailer instead", () => {
    for (const f of resetPaths) {
      expect(read(f), `${f} should send via the platform mailbox`).toContain(
        "sendPlatformMail",
      );
    }
  });
});

/**
 * One home, named once.
 *
 * The app has moved host three times (dailycrm.cloud → dailybiz.in →
 * dailybuz.com) and each move left literals behind in places nobody
 * thought to grep — a docs page, a webhook fallback, an invite-link
 * default. `BRAND.appUrl` is the single answer; these fail if a
 * competing host is written into application code again.
 */
describe("no application code hardcodes a host", () => {
  const files = [
    "config/brand.ts",
    "app/api/account/invitations/route.ts",
    "app/api/admin/webhook-status/route.ts",
    "lib/whatsapp/webhook-subscribe.ts",
    "app/(dashboard)/docs/page.tsx",
  ];

  it("uses BRAND.appUrl rather than a literal host", () => {
    for (const f of files) {
      const src = read(f)
        .split("\n")
        // Comments may name an old host historically; code may not.
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
        .join("\n");
      expect(src, `${f} must not hardcode dailycrm.cloud`).not.toContain(
        "dailycrm.cloud",
      );
      expect(src, `${f} must not hardcode dailybiz.in`).not.toContain(
        "dailybiz.in",
      );
    }
  });

  it("keeps one canonical app URL", () => {
    expect(read("config/brand.ts")).toContain("appUrl: 'https://dailybuz.com'");
  });
});
