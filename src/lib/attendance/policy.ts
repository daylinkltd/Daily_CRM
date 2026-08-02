/**
 * Effective attendance policy for one member on one date.
 *
 * The shape mirrors the JSON returned by the `resolve_attendance_policy`
 * SQL function (migration 086), which merges, most specific first:
 *   day override -> member policy -> department policy -> workspace default.
 *
 * Parsing lives here rather than inline in the component so the punch UI
 * and the HR configuration screens agree on what a policy means, and so
 * the defaults are stated once.
 */

export const WORK_LOCATIONS = ["OFFICE", "WFH", "CLIENT_SITE", "FIELD"] as const;
export type WorkLocation = (typeof WORK_LOCATIONS)[number];

export const WORK_LOCATION_LABELS: Record<WorkLocation, string> = {
  OFFICE: "Office",
  WFH: "Work From Home",
  CLIENT_SITE: "Client Site",
  FIELD: "Field",
};

export type GeofenceStatus =
  | "INSIDE"
  | "OUTSIDE"
  | "INCONCLUSIVE"
  | "NOT_ENFORCED"
  | "EXEMPT";

export interface PunchLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  captured_at: string;
}

export interface PolicyGeofence {
  latitude: number;
  longitude: number;
  radius_m: number;
  label: string | null;
}

export interface AttendancePolicy {
  source: string;
  policy_id: string | null;
  override_id: string | null;
  allowed_work_locations: WorkLocation[];
  default_work_location: WorkLocation;
  require_location: boolean;
  require_location_for: WorkLocation[];
  min_gps_accuracy_m: number;
  geofence: PolicyGeofence | null;
  block_outside_geofence: boolean;
  require_timesheet_on_punch_out: boolean;
  timesheet_template_id: string | null;
  override_note: string | null;
}

/**
 * Used until HR configures anything, and whenever the resolver is
 * unreachable. Deliberately permissive on *what* you may select but strict
 * on recording a location, so switching the feature on does not lock
 * anyone out of punching in.
 */
export const DEFAULT_ATTENDANCE_POLICY: AttendancePolicy = {
  source: "implicit_default",
  policy_id: null,
  override_id: null,
  allowed_work_locations: ["OFFICE", "WFH", "CLIENT_SITE"],
  default_work_location: "OFFICE",
  require_location: true,
  require_location_for: ["OFFICE", "CLIENT_SITE", "FIELD"],
  min_gps_accuracy_m: 100,
  geofence: null,
  block_outside_geofence: false,
  require_timesheet_on_punch_out: false,
  timesheet_template_id: null,
  override_note: null,
};

const isWorkLocation = (value: unknown): value is WorkLocation =>
  typeof value === "string" && (WORK_LOCATIONS as readonly string[]).includes(value);

function toWorkLocations(value: unknown, fallback: WorkLocation[]): WorkLocation[] {
  if (!Array.isArray(value)) return fallback;
  const parsed = value.filter(isWorkLocation);
  return parsed.length > 0 ? parsed : fallback;
}

function toPositiveNumber(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Normalise the resolver's JSON into an `AttendancePolicy`.
 *
 * Every field falls back to the default rather than throwing: a policy row
 * with one bad value must not be able to block the whole team from
 * clocking in.
 */
export function parseAttendancePolicy(raw: unknown): AttendancePolicy {
  if (!raw || typeof raw !== "object") return DEFAULT_ATTENDANCE_POLICY;
  const r = raw as Record<string, unknown>;

  const allowed = toWorkLocations(
    r.allowed_work_locations,
    DEFAULT_ATTENDANCE_POLICY.allowed_work_locations
  );

  // The default must be selectable, or the UI would open on an option the
  // policy forbids.
  const rawDefault = r.default_work_location;
  const defaultLocation =
    isWorkLocation(rawDefault) && allowed.includes(rawDefault) ? rawDefault : allowed[0];

  let geofence: PolicyGeofence | null = null;
  const g = r.geofence;
  if (g && typeof g === "object") {
    const gg = g as Record<string, unknown>;
    const lat = Number(gg.latitude);
    const lon = Number(gg.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      geofence = {
        latitude: lat,
        longitude: lon,
        radius_m: toPositiveNumber(gg.radius_m, 100),
        label: typeof gg.label === "string" ? gg.label : null,
      };
    }
  }

  return {
    source: typeof r.source === "string" ? r.source : "unknown",
    policy_id: typeof r.policy_id === "string" ? r.policy_id : null,
    override_id: typeof r.override_id === "string" ? r.override_id : null,
    allowed_work_locations: allowed,
    default_work_location: defaultLocation,
    require_location:
      typeof r.require_location === "boolean"
        ? r.require_location
        : DEFAULT_ATTENDANCE_POLICY.require_location,
    require_location_for: toWorkLocations(
      r.require_location_for,
      DEFAULT_ATTENDANCE_POLICY.require_location_for
    ),
    min_gps_accuracy_m: toPositiveNumber(
      r.min_gps_accuracy_m,
      DEFAULT_ATTENDANCE_POLICY.min_gps_accuracy_m
    ),
    geofence,
    block_outside_geofence: r.block_outside_geofence === true,
    require_timesheet_on_punch_out: r.require_timesheet_on_punch_out === true,
    timesheet_template_id:
      typeof r.timesheet_template_id === "string" ? r.timesheet_template_id : null,
    override_note: typeof r.override_note === "string" ? r.override_note : null,
  };
}
