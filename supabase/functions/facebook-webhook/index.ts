import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

async function sendReply(pageAccessToken: string, psid: string, text: string) {
  const url = new URL("https://graph.facebook.com/v19.0/me/messages");
  url.searchParams.set("access_token", pageAccessToken);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: psid },
      message: { text },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Send API error ${res.status}: ${body}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const verifyToken = Deno.env.get("FB_VERIFY_TOKEN") ?? "";
  const n8nSecret = Deno.env.get("N8N_WEBHOOK_SECRET") ?? "";

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const projectUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  if (!projectUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Supabase env vars missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
  const supabase = createClient(projectUrl, serviceRoleKey);

  const body = await req.json().catch(() => null);
  if (!body || body.object !== "page" || !Array.isArray(body.entry)) {
    // Allow direct ingest from n8n with a simplified payload
    const isN8nPayload = body && typeof body === "object" && "page_id" in body && "sender_psid" in body;
    if (!isN8nPayload) {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders });
    }
  }

  const autoReplyEnabled = (Deno.env.get("FB_AUTO_REPLY_ENABLED") ?? "false") === "true";
  const autoReplyText = Deno.env.get("FB_AUTO_REPLY_TEXT") ??
    "Thanks for your message! We received it and will reply shortly.";

  const handleInboundMessage = async (pageId: string, senderId: string, text: string, timestamp: string, raw: unknown) => {
    const { data: connection } = await supabase
      .from("facebook_page_connections")
      .select("user_id,page_access_token")
      .eq("page_id", pageId)
      .maybeSingle();

    if (!connection) return;

    await supabase.from("facebook_messages").insert({
      user_id: connection.user_id,
      page_id: pageId,
      sender_psid: senderId,
      message_text: text,
      direction: "inbound",
      message_ts: timestamp,
      raw,
    });

    if (autoReplyEnabled && text) {
      try {
        await sendReply(connection.page_access_token, senderId, autoReplyText);
        await supabase.from("facebook_messages").insert({
          user_id: connection.user_id,
          page_id: pageId,
          sender_psid: senderId,
          message_text: autoReplyText,
          direction: "outbound",
          message_ts: new Date().toISOString(),
          raw: { auto_reply: true },
        });
      } catch (err) {
        console.error("Auto-reply failed", err);
      }
    }
  };

  // N8N simplified ingest path
  if (body && typeof body === "object" && "page_id" in body && "sender_psid" in body) {
    if (n8nSecret) {
      const headerSecret = req.headers.get("x-n8n-secret") ?? "";
      if (headerSecret !== n8nSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
      }
    }

    const pageId = String(body.page_id ?? "");
    const senderId = String(body.sender_psid ?? "");
    const text = typeof body.message_text === "string" ? body.message_text : "";
    const ts = body.message_ts ? new Date(Number(body.message_ts)).toISOString() : new Date().toISOString();

    if (pageId && senderId) {
      await handleInboundMessage(pageId, senderId, text, ts, body);
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders });
  }

  for (const entry of body.entry) {
    const pageId = entry.id;
    const events = Array.isArray(entry.messaging) ? entry.messaging : [];

    if (!pageId || events.length === 0) continue;

    for (const event of events) {
      const senderId = event?.sender?.id;
      const text = event?.message?.text ?? "";
      const timestamp = event?.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString();

      if (!senderId) continue;
      await handleInboundMessage(pageId, senderId, text, timestamp, event);
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders });
});
