import PageHeader from "@/components/PageHeader";
import { motion } from "framer-motion";
import { MapPin, Navigation, AlertCircle, Layers, Radio, MousePointerClick } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { hapticLight } from "@/lib/haptics";
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

type MapStyle = "street" | "satellite" | "voyager";

const MAP_TILES: Record<MapStyle, { url: string; name: string }> = {
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    name: "Street",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    name: "Satellite",
  },
  voyager: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    name: "Voyager",
  },
};

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
  const [mapStyle, setMapStyle] = useState<MapStyle>("street");
  const [initialZoomDone, setInitialZoomDone] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const lineRef = useRef<any>(null);

  // Get partner
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

  // Request permission
  const requestLocation = useCallback(async () => {
    if (!("geolocation" in navigator)) {
      setLocationError("Geolocation is not supported");
      return;
    }
    if ("permissions" in navigator) {
      try {
        const result = await navigator.permissions.query({ name: "geolocation" });
        setPermissionState(result.state as any);
        result.onchange = () => setPermissionState(result.state as any);
      } catch {}
    }
    navigator.geolocation.getCurrentPosition(
      () => { setPermissionState("granted"); setLocationError(null); },
      (err) => {
        if (err.code === 1) {
          setPermissionState("denied");
          setLocationError("Location permission denied. Please enable it in your browser settings.");
        } else {
          setLocationError("Unable to get location. Please try again.");
        }
      },
      { enableHighAccuracy: true }
    );
  }, []);

  // Watch location
  useEffect(() => {
    if (!user) return;
    let watchId: number;
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          setLocationError(null);
          setPermissionState("granted");
          const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, updated_at: new Date().toISOString() };
          setMyLocation(loc);
          // Use upsert to avoid duplicate key errors
          await supabase.from("locations").upsert(
            { user_id: user.id, latitude: loc.latitude, longitude: loc.longitude },
            { onConflict: "user_id" }
          );
        },
        (err) => {
          if (err.code === 1) { setPermissionState("denied"); setLocationError("Location access denied."); }
          else if (err.code === 2) { setLocationError("Location unavailable."); }
          else { setLocationError("Location timed out."); }
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
    }
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
  }, [user]);

  // Fetch partner location
  useEffect(() => {
    if (!partnerId) return;
    supabase.from("locations").select("*").eq("user_id", partnerId).maybeSingle()
      .then(({ data }) => { if (data) setPartnerLocation(data); });

    const channel = supabase.channel("partner-location")
      .on("postgres_changes", { event: "*", schema: "public", table: "locations", filter: `user_id=eq.${partnerId}` },
        (payload) => { setPartnerLocation(payload.new as LocationData); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partnerId]);

  // Distance
  useEffect(() => {
    if (myLocation && partnerLocation) {
      setDistance(haversineDistance(myLocation.latitude, myLocation.longitude, partnerLocation.latitude, partnerLocation.longitude));
    }
  }, [myLocation, partnerLocation]);

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapLoaded) return;
    import("leaflet").then((L) => {
      const map = L.map(mapRef.current!, {
        zoomControl: false,
        attributionControl: false,
        minZoom: 3,
        maxZoom: 19,
      }).setView([20, 0], 3);

      tileLayerRef.current = L.tileLayer(MAP_TILES[mapStyle].url, { maxZoom: 19 }).addTo(map);
      L.control.attribution({ position: "bottomright", prefix: false }).addAttribution('© OSM').addTo(map);

      // Add zoom control bottom-right
      L.control.zoom({ position: "bottomright" }).addTo(map);

      mapInstanceRef.current = map;
      setMapLoaded(true);
    });
    return () => { mapInstanceRef.current?.remove(); };
  }, []);

  // Switch tiles
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    import("leaflet").then((L) => {
      tileLayerRef.current.remove();
      tileLayerRef.current = L.tileLayer(MAP_TILES[mapStyle].url, { maxZoom: 19 }).addTo(mapInstanceRef.current);
    });
  }, [mapStyle]);

  // Update markers
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

      if (myLocation && partnerLocation) {
        lineRef.current = L.polyline(
          [[myLocation.latitude, myLocation.longitude], [partnerLocation.latitude, partnerLocation.longitude]],
          { color: "hsl(350, 80%, 60%)", weight: 2, dashArray: "8, 8", opacity: 0.6 }
        ).addTo(mapInstanceRef.current);

        // Only auto-fit on first load
        if (!initialZoomDone) {
          const bounds = L.latLngBounds([
            [myLocation.latitude, myLocation.longitude],
            [partnerLocation.latitude, partnerLocation.longitude],
          ]);
          mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
          setInitialZoomDone(true);
        }
      } else if (myLocation && !initialZoomDone) {
        mapInstanceRef.current.setView([myLocation.latitude, myLocation.longitude], 16);
        setInitialZoomDone(true);
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

  const cycleMapStyle = () => {
    const styles: MapStyle[] = ["street", "satellite", "voyager"];
    const idx = styles.indexOf(mapStyle);
    setMapStyle(styles[(idx + 1) % styles.length]);
  };

  const centerOnMe = () => {
    if (myLocation && mapInstanceRef.current) {
      mapInstanceRef.current.setView([myLocation.latitude, myLocation.longitude], 16, { animate: true });
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-screen">
      <PageHeader title="Map" subtitle="Always close" />

      <div className="flex-1 mx-5 mb-4 rounded-2xl border border-border overflow-hidden relative">
        <div ref={mapRef} className="absolute inset-0" />

        {/* Map style toggle */}
        <button onClick={cycleMapStyle}
          className="absolute top-3 right-3 z-[1000] h-10 px-3 rounded-xl bg-card/90 backdrop-blur-sm border border-border shadow-sm flex items-center gap-2 text-xs font-medium">
          <Layers className="h-4 w-4" />
          {MAP_TILES[mapStyle].name}
        </button>

        {(locationError || permissionState === "denied") && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-[1000]">
            <div className="text-center space-y-3 px-6">
              <div className="h-16 w-16 rounded-full bg-destructive/10 mx-auto flex items-center justify-center">
                <AlertCircle className="h-7 w-7 text-destructive" />
              </div>
              <p className="text-sm font-medium">Location Access Required</p>
              <p className="text-xs text-muted-foreground max-w-xs">{locationError}</p>
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
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Distance apart</p>
              <p className="text-3xl font-serif mt-1">{distance !== null ? formatDistance(distance) : "—"}</p>
              {partnerLocation && (
                <p className="text-[10px] text-muted-foreground mt-1">{partnerName} • {timeAgo(partnerLocation.updated_at)}</p>
              )}
              {!partnerId && <p className="text-[10px] text-muted-foreground mt-1">Link with partner in Settings</p>}
            </div>
            <button onClick={centerOnMe} className="h-11 w-11 rounded-xl bg-foreground flex items-center justify-center">
              <Navigation className="h-5 w-5 text-background" />
            </button>
          </div>
        </div>

        {myLocation && (
          <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <p className="text-[11px] text-muted-foreground">Live location sharing • {myLocation.latitude.toFixed(4)}, {myLocation.longitude.toFixed(4)}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default MapView;
