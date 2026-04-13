import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();

function base64UrlDecode(input: string) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
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
  const bytes = new Uint8Array(signature);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function jsonFromBase64Url(b64: string) {
  const bytes = base64UrlDecode(b64);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed: ${res.status} ${text}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  const appId = Deno.env.get("FB_APP_ID")!;
  const appSecret = Deno.env.get("FB_APP_SECRET")!;
  const redirectUri = Deno.env.get("FB_REDIRECT_URI")!;
  const projectUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return new Response("Missing code/state", { status: 400 });
  }

  const [payloadB64, sig] = state.split(".");
  if (!payloadB64 || !sig) {
    return new Response("Invalid state", { status: 400 });
  }

  const expectedSig = await hmacSha256(appSecret, payloadB64);
  if (expectedSig !== sig) {
    return new Response("Invalid state signature", { status: 400 });
  }

  const payload = jsonFromBase64Url(payloadB64) as {
    uid: string;
    ts: number;
    redirect_to?: string;
  };

  const maxAgeMs = (parseInt(Deno.env.get("FB_STATE_TTL_SECONDS") ?? "900", 10)) * 1000;
  if (Date.now() - payload.ts > maxAgeMs) {
    return new Response("State expired. Please try again.", { status: 400 });
  }

  const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("code", code);

  const tokenData = await fetchJson(tokenUrl.toString());
  const shortLivedToken = tokenData.access_token as string;

  const longLivedUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
  longLivedUrl.searchParams.set("client_id", appId);
  longLivedUrl.searchParams.set("client_secret", appSecret);
  longLivedUrl.searchParams.set("fb_exchange_token", shortLivedToken);

  const longLivedData = await fetchJson(longLivedUrl.toString());
  const longLivedUserToken = longLivedData.access_token as string;

  const pagesUrl = new URL("https://graph.facebook.com/v19.0/me/accounts");
  pagesUrl.searchParams.set("access_token", longLivedUserToken);
  pagesUrl.searchParams.set("fields", "id,name,access_token");

  const pagesData = await fetchJson(pagesUrl.toString());
  const pages = Array.isArray(pagesData?.data) ? pagesData.data : [];

  if (pages.length === 0) {
    return new Response("No Facebook Pages found for this account.", { status: 400 });
  }

  const selectedPage = pages[0];

  if (!projectUrl || !serviceRoleKey) {
    return new Response("Supabase env vars missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.", { status: 500 });
  }

  const supabase = createClient(projectUrl, serviceRoleKey);
  const { error: upsertError } = await supabase
    .from("facebook_page_connections")
    .upsert({
      user_id: payload.uid,
      page_id: selectedPage.id,
      page_name: selectedPage.name ?? "",
      page_access_token: selectedPage.access_token,
    }, { onConflict: "page_id" });

  if (upsertError) {
    return new Response(`Failed to save page: ${upsertError.message}`, { status: 500 });
  }

  const redirectTo = payload.redirect_to || "";
  if (redirectTo) {
    return new Response(null, { status: 302, headers: { Location: redirectTo } });
  }

  return new Response("Facebook Page connected. You can close this window.", { status: 200 });
});
