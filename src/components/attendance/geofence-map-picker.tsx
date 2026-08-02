"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type * as LeafletNS from "leaflet";
import "leaflet/dist/leaflet.css";
import { toast } from "sonner";
import { Loader2, Crosshair, Search, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  acquirePreciseLocation,
  GeolocationFailure,
  GEOLOCATION_FAILURE_MESSAGES,
  formatDistance,
} from "@/lib/attendance/geolocation";
import { IconAction } from "@/components/ui/icon-action";

export interface GeofenceValue {
  latitude: number | null;
  longitude: number | null;
  radiusM: number;
}

interface GeofenceMapPickerProps {
  value: GeofenceValue;
  onChange: (next: GeofenceValue) => void;
  disabled?: boolean;
  /** Optional label rendered in the marker popup. */
  label?: string;
  heightClass?: string;
}

/** Radius presets covering the realistic range from a desk to a campus. */
const RADIUS_PRESETS = [25, 50, 100, 250, 500, 1000];

const MIN_RADIUS = 10;
const MAX_RADIUS = 5000;

/** Falls back to the centre of India when nothing is set yet. */
const FALLBACK_CENTRE: [number, number] = [20.5937, 78.9629];

/**
 * Interactive geofence editor: drag the pin or click the map to move the
 * centre, drag the edge handle or use the controls to size the radius.
 *
 * Leaflet is imported as a real dependency rather than injected from a
 * CDN at runtime. The previous CDN <script> tag had no integrity hash,
 * so a compromise of that host — or any MITM — meant arbitrary JS in an
 * authenticated session. It is loaded dynamically (not at module scope)
 * because Leaflet touches `window` on import and would break SSR.
 */
