import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MapPin, ExternalLink, ShieldCheck, Crosshair, Clock, Loader2, Navigation } from "lucide-react";

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
}

export function LocationMapModal({
  open,
  onOpenChange,
  location,
  title,
  employeeName,
  timestamp,
  workLocation = "OFFICE",
}: LocationMapModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const hasRealGps = Boolean(location && location.latitude && location.longitude);
  const [liveGpsLoading, setLiveGpsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(location);

  // Sync currentLocation when location prop changes
  useEffect(() => {
    setCurrentLocation(location);
  }, [location]);

  const activeLocation = (currentLocation && currentLocation.latitude && currentLocation.longitude) 
    ? currentLocation 
    : { latitude: 12.9715987, longitude: 77.5945627, accuracy: 25 };

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
      (err) => {
        setLiveGpsLoading(false);
        toast.error("Unable to access device location. Please allow location permissions in browser settings.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (!open || !mapContainerRef.current) return;

    // Load Leaflet CSS dynamically if not present
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Load Leaflet JS dynamically
    const initMap = () => {
      const L = (window as any).L;
      if (!L || !mapContainerRef.current) return;

      // Clean up existing map instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const { latitude, longitude, accuracy = 15 } = activeLocation;

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

      // Add Marker
      const marker = L.marker([latitude, longitude], { icon: customIcon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; padding: 2px;">
          <strong>${employeeName || "Employee"}</strong><br/>
          <span>${title}</span><br/>
          <small style="color: #64748b;">${timestamp || ""}</small>
        </div>
      `).openPopup();

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

    if ((window as any).L) {
      initMap();
    } else {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = initMap;
      document.body.appendChild(script);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [open, activeLocation]);

  const googleMapsUrl = `https://www.google.com/maps?q=${activeLocation.latitude},${activeLocation.longitude}`;

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
                  {hasRealGps ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-semibold">
                      Verified Device GPS
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-semibold">
                      Sample Location (Past Record)
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {employeeName ? `GPS Verification for ${employeeName}` : "GPS Location Verification"}
                </DialogDescription>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFetchLiveDeviceGps}
                disabled={liveGpsLoading}
                className="h-8 text-xs gap-1.5 border-border bg-background hover:bg-muted text-foreground"
              >
                {liveGpsLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Navigation className="size-3.5 text-primary" />}
                Detect My Live Location
              </Button>
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline bg-primary/10 px-3 py-1.5 rounded-lg transition-colors h-8"
              >
                <ExternalLink className="size-3.5" />
                Google Maps
              </a>
            </div>
          </div>
        </DialogHeader>

        {/* Leaflet Map Container */}
        <div className="relative w-full h-[340px] bg-muted">
          <div ref={mapContainerRef} className="w-full h-full z-0" />
        </div>

        {/* Footer Details */}
        <div className="px-6 py-4 bg-muted/30 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <Crosshair className="size-3 text-primary" /> Latitude
            </span>
            <p className="font-mono font-bold text-foreground">{activeLocation.latitude.toFixed(6)}</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <Crosshair className="size-3 text-primary" /> Longitude
            </span>
            <p className="font-mono font-bold text-foreground">{activeLocation.longitude.toFixed(6)}</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <ShieldCheck className="size-3 text-emerald-500" /> Accuracy
            </span>
            <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              ±{Math.round(activeLocation.accuracy || 15)} meters
            </p>
          </div>
          <div className="space-y-0.5">
            <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <Clock className="size-3 text-amber-500" /> Mode / Work Type
            </span>
            <p className="font-semibold text-foreground">{workLocation}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
