import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

type PricingItem = {
  egg_size: string;
  price_per_tray: number | string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get("N8N_WEBHOOK_SECRET");
    if (webhookSecret) {
      const provided = req.headers.get("x-webhook-secret");
      if (provided !== webhookSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const {
      name,
      is_active,
      wholesale_discount,
      wholesale_min_trays,
      items,
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "items array is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("PROJECT_URL")!;
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("role", "owner")
      .limit(1);

    const ownerId = profiles?.[0]?.user_id ?? null;

    const { data: pricingSet, error: setError } = await supabase
      .from("pricing_sets")
      .insert({
        name: name || "Owner Pricing Update",
        is_active: is_active !== false,
        wholesale_discount: Number(wholesale_discount ?? 20),
        wholesale_min_trays: Number(wholesale_min_trays ?? 10),
        created_by: ownerId,
      })
      .select()
      .single();

    if (setError) {
      throw new Error(`Pricing set insert failed: ${setError.message}`);
    }

    const pricingItems = (items as PricingItem[]).map((item) => ({
      pricing_set_id: pricingSet.id,
      egg_size: item.egg_size,
      price_per_tray: Number(item.price_per_tray ?? 0),
    }));

    const { error: itemsError } = await supabase
      .from("pricing_set_items")
      .insert(pricingItems);

    if (itemsError) {
      throw new Error(`Pricing items insert failed: ${itemsError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, pricing_set_id: pricingSet.id }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Pricing webhook error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
