import PageHeader from "@/components/PageHeader";
import { motion } from "framer-motion";
import { MapPin, Navigation } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  const [myLocation, setMyLocation] = useState<LocationData | null>(null);
  const [partnerLocation, setPartnerLocation] = useState<LocationData | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Get partner ID
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("partner_id").eq("user_id", user.id).single()
      .then(({ data }) => { if (data?.partner_id) setPartnerId(data.partner_id); });
  }, [user]);

  // Watch my location and update DB
  useEffect(() => {
    if (!user) return;
    let watchId: number;
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        async (pos) => {
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
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000 }
      );
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
      const map = L.map(mapRef.current!, { zoomControl: false }).setView([20, 0], 3);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(map);
      mapInstanceRef.current = map;
      setMapLoaded(true);
    });
    return () => { mapInstanceRef.current?.remove(); };
  }, []);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    import("leaflet").then((L) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const createIcon = (color: string, label: string) => L.divIcon({
        html: `<div style="background:${color};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2)">${label}</div>`,
        iconSize: [32, 32],
        className: "",
      });

      if (myLocation) {
        const m = L.marker([myLocation.latitude, myLocation.longitude], { icon: createIcon("hsl(28,15%,72%)", "Me") }).addTo(mapInstanceRef.current);
        markersRef.current.push(m);
      }
      if (partnerLocation) {
        const m = L.marker([partnerLocation.latitude, partnerLocation.longitude], { icon: createIcon("hsl(350,45%,65%)", "💕") }).addTo(mapInstanceRef.current);
        markersRef.current.push(m);
      }

      if (myLocation && partnerLocation) {
        const bounds = L.latLngBounds([
          [myLocation.latitude, myLocation.longitude],
          [partnerLocation.latitude, partnerLocation.longitude],
        ]);
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
      } else if (myLocation) {
        mapInstanceRef.current.setView([myLocation.latitude, myLocation.longitude], 14);
      }
    });
  }, [myLocation, partnerLocation, mapLoaded]);

  const formatDistance = (d: number) => {
    if (d < 1) return `${Math.round(d * 1000)} m`;
    return `${d.toFixed(1)} km`;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-screen">
      <PageHeader title="Map" subtitle="Always close" />

      <div className="flex-1 mx-5 mb-4 rounded-2xl border border-border overflow-hidden relative">
        <div ref={mapRef} className="absolute inset-0" />
        {!myLocation && (
          <div className="absolute inset-0 flex items-center justify-center bg-sand/30 z-[1000]">
            <div className="text-center space-y-3">
              <div className="h-16 w-16 rounded-full bg-accent mx-auto flex items-center justify-center">
                <MapPin className="h-7 w-7 text-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Waiting for location...</p>
              <p className="text-xs text-muted-foreground/60">Allow location access to see the map</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-5 pb-24">
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Distance apart</p>
              <p className="text-3xl font-serif mt-1">{distance !== null ? formatDistance(distance) : "-- km"}</p>
              {partnerLocation && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Updated {new Date(partnerLocation.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
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
      </div>
    </motion.div>
  );
};

export default MapView;
