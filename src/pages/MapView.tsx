import PageHeader from "@/components/PageHeader";
import { motion } from "framer-motion";
import { MapPin, Navigation, AlertCircle } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import "leaflet/dist/leaflet.css";

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

interface LocationData {
  latitude: number;
  longitude: number;
  updated_at: string;
}

const MapView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [myLocation, setMyLocation] = useState<LocationData | null>(null);
  const [partnerLocation, setPartnerLocation] = useState<LocationData | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState("Partner");
  const [distance, setDistance] = useState<number | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<"prompt" | "granted" | "denied" | "unknown">("unknown");
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const lineRef = useRef<any>(null);

  // Get partner ID & name
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("partner_id").eq("user_id", user.id).single()
      .then(({ data }) => {
        if (data?.partner_id) {
          setPartnerId(data.partner_id);
          supabase.from("profiles").select("display_name").eq("user_id", data.partner_id).single()
            .then(({ data: pp }) => { if (pp) setPartnerName(pp.display_name); });
        }
      });
  }, [user]);

  // Check & request location permission
  const requestLocation = useCallback(async () => {
    if (!("geolocation" in navigator)) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    // Check permission state if API available
    if ("permissions" in navigator) {
      try {
        const result = await navigator.permissions.query({ name: "geolocation" });
        setPermissionState(result.state as any);
        result.onchange = () => setPermissionState(result.state as any);
      } catch {}
    }

    navigator.geolocation.getCurrentPosition(
      () => setPermissionState("granted"),
      (err) => {
        if (err.code === 1) {
          setPermissionState("denied");
          setLocationError("Location permission denied. Please enable it in your browser settings.");
        } else {
          setLocationError("Unable to get your location. Please try again.");
        }
      },
      { enableHighAccuracy: true }
    );
  }, []);

  // Watch my location and update DB
  useEffect(() => {
    if (!user) return;
    let watchId: number;

    const startWatch = () => {
      watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          setLocationError(null);
          setPermissionState("granted");
          const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, updated_at: new Date().toISOString() };
          setMyLocation(loc);
          // Upsert location
          const { data: existing } = await supabase.from("locations").select("id").eq("user_id", user.id).single();
          if (existing) {
            await supabase.from("locations").update({ latitude: loc.latitude, longitude: loc.longitude }).eq("user_id", user.id);
          } else {
            await supabase.from("locations").insert({ user_id: user.id, latitude: loc.latitude, longitude: loc.longitude });
          }
        },
        (err) => {
          if (err.code === 1) {
            setPermissionState("denied");
            setLocationError("Location access denied. Enable in browser settings.");
          } else if (err.code === 2) {
            setLocationError("Location unavailable. Check your device settings.");
          } else {
            setLocationError("Location request timed out. Retrying...");
          }
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
    };

    if ("geolocation" in navigator) {
      startWatch();
    } else {
      setLocationError("Geolocation not supported");
    }

    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
  }, [user]);

  // Fetch partner location
  useEffect(() => {
    if (!partnerId) return;
    const fetchPartnerLoc = async () => {
      const { data } = await supabase.from("locations").select("*").eq("user_id", partnerId).single();
      if (data) setPartnerLocation(data);
    };
    fetchPartnerLoc();

    const channel = supabase.channel("partner-location")
      .on("postgres_changes", { event: "*", schema: "public", table: "locations", filter: `user_id=eq.${partnerId}` },
        (payload) => { setPartnerLocation(payload.new as LocationData); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partnerId]);

  // Calculate distance
  useEffect(() => {
    if (myLocation && partnerLocation) {
      setDistance(haversineDistance(myLocation.latitude, myLocation.longitude, partnerLocation.latitude, partnerLocation.longitude));
    }
  }, [myLocation, partnerLocation]);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || mapLoaded) return;
    import("leaflet").then((L) => {
      const map = L.map(mapRef.current!, { zoomControl: false, attributionControl: false }).setView([20, 0], 3);
      // Use a beautiful map style
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
      }).addTo(map);
      // Add minimal attribution
      L.control.attribution({ position: "bottomright", prefix: false }).addAttribution('© <a href="https://osm.org">OSM</a>').addTo(map);
      mapInstanceRef.current = map;
      setMapLoaded(true);
    });
    return () => { mapInstanceRef.current?.remove(); };
  }, []);

  // Update markers & line
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;
    import("leaflet").then((L) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (lineRef.current) { lineRef.current.remove(); lineRef.current = null; }

      const createIcon = (emoji: string, label: string, color: string) => L.divIcon({
        html: `<div style="display:flex;flex-direction:column;align-items:center">
          <div style="background:${color};width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 2px 12px rgba(0,0,0,0.25)">${emoji}</div>
          <div style="background:white;padding:2px 8px;border-radius:8px;margin-top:4px;font-size:11px;font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,0.15);white-space:nowrap">${label}</div>
        </div>`,
        iconSize: [60, 60],
        iconAnchor: [30, 20],
        className: "",
      });

      if (myLocation) {
        const m = L.marker([myLocation.latitude, myLocation.longitude], {
          icon: createIcon("📍", "You", "hsl(220, 90%, 56%)"),
        }).addTo(mapInstanceRef.current);
        markersRef.current.push(m);
      }
      if (partnerLocation) {
        const m = L.marker([partnerLocation.latitude, partnerLocation.longitude], {
          icon: createIcon("💕", partnerName, "hsl(350, 80%, 60%)"),
        }).addTo(mapInstanceRef.current);
        markersRef.current.push(m);
      }

      // Draw a dashed line between both
      if (myLocation && partnerLocation) {
        lineRef.current = L.polyline(
          [[myLocation.latitude, myLocation.longitude], [partnerLocation.latitude, partnerLocation.longitude]],
          { color: "hsl(350, 80%, 60%)", weight: 2, dashArray: "8, 8", opacity: 0.6 }
        ).addTo(mapInstanceRef.current);

        const bounds = L.latLngBounds([
          [myLocation.latitude, myLocation.longitude],
          [partnerLocation.latitude, partnerLocation.longitude],
        ]);
        mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60] });
      } else if (myLocation) {
        mapInstanceRef.current.setView([myLocation.latitude, myLocation.longitude], 14);
      }
    });
  }, [myLocation, partnerLocation, mapLoaded, partnerName]);

  const formatDistance = (d: number) => {
    if (d < 1) return `${Math.round(d * 1000)} m`;
    if (d > 100) return `${Math.round(d)} km`;
    return `${d.toFixed(1)} km`;
  };

  const timeAgo = (date: string) => {
    const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-screen">
      <PageHeader title="Map" subtitle="Always close" />

      <div className="flex-1 mx-5 mb-4 rounded-2xl border border-border overflow-hidden relative">
        <div ref={mapRef} className="absolute inset-0" />

        {/* Location error or permission prompt */}
        {(locationError || permissionState === "denied") && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-[1000]">
            <div className="text-center space-y-3 px-6">
              <div className="h-16 w-16 rounded-full bg-destructive/10 mx-auto flex items-center justify-center">
                <AlertCircle className="h-7 w-7 text-destructive" />
              </div>
              <p className="text-sm font-medium">Location Access Required</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                {locationError || "Please allow location access in your browser settings to see the map."}
              </p>
              <button onClick={requestLocation} className="bg-foreground text-background text-sm px-5 py-2.5 rounded-xl">
                Request Permission
              </button>
            </div>
          </div>
        )}

        {!myLocation && !locationError && permissionState !== "denied" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-[1000]">
            <div className="text-center space-y-3">
              <div className="h-16 w-16 rounded-full bg-accent mx-auto flex items-center justify-center animate-pulse">
                <MapPin className="h-7 w-7 text-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Getting your location...</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-5 pb-24 space-y-3">
        {/* Distance card */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Distance apart</p>
              <p className="text-3xl font-serif mt-1">{distance !== null ? formatDistance(distance) : "—"}</p>
              {partnerLocation && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {partnerName} • {timeAgo(partnerLocation.updated_at)}
                </p>
              )}
              {!partnerId && (
                <p className="text-[10px] text-muted-foreground mt-1">Link with partner in Settings</p>
              )}
            </div>
            <button
              onClick={() => {
                if (myLocation && mapInstanceRef.current) {
                  mapInstanceRef.current.setView([myLocation.latitude, myLocation.longitude], 14);
                }
              }}
              className="h-11 w-11 rounded-xl bg-foreground flex items-center justify-center"
            >
              <Navigation className="h-5 w-5 text-background" />
            </button>
          </div>
        </div>

        {/* Location status */}
        {myLocation && (
          <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <p className="text-[11px] text-muted-foreground">
              Live location sharing • {myLocation.latitude.toFixed(4)}, {myLocation.longitude.toFixed(4)}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default MapView;