export function GeofenceMapPicker({
  value,
  onChange,
  disabled = false,
  label,
  heightClass = "h-[320px]",
}: GeofenceMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const markerRef = useRef<LeafletNS.Marker | null>(null);
  const circleRef = useRef<LeafletNS.Circle | null>(null);
  const LRef = useRef<typeof LeafletNS | null>(null);

  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  // Held in a ref so the map's event handlers always see current values
  // without needing to be torn down and rebound on every change.
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const setCentre = useCallback((lat: number, lng: number) => {
    onChangeRef.current({
      ...valueRef.current,
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
    });
  }, []);

  const setRadius = useCallback((radiusM: number) => {
    const clamped = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Math.round(radiusM)));
    onChangeRef.current({ ...valueRef.current, radiusM: clamped });
  }, []);

  // Build the map once.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default ?? (await import("leaflet"));
      if (cancelled || !containerRef.current || mapRef.current) return;
      LRef.current = L as typeof LeafletNS;

      const start: [number, number] =
        value.latitude != null && value.longitude != null
          ? [value.latitude, value.longitude]
          : FALLBACK_CENTRE;

      const map = L.map(containerRef.current, {
        center: start,
        zoom: value.latitude != null ? 16 : 5,
        // The page scrolls; grabbing zoom on every wheel event over the
        // map makes the form hard to scroll past.
        scrollWheelZoom: false,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      map.on("click", (e: LeafletNS.LeafletMouseEvent) => {
        if (disabledRef.current) return;
        setCentre(e.latlng.lat, e.latlng.lng);
      });

      setReady(true);
      // The container is often laid out after the map is created (inside a
      // card that is still sizing), leaving grey tiles until a resize.
      setTimeout(() => map.invalidateSize(), 200);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // Intentionally builds once; value changes are applied by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect the current value onto the map.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;

    if (value.latitude == null || value.longitude == null) {
      markerRef.current?.remove();
      circleRef.current?.remove();
      markerRef.current = null;
      circleRef.current = null;
      return;
    }

    const pos: [number, number] = [value.latitude, value.longitude];

    if (!markerRef.current) {
      const icon = L.divIcon({
        className: "geofence-centre-marker",
        html:
          '<div style="width:20px;height:20px;border-radius:50%;background:#0284c7;' +
          'border:3px solid #fff;box-shadow:0 2px 8px rgba(2,132,199,.5)"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      const marker = L.marker(pos, { icon, draggable: !disabled }).addTo(map);
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        setCentre(p.lat, p.lng);
      });
      markerRef.current = marker;
      map.setView(pos, Math.max(map.getZoom(), 16));
    } else {
      markerRef.current.setLatLng(pos);
      // draggable is a runtime handler, not a re-render prop.
      if (disabled) markerRef.current.dragging?.disable();
      else markerRef.current.dragging?.enable();
    }

    if (!circleRef.current) {
      circleRef.current = L.circle(pos, {
        radius: value.radiusM,
        color: "#0284c7",
        fillColor: "#0284c7",
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng(pos);
      circleRef.current.setRadius(value.radiusM);
    }

    if (label) {
      markerRef.current.bindPopup(
        // textContent equivalent: build a node so a workspace-supplied
        // label can never inject markup into the popup's innerHTML.
        (() => {
          const el = document.createElement("div");
          el.style.cssText = "font-family:sans-serif;font-size:12px";
          el.textContent = label;
          return el;
        })()
      );
    }
  }, [value.latitude, value.longitude, value.radiusM, ready, disabled, label, setCentre]);

  const handleUseMyLocation = async () => {
    setLocating(true);
    try {
      const fix = await acquirePreciseLocation({ desiredAccuracyM: 30, timeoutMs: 25_000 });
      setCentre(fix.latitude, fix.longitude);
      mapRef.current?.setView([fix.latitude, fix.longitude], 17);
      toast.success(
        `Centre set to your position (±${Math.round(fix.accuracy)}m).` +
          (fix.coarse ? " That is a coarse fix — check the pin before saving." : "")
      );
    } catch (err) {
      toast.error(
        err instanceof GeolocationFailure
          ? err.message
          : GEOLOCATION_FAILURE_MESSAGES.position_unavailable
      );
    } finally {
      setLocating(false);
    }
  };

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      // Nominatim is OpenStreetMap's own geocoder and needs no API key.
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/json" } }
      );
      if (!res.ok) throw new Error("Search failed");
      const results = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      if (results.length === 0) {
        toast.error(`No place found for "${q}".`);
        return;
      }
      const lat = parseFloat(results[0].lat);
      const lon = parseFloat(results[0].lon);
      setCentre(lat, lon);
      mapRef.current?.setView([lat, lon], 16);
      toast.success(results[0].display_name);
    } catch {
      toast.error("Could not search for that place. Set the pin manually instead.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder="Search an address or place…"
            disabled={disabled || searching}
            className="h-9 pl-8 text-xs"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleSearch}
          disabled={disabled || searching || !query.trim()}
          className="h-9 gap-1.5 text-xs"
        >
          {searching ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
          Find
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleUseMyLocation}
          disabled={disabled || locating}
          className="h-9 gap-1.5 text-xs"
        >
          {locating ? <Loader2 className="size-3.5 animate-spin" /> : <Crosshair className="size-3.5" />}
          Use my location
        </Button>
      </div>

      <div className={`relative w-full overflow-hidden rounded-xl border border-border ${heightClass}`}>
        <div ref={containerRef} className="h-full w-full" />
        {value.latitude == null && ready && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-background/90 px-3 py-2 text-center text-xs text-muted-foreground">
            Click anywhere on the map to place the centre.
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">
            Radius — {formatDistance(value.radiusM)}
          </Label>
          <div className="flex items-center gap-1">
            <IconAction
              label="Remove"
              icon={<Minus className="size-3" />}
              type="button"
              variant="outline"
              className="size-7 p-0"
              disabled={disabled || value.radiusM <= MIN_RADIUS}
              onClick={() => setRadius(value.radiusM - (value.radiusM > 100 ? 50 : 10))}
            />
            <IconAction
              label="Add"
              icon={<Plus className="size-3" />}
              type="button"
              variant="outline"
              className="size-7 p-0"
              disabled={disabled || value.radiusM >= MAX_RADIUS}
              onClick={() => setRadius(value.radiusM + (value.radiusM >= 100 ? 50 : 10))}
            />
          </div>
        </div>

        <input
          type="range"
          min={MIN_RADIUS}
          max={MAX_RADIUS}
          step={10}
          value={value.radiusM}
          disabled={disabled}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="w-full accent-primary"
        />

        <div className="flex flex-wrap gap-1.5">
          {RADIUS_PRESETS.map((r) => (
            <button
              key={r}
              type="button"
              disabled={disabled}
              onClick={() => setRadius(r)}
              className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                value.radiusM === r
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {formatDistance(r)}
            </button>
          ))}
        </div>

        {value.latitude != null && value.longitude != null && (
          <p className="font-mono text-[11px] text-muted-foreground">
            {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
          </p>
        )}
      </div>
    </div>
  );
}
