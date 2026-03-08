import PageHeader from "@/components/PageHeader";
import { motion } from "framer-motion";
import { MapPin, Navigation } from "lucide-react";

const MapView = () => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-screen">
      <PageHeader title="Map" subtitle="Always close" />

      <div className="flex-1 mx-5 mb-4 rounded-2xl bg-sand/30 border border-border overflow-hidden relative">
        {/* Map placeholder */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="h-16 w-16 rounded-full bg-accent mx-auto flex items-center justify-center">
              <MapPin className="h-7 w-7 text-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Map will appear here</p>
            <p className="text-xs text-muted-foreground/60">Enable location to see each other</p>
          </div>
        </div>
      </div>

      {/* Distance card */}
      <div className="px-5 pb-24">
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Distance apart</p>
              <p className="text-3xl font-serif mt-1">-- km</p>
            </div>
            <button className="h-11 w-11 rounded-xl bg-foreground flex items-center justify-center">
              <Navigation className="h-5 w-5 text-background" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MapView;
