"use client";

import { useState, useEffect, useRef } from "react";
import type * as LeafletNS from "leaflet";
import "leaflet/dist/leaflet.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MapPin, ExternalLink, ShieldCheck, Crosshair, Clock, Loader2, Navigation, Laptop } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeviceInfo } from "@/lib/attendance/device-info";
import { IconAction } from "@/components/ui/icon-action";

/** One label/value pair in the device panel; hidden when unknown. */
function DeviceField({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "truncate font-medium text-foreground",
          mono && "font-mono text-[11px]",
          !value && "text-muted-foreground font-normal"
        )}
        title={value || undefined}
      >
        {value || "Not recorded"}
      </dd>
    </div>
  );
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface LocationMapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: LocationData | null;
  title: string;
  employeeName?: string;
  timestamp?: string;
  workLocation?: string;
  /** Self-reported browser/device details captured with the punch. */
  deviceInfo?: Partial<DeviceInfo> | null;
  /** Public IP resolved server-side at punch time. */
  ipAddress?: string | null;
}

export function LocationMapModal({
  open,
  onOpenChange,
  location,
  title,
  employeeName,
  timestamp,
  workLocation = "OFFICE",
  deviceInfo,
  ipAddress,
}: LocationMapModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletNS.Map | null>(null);

  const hasRealGps = Boolean(location && location.latitude && location.longitude);
  const [liveGpsLoading, setLiveGpsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(location);

  // Sync currentLocation when location prop changes
  useEffect(() => {
    setCurrentLocation(location);
  }, [location]);

  // No fallback coordinates. This used to default to a hardcoded Bengaluru
  // point with a fabricated ±25m accuracy, so a record with no GPS — which
  // was every record, because the punch flow swallowed geolocation errors
  // and stored null — displayed as a precise-looking location hundreds of
  // kilometres from where the person actually was. For a feature whose
  // whole purpose is location verification, showing nothing is the only
  // honest option.
  const activeLocation =
    currentLocation && currentLocation.latitude && currentLocation.longitude
      ? currentLocation
      : null;

  const handleFetchLiveDeviceGps = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    setLiveGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLiveGpsLoading(false);
        const liveData = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setCurrentLocation(liveData);
        toast.success(`Device location detected! (${liveData.latitude.toFixed(4)}, ${liveData.longitude.toFixed(4)})`);
      },
      () => {
        setLiveGpsLoading(false);
        toast.error("Unable to access device location. Please allow location permissions in browser settings.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (!open || !mapContainerRef.current || !activeLocation) return;

    // Leaflet is a real dependency, imported dynamically because it
    // touches `window` on import and would break SSR. It used to be
    // injected as a <script src="unpkg.com/..."> with no integrity hash,
    // which meant a compromise of that CDN — or any MITM — was arbitrary
    // JS running inside an authenticated session.
    let cancelled = false;

    const initMap = (L: typeof LeafletNS) => {
      if (cancelled || !mapContainerRef.current) return;

      // Clean up existing map instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const { latitude, longitude, accuracy } = activeLocation;

      // Initialize Leaflet Map
      const map = L.map(mapContainerRef.current).setView([latitude, longitude], 16);
      mapInstanceRef.current = map;

      // Add OpenStreetMap tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Create Custom Leaflet Marker Icon
      const customIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: `
          <div style="
            background: #0284c7;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid #ffffff;
            box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);
            color: #ffffff;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });

      // Add Marker.
      //
      // The popup is built from DOM nodes rather than an HTML string:
      // Leaflet assigns a string argument straight to innerHTML, and
      // `employeeName` is a self-served profile name, so interpolating it
      // would execute any markup a member puts in their own name for every
      // manager who opens this map.
      const marker = L.marker([latitude, longitude], { icon: customIcon }).addTo(map);

      const popupNode = document.createElement("div");
      popupNode.style.cssText = "font-family: sans-serif; font-size: 12px; padding: 2px;";

      const nameEl = document.createElement("strong");
      nameEl.textContent = employeeName || "Employee";

      const titleEl = document.createElement("span");
      titleEl.textContent = title;

      const timeEl = document.createElement("small");
      timeEl.style.color = "#64748b";
      timeEl.textContent = timestamp || "";

      popupNode.append(nameEl, document.createElement("br"), titleEl, document.createElement("br"), timeEl);

      marker.bindPopup(popupNode).openPopup();

      // Add GPS Accuracy Circle
      if (accuracy) {
        L.circle([latitude, longitude], {
          color: "#0284c7",
          fillColor: "#0284c7",
          fillOpacity: 0.15,
          radius: Math.max(accuracy, 10),
        }).addTo(map);
      }

      // Ensure map resizes correctly inside modal
      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    };

    import("leaflet").then((mod) => initMap((mod.default ?? mod) as typeof LeafletNS));

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [open, activeLocation, employeeName, title, timestamp]);

  const googleMapsUrl = activeLocation
    ? `https://www.google.com/maps?q=${activeLocation.latitude},${activeLocation.longitude}`
    : null;

  // A fix wider than this tells you which city someone is in, not which
  // building — it is a wifi/IP lookup, not a satellite fix.
  const isCoarse = activeLocation ? (activeLocation.accuracy ?? 0) > 500 : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border text-foreground p-0 overflow-hidden rounded-2xl shadow-2xl">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <MapPin className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base font-bold text-foreground">
                    {title}
                  </DialogTitle>
                  {!activeLocation ? (
                    <Badge className="bg-muted text-muted-foreground border-border text-[10px] font-semibold">
                      No Location Recorded
                    </Badge>
                  ) : isCoarse ? (
                    <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-semibold">
                      Approximate (Network Fix)
                    </Badge>
                  ) : hasRealGps ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-semibold">
                      Verified Device GPS
                    </Badge>
                  ) : (
                    <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 text-[10px] font-semibold">
                      Live Device Location
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {employeeName ? `GPS Verification for ${employeeName}` : "GPS Location Verification"}
                </DialogDescription>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <IconAction label="Detect My Live Location" icon={liveGpsLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Navigation className="size-3.5 text-primary" />} type="button"
                variant="outline"
                onClick={handleFetchLiveDeviceGps}
                disabled={liveGpsLoading}
                className="h-8 text-xs gap-1.5 border-border bg-background hover:bg-muted text-foreground" />
              {googleMapsUrl && (
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline bg-primary/10 px-3 py-1.5 rounded-lg transition-colors h-8"
                >
                  <ExternalLink className="size-3.5" />
                  Google Maps
                </a>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Leaflet Map Container */}
        <div className="relative w-full h-[340px] bg-muted">
          {activeLocation ? (
            <div ref={mapContainerRef} className="w-full h-full z-0" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
              <MapPin className="size-8 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">
                No location was recorded for this punch
              </p>
              <p className="max-w-sm text-xs text-muted-foreground">
                The device either denied location permission or could not get a
                fix at the time. Use &ldquo;Detect My Live Location&rdquo; to
                check the current device position — that is where the device is
                now, not where this punch happened.
              </p>
            </div>
          )}
        </div>

        {/* Footer Details */}
        <div className="px-6 py-4 bg-muted/30 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <Crosshair className="size-3 text-primary" /> Latitude
            </span>
            <p className="font-mono font-bold text-foreground">
              {activeLocation ? activeLocation.latitude.toFixed(6) : "—"}
            </p>
          </div>
          <div className="space-y-0.5">
            <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <Crosshair className="size-3 text-primary" /> Longitude
            </span>
            <p className="font-mono font-bold text-foreground">
              {activeLocation ? activeLocation.longitude.toFixed(6) : "—"}
            </p>
          </div>
          <div className="space-y-0.5">
            <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <ShieldCheck
                className={cn("size-3", isCoarse ? "text-amber-500" : "text-emerald-500")}
              />{" "}
              Accuracy
            </span>
            {/* Never invent an accuracy figure — an unknown radius shown as
                "±15 m" is what made a network fix look like a satellite one. */}
            <p
              className={cn(
                "font-mono font-bold",
                !activeLocation || activeLocation.accuracy == null
                  ? "text-muted-foreground"
                  : isCoarse
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {activeLocation && activeLocation.accuracy != null
                ? `±${Math.round(activeLocation.accuracy)} meters`
                : "Unknown"}
            </p>
          </div>
          <div className="space-y-0.5">
            <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <Clock className="size-3 text-amber-500" /> Mode / Work Type
            </span>
            <p className="font-semibold text-foreground">{workLocation}</p>
          </div>
        </div>

        {/* Device provenance. Everything here except the IP is self-reported
            by the browser and can be spoofed, so it is labelled as such
            rather than presented as proof. */}
        <div className="border-t border-border px-6 py-4">
          <div className="mb-2 flex items-center gap-1.5">
            <Laptop className="size-3.5 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Device &amp; Network
            </span>
          </div>

          {!deviceInfo && !ipAddress ? (
            <p className="text-xs text-muted-foreground">
              No device details were recorded for this punch.
            </p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                <DeviceField label="Device" value={deviceInfo?.device_type} />
                <DeviceField label="Operating system" value={deviceInfo?.os} />
                <DeviceField label="Browser" value={deviceInfo?.browser} />
                <DeviceField label="IP address" value={ipAddress} mono />
                <DeviceField label="Device timezone" value={deviceInfo?.timezone} />
                <DeviceField label="Network" value={deviceInfo?.network_type} />
                <DeviceField label="Screen" value={deviceInfo?.screen} mono />
                <DeviceField label="Language" value={deviceInfo?.language} />
                <DeviceField
                  label="Touchscreen"
                  value={
                    deviceInfo?.touch_capable === undefined
                      ? undefined
                      : deviceInfo.touch_capable
                        ? "Yes"
                        : "No"
                  }
                />
              </dl>

              <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
                The IP is recorded by the server and cannot be set by the
                device. Everything else is reported by the browser itself and
                can be altered by a determined user — treat it as supporting
                detail, not proof. A MAC address cannot be read from a browser
                at all.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
