import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// FIX #5: Restrict CORS to the configured origin; falls back to * for local dev.
// In production: supabase secrets set ALLOWED_ORIGIN=https://your-app-domain.com
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Typed shape returned by Piped API items
interface PipedItem {
  url?: string;
  title?: string;
  uploaderName?: string;
  thumbnail?: string;
  duration?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "Missing query" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const instances = [
      "https://pipedapi.kavin.rocks",
      "https://pipedapi.adminforge.de",
      "https://api.piped.yt",
    ];

    type MusicResult = {
      title: string;
      artist: string;
      videoId: string;
      thumbnail: string;
      duration: number;
      url: string;
    };

    function mapItem(item: PipedItem): MusicResult {
      const videoId = item.url?.replace("/watch?v=", "") ?? "";
      return {
        title: item.title ?? "Unknown",
        artist: item.uploaderName ?? "Unknown",
        videoId,
        thumbnail: item.thumbnail ?? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        duration: item.duration ?? 0,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      };
    }

    let results: MusicResult[] = [];
    let lastError = "";

    for (const instance of instances) {
      try {
        const res = await fetch(
          `${instance}/search?q=${encodeURIComponent(query)}&filter=music_songs`,
          { headers: { "User-Agent": "DuoSpace/1.0" } }
        );
        if (!res.ok) {
          lastError = `${instance} returned ${res.status}`;
          await res.text();
          continue;
        }
        const data = await res.json();
        results = (data.items as PipedItem[] ?? [])
          .filter((item) => item.url && item.title)
          .slice(0, 15)
          .map(mapItem);
        break;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : "Unknown error";
        continue;
      }
    }

    if (results.length === 0 && lastError) {
      for (const instance of instances) {
        try {
          const res = await fetch(
            `${instance}/search?q=${encodeURIComponent(query)}&filter=videos`,
            { headers: { "User-Agent": "DuoSpace/1.0" } }
          );
          if (!res.ok) { await res.text(); continue; }
          const data = await res.json();
          results = (data.items as PipedItem[] ?? [])
            .filter((item) => item.url && item.title)
            .slice(0, 15)
            .map(mapItem);
          break;
        } catch { continue; }
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Search error:", message);
    return new Response(JSON.stringify({ error: message, results: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
