/**
 * Precise geolocation capture for attendance punches.
 *
 * WHY THIS EXISTS: `getCurrentPosition` returns whatever fix the platform
 * has cheapest to hand. Indoors, or on a fresh page load, that is almost
 * always the wifi/IP-derived fix — which resolves to the nearest large
 * city (a user in Rabkavi gets Bengaluru, ~400km away) with an accuracy
 * radius in the tens of thousands of metres. The old punch flow asked for
 * one position, swallowed every failure with `.catch(() => null)`, and
 * stored `null`, so no punch ever recorded a location at all.
 *
 * The GPS radio needs a few seconds to get a satellite fix. So instead of
 * a single shot we watch the position stream and keep the best fix seen,
 * returning as soon as one is accurate enough (or when time runs out).
 */

export interface PreciseLocation {
  latitude: number;
  longitude: number;
  /** Radius of 68% confidence, in metres, as reported by the platform. */
  accuracy: number;
  /** Milliseconds spent acquiring the fix. */
  elapsedMs: number;
  /** True when the fix never reached the requested accuracy. */
  coarse: boolean;
  capturedAt: string;
}

export type GeolocationFailureReason =
  | "unsupported"
  | "insecure_context"
  | "permission_denied"
  | "position_unavailable"
  | "timeout";

export class GeolocationFailure extends Error {
  readonly reason: GeolocationFailureReason;

  constructor(reason: GeolocationFailureReason, message: string) {
    super(message);
    this.name = "GeolocationFailure";
    this.reason = reason;
  }
}

/** User-facing copy for each failure, with the action that resolves it. */
export const GEOLOCATION_FAILURE_MESSAGES: Record<GeolocationFailureReason, string> = {
  unsupported: "This browser cannot provide location. Use a modern browser to punch in.",
  insecure_context:
    "Location needs a secure (HTTPS) connection. Open the app over HTTPS to punch in.",
  permission_denied:
    "Location permission is blocked. Allow location for this site in your browser settings, then punch in again.",
  position_unavailable:
    "Your device could not get a location fix. Move somewhere with a clearer view of the sky and try again.",
  timeout:
    "Timed out waiting for a GPS fix. Check that location is switched on, then try again.",
};

export type GeolocationPermissionState = "granted" | "prompt" | "denied" | "unknown";

/**
 * Read the geolocation permission WITHOUT triggering a prompt.
 *
 * This matters because of how browsers behave after a refusal: calling
 * `getCurrentPosition` when permission is already "denied" fails
 * immediately and shows no prompt at all — the browser will not ask
 * again. From the user's side it looks like the app silently ignored
 * them. Knowing the state up front lets the UI explain how to re-enable
 * it in site settings instead of pretending a prompt is coming.
 *
 * The Permissions API is unavailable on older Safari, hence "unknown",
 * which callers should treat as "just try it".
 */
export async function getGeolocationPermission(): Promise<GeolocationPermissionState> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return "unknown";
  }
  try {
    const status = await navigator.permissions.query({
      name: "geolocation" as PermissionName,
    });
    return status.state as GeolocationPermissionState;
  } catch {
    return "unknown";
  }
}

export interface AcquireOptions {
  /** Stop as soon as a fix is at least this accurate. Metres. */
  desiredAccuracyM?: number;
  /** Give up after this long and return the best fix seen. Milliseconds. */
  timeoutMs?: number;
  /** Injectable for tests. */
  geolocation?: Geolocation;
  now?: () => number;
}

const DEFAULT_DESIRED_ACCURACY_M = 50;
const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Acquire the most accurate position the device can produce within the
 * time budget.
 *
 * Resolves with the best fix seen — `coarse: true` if it never met
 * `desiredAccuracyM`, so the caller can decide whether to accept it.
 * Rejects with a `GeolocationFailure` only when no fix was obtained at all.
 */
