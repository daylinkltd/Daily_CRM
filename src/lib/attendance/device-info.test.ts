import { describe, it, expect, afterEach, vi } from "vitest";
import { collectDeviceInfo, describeDevice } from "./device-info";

const UA = {
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  windowsEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
  macFirefox:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7; rv:121.0) Gecko/20100101 Firefox/121.0",
};

/** Install a minimal browser-like global environment. */
function stubBrowser(userAgent: string, extra: Record<string, unknown> = {}) {
  vi.stubGlobal("navigator", {
    userAgent,
    language: "en-GB",
    hardwareConcurrency: 8,
    maxTouchPoints: 0,
    ...extra,
  });
  vi.stubGlobal("window", {
    screen: { width: 1920, height: 1080 },
    innerWidth: 1440,
    innerHeight: 900,
    devicePixelRatio: 2,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("collectDeviceInfo", () => {
  it("identifies an Android phone on Chrome", () => {
    stubBrowser(UA.androidChrome, { maxTouchPoints: 5 });
    const info = collectDeviceInfo();
    expect(info.device_type).toBe("Mobile");
    expect(info.os).toBe("Android 14");
    expect(info.browser).toBe("Chrome 120.0.0.0");
    expect(info.touch_capable).toBe(true);
  });

  it("identifies an iPhone on Safari", () => {
    stubBrowser(UA.iphoneSafari, { maxTouchPoints: 5 });
    const info = collectDeviceInfo();
    expect(info.device_type).toBe("Mobile");
    expect(info.os).toBe("iOS 17.2");
    expect(info.browser).toBe("Safari 17.2");
  });

  it("picks Edge over Chrome, which the Edge UA also contains", () => {
    stubBrowser(UA.windowsEdge);
    const info = collectDeviceInfo();
    expect(info.browser).toBe("Edge 120.0.0.0");
    expect(info.os).toBe("Windows 10/11");
    expect(info.device_type).toBe("Desktop");
  });

  it("identifies Firefox on macOS", () => {
    stubBrowser(UA.macFirefox);
    const info = collectDeviceInfo();
    expect(info.browser).toBe("Firefox 121.0");
    expect(info.os).toBe("macOS 10.15.7");
  });

  it("treats a touch-capable Mac UA as a tablet (iPadOS reports as Mac)", () => {
    stubBrowser(UA.macFirefox, { maxTouchPoints: 5 });
    expect(collectDeviceInfo().device_type).toBe("Tablet");
  });

  it("prefers User-Agent Client Hints when present", () => {
    stubBrowser(UA.windowsEdge, {
      userAgentData: {
        brands: [
          { brand: "Not)A;Brand", version: "99" },
          { brand: "Chromium", version: "120" },
          { brand: "Microsoft Edge", version: "120" },
        ],
        mobile: false,
        platform: "Windows",
      },
    });
    const info = collectDeviceInfo();
    // The padding brand must be ignored and the real vendor preferred
    // over the generic Chromium entry.
    expect(info.browser).toBe("Microsoft Edge 120");
    expect(info.os).toBe("Windows");
  });

  it("records screen and viewport separately", () => {
    stubBrowser(UA.windowsEdge);
    const info = collectDeviceInfo();
    expect(info.screen).toBe("1920x1080");
    expect(info.viewport).toBe("1440x900");
  });

  it("returns a marked-unavailable record on the server", () => {
    // No navigator/window stubbed: simulates SSR.
    vi.stubGlobal("navigator", undefined);
    vi.stubGlobal("window", undefined);
    const info = collectDeviceInfo();
    expect(info.user_agent).toBe("unavailable");
    expect(info.device_type).toBe("Unknown");
    expect(info.captured_at).toBeTruthy();
  });

  it("never reports a MAC address — browsers cannot provide one", () => {
    stubBrowser(UA.androidChrome);
    expect(Object.keys(collectDeviceInfo())).not.toContain("mac_address");
  });
});

describe("describeDevice", () => {
  it("joins the known parts", () => {
    expect(describeDevice({ device_type: "Mobile", os: "Android 14", browser: "Chrome 120" })).toBe(
      "Mobile · Android 14 · Chrome 120"
    );
  });

  it("omits unknown parts rather than printing 'Unknown'", () => {
    expect(describeDevice({ device_type: "Desktop", os: "Unknown", browser: "Firefox 121" })).toBe(
      "Desktop · Firefox 121"
    );
  });

  it("handles a missing record", () => {
    expect(describeDevice(null)).toBe("No device details recorded");
    expect(describeDevice({})).toBe("Unknown device");
  });
});
