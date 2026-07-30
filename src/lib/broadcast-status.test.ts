import { describe, expect, it } from "vitest";
import {
  broadcastStatusConfig,
  getBroadcastStatus,
  getRecipientStatus,
  recipientStatusConfig,
} from "./broadcast-status";

describe("getBroadcastStatus", () => {
  it("returns the matching config for known statuses", () => {
    expect(getBroadcastStatus("sending")).toBe(broadcastStatusConfig.sending);
    expect(getBroadcastStatus("sent")).toBe(broadcastStatusConfig.sent);
    expect(getBroadcastStatus("failed")).toBe(broadcastStatusConfig.failed);
  });

  it("flags `sending` as a live/pulsing state", () => {
    expect(getBroadcastStatus("sending").pulse).toBe(true);
    expect(getBroadcastStatus("sent").pulse).toBeFalsy();
  });

  it("falls back to draft on an unknown status string", () => {
    expect(getBroadcastStatus("not-a-real-status")).toBe(
      broadcastStatusConfig.draft,
    );
    expect(getBroadcastStatus("")).toBe(broadcastStatusConfig.draft);
  });

  it("each variant has the dark-theme class triple", () => {
    // A colour is a palette step (blue-500), an arbitrary hex
    // (\[#00aef0\]) or a semantic design token (muted, border,
    // muted-foreground). All three are in use.
    const COLOR = String.raw`(?:[a-z]+-\d+|\[#[0-9a-fA-F]{3,8}\]|[a-z]+(?:-[a-z]+)*)`;
    for (const v of Object.values(broadcastStatusConfig)) {
      expect(v.classes).toMatch(new RegExp(String.raw`bg-${COLOR}/10`));
      expect(v.classes).toMatch(new RegExp(String.raw`text-${COLOR}`));
      expect(v.classes).toMatch(new RegExp(String.raw`border-${COLOR}/20`));
    }
  });
});

describe("getRecipientStatus", () => {
  it("returns the matching config for known statuses", () => {
    expect(getRecipientStatus("delivered")).toBe(
      recipientStatusConfig.delivered,
    );
    expect(getRecipientStatus("read")).toBe(recipientStatusConfig.read);
  });

  it("falls back to pending on an unknown status string", () => {
    expect(getRecipientStatus("???")).toBe(recipientStatusConfig.pending);
  });
});
