// AUDIT FIX #12: Require authenticated caller to prevent unauthenticated email abuse.
// FIX AUDIT #6: Add server-side rate limiting — max 3 emails per user per 5 minutes.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Rate limiter: 3 emails per user per 5 minutes ────────────────────────────
const emailLog = new Map<string, number[]>();
const EMAIL_MAX = 3;
const EMAIL_WINDOW_MS = 5 * 60_000;

function isEmailRateLimited(userId: string): boolean {
  const now = Date.now();
  const log = emailLog.get(userId) ?? [];
  const recent = log.filter(t => now - t < EMAIL_WINDOW_MS);
  if (recent.length >= EMAIL_MAX) return true;
  recent.push(now);
  emailLog.set(userId, recent);
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require a valid Supabase session — rejects unauthenticated callers.
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // FIX AUDIT #6: enforce per-user rate limit on email sends
  if (isEmailRateLimited(user.id)) {
    return new Response(
      JSON.stringify({ error: "Rate limit: max 3 emails per 5 minutes. Please wait before sending another." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "300" } },
    );
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
