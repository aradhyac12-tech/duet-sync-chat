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
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to, subject, html, type } = await req.json();

    if (!to || !subject) {
      return new Response(JSON.stringify({ error: "Missing 'to' or 'subject'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "DuoSpace <noreply@resend.dev>",
        to: [to],
        subject,
        html: html || getDefaultTemplate(type, subject),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend error:", data);
      return new Response(JSON.stringify({ error: data.message || "Failed to send email" }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Email error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getDefaultTemplate(type: string, subject: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f0ec; padding: 40px 20px;">
      <div style="max-width: 400px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; text-align: center;">
        <h1 style="font-size: 24px; font-weight: 600; color: #2c2c2c; margin-bottom: 8px;">DuoSpace</h1>
        <p style="font-size: 14px; color: #737373; margin-bottom: 24px;">${subject}</p>
        <p style="font-size: 13px; color: #a3a3a3; margin-top: 32px;">End-to-end encrypted • Your data stays yours</p>
      </div>
    </body>
    </html>
  `;
}
