import { describe, it, expect } from "vitest";
import {
  acquirePreciseLocation,
  checkGeofence,
  distanceBetweenMeters,
  formatDistance,
  GeolocationFailure,
} from "./geolocation";

/** Minimal stand-in for the platform Geolocation object. */
function fakeGeolocation(
  script: Array<{ afterMs: number; position?: [number, number, number]; errorCode?: number }>
): Geolocation {
  return {
    watchPosition(success: PositionCallback, error?: PositionErrorCallback) {
      script.forEach((step) => {
        setTimeout(() => {
          if (step.errorCode !== undefined) {
            error?.({
              code: step.errorCode,
              message: "",
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            } as GeolocationPositionError);
            return;
          }
          const [latitude, longitude, accuracy] = step.position!;
          success({
            coords: { latitude, longitude, accuracy },
            timestamp: 1_760_000_000_000,
          } as GeolocationPosition);
        }, step.afterMs);
      });
      return 1;
    },
    clearWatch() {},
    getCurrentPosition() {},
  } as unknown as Geolocation;
}

describe("distanceBetweenMeters", () => {
  it("is zero for the same point", () => {
    const p = { latitude: 16.4667, longitude: 75.1 };
    expect(distanceBetweenMeters(p, p)).toBe(0);
  });

  it("matches a known long-distance pair", () => {
    // Rabkavi (N. Karnataka) to Bengaluru: ~471km great-circle (road
    // distance is shorter-sounding at ~600km by road, but this is a
    // straight line). This is the error the coarse network fix produced.
    const rabkavi = { latitude: 16.4667, longitude: 75.1167 };
    const bengaluru = { latitude: 12.9715987, longitude: 77.5945627 };
    const km = distanceBetweenMeters(rabkavi, bengaluru) / 1000;
    expect(km).toBeGreaterThan(460);
    expect(km).toBeLessThan(480);
  });

  it("is accurate at geofence scale", () => {
    // 0.001 degrees of latitude is ~111m anywhere on Earth.
    const a = { latitude: 16.4667, longitude: 75.1167 };
    const b = { latitude: 16.4677, longitude: 75.1167 };
    expect(distanceBetweenMeters(a, b)).toBeGreaterThan(105);
    expect(distanceBetweenMeters(a, b)).toBeLessThan(117);
  });

  it("is symmetric", () => {
    const a = { latitude: 16.4667, longitude: 75.1167 };
    const b = { latitude: 12.9716, longitude: 77.5946 };
    expect(distanceBetweenMeters(a, b)).toBeCloseTo(distanceBetweenMeters(b, a), 6);
  });
});

describe("checkGeofence", () => {
  const office = { latitude: 16.4667, longitude: 75.1167, radiusM: 100 };

  it("passes a precise fix inside the fence", () => {
    const r = checkGeofence({ latitude: 16.4667, longitude: 75.1167, accuracy: 8 }, office);
    expect(r.inside).toBe(true);
    expect(r.inconclusive).toBe(false);
  });

  it("fails a precise fix outside the fence", () => {
    const r = checkGeofence({ latitude: 12.9716, longitude: 77.5946, accuracy: 10 }, office);
    expect(r.inside).toBe(false);
    expect(r.inconclusive).toBe(false);
    expect(r.distanceM).toBeGreaterThan(400_000);
  });

  it("flags a fix too coarse to judge", () => {
    // The classic wifi/IP fix: nominally 'at' the office, ±5km.
    const r = checkGeofence({ latitude: 16.4667, longitude: 75.1167, accuracy: 5000 }, office);
    expect(r.inconclusive).toBe(true);
  });

  it("treats a fix exactly on the boundary as inside", () => {
    const r = checkGeofence({ latitude: 16.4667, longitude: 75.1167, accuracy: 5 }, { ...office, radiusM: 0 });
    expect(r.inside).toBe(true);
  });
});

describe("acquirePreciseLocation", () => {
  it("returns as soon as a fix meets the desired accuracy", async () => {
    const fix = await acquirePreciseLocation({
      desiredAccuracyM: 50,
      timeoutMs: 1000,
      geolocation: fakeGeolocation([
        { afterMs: 0, position: [16.4667, 75.1167, 1200] },
        { afterMs: 10, position: [16.4668, 75.1168, 12] },
      ]),
    });
    expect(fix.accuracy).toBe(12);
    expect(fix.coarse).toBe(false);
  });

  it("returns the best coarse fix when it times out, flagged as coarse", async () => {
    const fix = await acquirePreciseLocation({
      desiredAccuracyM: 50,
      timeoutMs: 60,
      geolocation: fakeGeolocation([
        { afterMs: 0, position: [16.4667, 75.1167, 3000] },
        { afterMs: 10, position: [16.4668, 75.1168, 800] },
      ]),
    });
    expect(fix.accuracy).toBe(800);
    expect(fix.coarse).toBe(true);
  });

  it("rejects with permission_denied and never resolves coarsely", async () => {
    await expect(
      acquirePreciseLocation({
        timeoutMs: 200,
        geolocation: fakeGeolocation([{ afterMs: 0, errorCode: 1 }]),
      })
    ).rejects.toBeInstanceOf(GeolocationFailure);
  });

  it("rejects with timeout when no fix ever arrives", async () => {
    await expect(
      acquirePreciseLocation({ timeoutMs: 40, geolocation: fakeGeolocation([]) })
    ).rejects.toMatchObject({ reason: "timeout" });
  });

  it("survives a transient position_unavailable and still returns a later fix", async () => {
    const fix = await acquirePreciseLocation({
      desiredAccuracyM: 50,
      timeoutMs: 300,
      geolocation: fakeGeolocation([
        { afterMs: 0, position: [16.4667, 75.1167, 900] },
        { afterMs: 10, errorCode: 2 },
        { afterMs: 20, position: [16.4668, 75.1168, 9] },
      ]),
    });
    expect(fix.accuracy).toBe(9);
  });
});

describe("formatDistance", () => {
  it("uses metres below a kilometre", () => {
    expect(formatDistance(42.4)).toBe("42 m");
  });

  it("uses kilometres above", () => {
    expect(formatDistance(430_000)).toBe("430 km");
    expect(formatDistance(1500)).toBe("1.5 km");
  });

  it("handles non-finite input", () => {
    expect(formatDistance(Number.NaN)).toBe("unknown");
  });
});
