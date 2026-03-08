import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY');
  if (!DAILY_API_KEY) {
    return new Response(JSON.stringify({ error: 'DAILY_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { action, roomName } = await req.json();

    if (action === 'create-room') {
      // Create a room that expires in 1 hour
      const response = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DAILY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: roomName || `duo-${Date.now()}`,
          properties: {
            exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
            enable_chat: false,
            enable_knocking: false,
            max_participants: 2,
            enable_network_ui: false,
            enable_prejoin_ui: false,
            enable_screenshare: false,
            enable_recording: false,
            start_video_off: false,
            start_audio_off: false,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Daily API error [${response.status}]: ${JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify({
        url: data.url,
        name: data.name,
        id: data.id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get-token') {
      // Create a meeting token for authenticated access
      const response = await fetch('https://api.daily.co/v1/meeting-tokens', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DAILY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            room_name: roomName,
            exp: Math.floor(Date.now() / 1000) + 3600,
            is_owner: true,
            enable_recording: false,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Daily API error [${response.status}]: ${JSON.stringify(data)}`);
      }

      return new Response(JSON.stringify({ token: data.token }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete-room') {
      const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${DAILY_API_KEY}`,
        },
      });

      if (!response.ok && response.status !== 404) {
        const data = await response.json();
        throw new Error(`Daily API error [${response.status}]: ${JSON.stringify(data)}`);
      }
      await response.text();

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Daily.co error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