export function acquirePreciseLocation(
  options: AcquireOptions = {}
): Promise<PreciseLocation> {
  const {
    desiredAccuracyM = DEFAULT_DESIRED_ACCURACY_M,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    now = () => Date.now(),
  } = options;

  const geo =
    options.geolocation ??
    (typeof navigator !== "undefined" ? navigator.geolocation : undefined);

  if (!geo) {
    return Promise.reject(
      new GeolocationFailure("unsupported", GEOLOCATION_FAILURE_MESSAGES.unsupported)
    );
  }

  // A non-secure context makes the API present but permanently denied,
  // which otherwise surfaces as a confusing "permission denied".
  if (
    typeof window !== "undefined" &&
    typeof window.isSecureContext === "boolean" &&
    !window.isSecureContext
  ) {
    return Promise.reject(
      new GeolocationFailure(
        "insecure_context",
        GEOLOCATION_FAILURE_MESSAGES.insecure_context
      )
    );
  }

  return new Promise<PreciseLocation>((resolve, reject) => {
    const startedAt = now();
    let best: GeolocationPosition | null = null;
    let watchId: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const cleanup = () => {
      if (watchId !== null) geo.clearWatch(watchId);
      if (timer !== null) clearTimeout(timer);
      watchId = null;
      timer = null;
    };

    const succeed = (position: GeolocationPosition, coarse: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        elapsedMs: now() - startedAt,
        coarse,
        capturedAt: new Date(position.timestamp || now()).toISOString(),
      });
    };

    const fail = (failure: GeolocationFailure) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(failure);
    };

    timer = setTimeout(() => {
      // Out of time: a coarse fix still beats recording nothing, as long as
      // the caller is told it is coarse.
      if (best) succeed(best, best.coords.accuracy > desiredAccuracyM);
      else fail(new GeolocationFailure("timeout", GEOLOCATION_FAILURE_MESSAGES.timeout));
    }, timeoutMs);

    watchId = geo.watchPosition(
      (position) => {
        if (!best || position.coords.accuracy < best.coords.accuracy) {
          best = position;
        }
        if (position.coords.accuracy <= desiredAccuracyM) {
          succeed(position, false);
        }
      },
      (error) => {
        // Keep waiting on transient errors if we already have something;
        // a hard denial is terminal either way.
        if (error.code === error.PERMISSION_DENIED) {
          fail(
            new GeolocationFailure(
              "permission_denied",
              GEOLOCATION_FAILURE_MESSAGES.permission_denied
            )
          );
          return;
        }
        if (best) return;
        if (error.code === error.TIMEOUT) return; // the outer timer owns this
        fail(
          new GeolocationFailure(
            "position_unavailable",
            GEOLOCATION_FAILURE_MESSAGES.position_unavailable
          )
        );
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}

const EARTH_RADIUS_M = 6_371_008.8;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Great-circle distance between two points, in metres.
 *
 * Haversine: accurate to well under a metre at geofence distances, which
 * is far below the accuracy of any consumer GPS fix.
 */
export function distanceBetweenMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface GeofenceCheck {
  inside: boolean;
  distanceM: number;
  radiusM: number;
  /** True when GPS accuracy is too poor to tell inside from outside. */
  inconclusive: boolean;
}

/**
 * Test a fix against a geofence.
 *
 * `inconclusive` matters: with a 2km accuracy radius, "12m from the office"
 * is noise. Treating that as a pass would let anyone punch in from
 * anywhere; treating it as a fail would strand staff with poor signal. The
 * caller decides, but it must be told which case it has.
 */
export function checkGeofence(
  fix: { latitude: number; longitude: number; accuracy: number },
  fence: { latitude: number; longitude: number; radiusM: number }
): GeofenceCheck {
  const distanceM = distanceBetweenMeters(fix, fence);
  return {
    inside: distanceM <= fence.radiusM,
    distanceM,
    radiusM: fence.radiusM,
    inconclusive: fix.accuracy > fence.radiusM,
  };
}

/** Format a distance for display: metres up close, kilometres beyond 1km. */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "unknown";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}
