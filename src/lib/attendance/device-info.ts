/**
 * Device fingerprint captured alongside an attendance punch.
 *
 * WHAT A BROWSER CANNOT GIVE YOU — this is not a limitation of this code:
 *   * MAC address. No browser exposes it to JavaScript at all. It was
 *     removed as a fingerprinting vector years ago and there is no
 *     permission that unlocks it. Only a native app or an MDM agent on
 *     the device can read one.
 *   * Device serial number, IMEI, or a stable hardware ID.
 *   * The real local IP. WebRTC used to leak it; every current browser
 *     now returns an mDNS placeholder (a random .local hostname).
 *
 * So the public IP is resolved server-side from the request headers,
 * where it is trustworthy-ish, rather than asked of the client. Everything
 * below is self-reported by the browser and a determined user can spoof
 * it — treat it as corroborating detail, not proof.
 */

export interface DeviceInfo {
  /** Raw UA string, kept verbatim for forensics. */
  user_agent: string;
  /** "Mobile" | "Tablet" | "Desktop" — best-effort. */
  device_type: string;
  /** Marketing OS name and version where the platform reports it. */
  os: string;
  browser: string;
  /** Physical screen, useful for spotting an emulator or a shared kiosk. */
  screen: string;
  viewport: string;
  device_pixel_ratio: number | null;
  /** IANA zone, e.g. "Asia/Kolkata". A mismatch with the GPS fix is a flag. */
  timezone: string;
  /** Minutes offset from UTC at capture time. */
  timezone_offset_minutes: number;
  language: string;
  /** Logical CPU cores and rough RAM, where exposed. */
  hardware_concurrency: number | null;
  device_memory_gb: number | null;
  /** True when the browser reports a touchscreen. */
  touch_capable: boolean;
  /** Connection type from the Network Information API, where supported. */
  network_type: string | null;
  /** Set only when the platform actually reports it (Chromium). */
  platform_brand: string | null;
  captured_at: string;
}

interface UADataBrand {
  brand: string;
  version: string;
}

interface NavigatorUAData {
  brands?: UADataBrand[];
  mobile?: boolean;
  platform?: string;
}

/** Coarse device class from the UA string, with UA-CH preferred. */
function detectDeviceType(ua: string, uaData?: NavigatorUAData): string {
  if (uaData && typeof uaData.mobile === "boolean") {
    if (uaData.mobile) return "Mobile";
  }
  if (/\b(iPad|Tablet)\b/i.test(ua)) return "Tablet";
  // iPadOS 13+ reports itself as a Mac; the touch check disambiguates.
  if (
    /Macintosh/.test(ua) &&
    typeof navigator !== "undefined" &&
    navigator.maxTouchPoints > 1
  ) {
    return "Tablet";
  }
  if (/\b(Mobi|Android|iPhone|iPod)\b/i.test(ua)) return "Mobile";
  return "Desktop";
}

function detectOs(ua: string, uaData?: NavigatorUAData): string {
  if (uaData?.platform) return uaData.platform;
  const patterns: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
    [/Windows NT ([\d.]+)/, (m) => `Windows ${({ "10.0": "10/11", "6.3": "8.1", "6.2": "8", "6.1": "7" } as Record<string, string>)[m[1]] || m[1]}`],
    [/Android ([\d.]+)/, (m) => `Android ${m[1]}`],
    [/iPhone OS ([\d_]+)/, (m) => `iOS ${m[1].replace(/_/g, ".")}`],
    [/CPU OS ([\d_]+)/, (m) => `iPadOS ${m[1].replace(/_/g, ".")}`],
    [/Mac OS X ([\d_]+)/, (m) => `macOS ${m[1].replace(/_/g, ".")}`],
    [/CrOS \S+ ([\d.]+)/, (m) => `ChromeOS ${m[1]}`],
    [/Linux/, () => "Linux"],
  ];
  for (const [re, fmt] of patterns) {
    const m = ua.match(re);
    if (m) return fmt(m);
  }
  return "Unknown";
}

function detectBrowser(ua: string, uaData?: NavigatorUAData): string {
  // UA-CH brands are the reliable source on Chromium; skip the
  // deliberate "Not)A;Brand" padding entries.
  const brands = (uaData?.brands || []).filter(
    (b) => !/not.?a.?brand/i.test(b.brand)
  );
  if (brands.length > 0) {
    const preferred =
      brands.find((b) => !/chromium/i.test(b.brand)) || brands[0];
    return `${preferred.brand} ${preferred.version}`;
  }

  // Order matters: Edge and Opera both contain "Chrome", Chrome contains
  // "Safari".
  const patterns: Array<[RegExp, string]> = [
    [/Edg(?:e|A|iOS)?\/([\d.]+)/, "Edge"],
    [/OPR\/([\d.]+)/, "Opera"],
    [/SamsungBrowser\/([\d.]+)/, "Samsung Internet"],
    [/Firefox\/([\d.]+)/, "Firefox"],
    [/Chrome\/([\d.]+)/, "Chrome"],
    [/Version\/([\d.]+).*Safari/, "Safari"],
  ];
  for (const [re, name] of patterns) {
    const m = ua.match(re);
    if (m) return `${name} ${m[1]}`;
  }
  return "Unknown";
}

/**
 * Collect what the browser will tell us about this device. Safe to call
 * on the server (returns a marked-unavailable record).
 */
export function collectDeviceInfo(): DeviceInfo {
  const capturedAt = new Date().toISOString();

  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return {
      user_agent: "unavailable",
      device_type: "Unknown",
      os: "Unknown",
      browser: "Unknown",
      screen: "unknown",
      viewport: "unknown",
      device_pixel_ratio: null,
      timezone: "unknown",
      timezone_offset_minutes: 0,
      language: "unknown",
      hardware_concurrency: null,
      device_memory_gb: null,
      touch_capable: false,
      network_type: null,
      platform_brand: null,
      captured_at: capturedAt,
    };
  }

  const nav = navigator as Navigator & {
    userAgentData?: NavigatorUAData;
    deviceMemory?: number;
    connection?: { effectiveType?: string; type?: string };
  };
  const ua = nav.userAgent || "";
  const uaData = nav.userAgentData;

  return {
    user_agent: ua,
    device_type: detectDeviceType(ua, uaData),
    os: detectOs(ua, uaData),
    browser: detectBrowser(ua, uaData),
    screen: `${window.screen?.width ?? 0}x${window.screen?.height ?? 0}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    device_pixel_ratio: window.devicePixelRatio ?? null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
    // Negated because getTimezoneOffset() is minutes *behind* UTC.
    timezone_offset_minutes: -new Date().getTimezoneOffset(),
    language: nav.language || "unknown",
    hardware_concurrency: nav.hardwareConcurrency ?? null,
    device_memory_gb: nav.deviceMemory ?? null,
    touch_capable: (nav.maxTouchPoints ?? 0) > 0 || "ontouchstart" in window,
    network_type: nav.connection?.effectiveType || nav.connection?.type || null,
    platform_brand: uaData?.platform || null,
    captured_at: capturedAt,
  };
}

/** One-line summary for a table cell or a tooltip. */
export function describeDevice(info: Partial<DeviceInfo> | null | undefined): string {
  if (!info) return "No device details recorded";
  const parts = [info.device_type, info.os, info.browser].filter(
    (p): p is string => Boolean(p) && p !== "Unknown"
  );
  return parts.length > 0 ? parts.join(" · ") : "Unknown device";
}
