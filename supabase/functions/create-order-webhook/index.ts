import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Optional: verify a shared secret header
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
      customer_name,
      customer_contact,
      total_amount,
      notes,
      status,
      items,
    } = body;

    if (!customer_name) {
      return new Response(
        JSON.stringify({ error: "customer_name is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("PROJECT_URL")!;
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get the first user (farm owner) as the order owner
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("role", "owner")
      .limit(1);

    const userId = profiles?.[0]?.user_id;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "No owner profile found. Please register first." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Insert order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        customer_name,
        customer_contact: customer_contact || "",
        total_amount: parseFloat(total_amount) || 0,
        notes: notes || "",
        status: status || "pending",
      })
      .select()
      .single();

    if (orderError) {
      throw new Error(`Order insert failed: ${orderError.message}`);
    }

    // Insert order items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      const orderItems = items.map((item: any) => ({
        order_id: order.id,
        product_name: item.product_name || "Eggs",
        quantity: parseFloat(item.quantity) || 0,
        unit_price: parseFloat(item.unit_price) || 0,
        subtotal: parseFloat(item.subtotal) || 0,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) {
        console.error("Order items insert error:", itemsError.message);
      }
    }

    return new Response(
      JSON.stringify({ success: true, order_id: order.id, order }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
