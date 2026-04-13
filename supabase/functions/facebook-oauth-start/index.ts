import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const encoder = new TextEncoder();

function base64UrlEncode(bytes: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSha256(secret: string, data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return base64UrlEncode(signature);
}

function jsonToBase64Url(obj: Record<string, unknown>) {
  const json = JSON.stringify(obj);
  const bytes = encoder.encode(json);
  return base64UrlEncode(bytes.buffer);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const projectUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
  const appId = Deno.env.get("FB_APP_ID")!;
  const appSecret = Deno.env.get("FB_APP_SECRET")!;
  const redirectUri = Deno.env.get("FB_REDIRECT_URI")!;
  const scopes = Deno.env.get("FB_SCOPES") ??
    "pages_show_list,pages_read_engagement,pages_messaging,pages_manage_metadata";

  if (!projectUrl || !anonKey) {
    return new Response(JSON.stringify({ error: "Supabase env vars missing. Set SUPABASE_URL and SUPABASE_ANON_KEY." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(projectUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData?.user) {
    const authHeader = req.headers.get("Authorization") ?? "";
    return new Response(JSON.stringify({
      error: "Unauthorized",
      details: authErr?.message ?? "No user",
      hasAuthHeader: Boolean(authHeader),
      authHeaderPreview: authHeader ? `${authHeader.slice(0, 16)}...` : "",
      projectUrl,
    }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const redirectTo = typeof body?.redirect_to === "string" ? body.redirect_to : "";

  const payload = {
    uid: authData.user.id,
    ts: Date.now(),
    redirect_to: redirectTo,
  };

  const payloadB64 = jsonToBase64Url(payload);
  const sig = await hmacSha256(appSecret, payloadB64);
  const state = `${payloadB64}.${sig}`;

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: scopes,
    response_type: "code",
  });

  const url = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;

  return new Response(JSON.stringify({ url }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
