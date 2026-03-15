import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Try multiple Piped API instances for reliability
    const instances = [
      "https://pipedapi.kavin.rocks",
      "https://pipedapi.adminforge.de",
      "https://api.piped.yt",
    ];

    let results: any[] = [];
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
        results = (data.items || [])
          .filter((item: any) => item.url && item.title)
          .slice(0, 15)
          .map((item: any) => ({
            title: item.title || "Unknown",
            artist: item.uploaderName || "Unknown",
            videoId: item.url?.replace("/watch?v=", "") || "",
            thumbnail: item.thumbnail || `https://img.youtube.com/vi/${item.url?.replace("/watch?v=", "")}/mqdefault.jpg`,
            duration: item.duration || 0,
            url: `https://www.youtube.com/watch?v=${item.url?.replace("/watch?v=", "")}`,
          }));
        break;
      } catch (err) {
        lastError = err.message;
        continue;
      }
    }

    if (results.length === 0 && lastError) {
      // Fallback: try general video search
      for (const instance of instances) {
        try {
          const res = await fetch(
            `${instance}/search?q=${encodeURIComponent(query)}&filter=videos`,
            { headers: { "User-Agent": "DuoSpace/1.0" } }
          );
          if (!res.ok) { await res.text(); continue; }
          const data = await res.json();
          results = (data.items || [])
            .filter((item: any) => item.url && item.title)
            .slice(0, 15)
            .map((item: any) => ({
              title: item.title || "Unknown",
              artist: item.uploaderName || "Unknown",
              videoId: item.url?.replace("/watch?v=", "") || "",
              thumbnail: item.thumbnail || "",
              duration: item.duration || 0,
              url: `https://www.youtube.com/watch?v=${item.url?.replace("/watch?v=", "")}`,
            }));
          break;
        } catch { continue; }
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Search error:", err);
    return new Response(JSON.stringify({ error: err.message, results: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
