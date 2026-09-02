import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PLATFORM_COMMISSION_RATE = 0.05;

interface CheckoutRequest {
  selectedParts: Record<string, string | null>;
  fulfillmentType: "kit" | "builder";
  builderId: string | null;
  builderFee: number;
  partsTotal: number;
  platformFee: number;
  grandTotal: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: CheckoutRequest = await req.json();

    // Fetch component details for all selected parts
    const componentIds = Object.values(body.selectedParts).filter(
      (id): id is string => id !== null
    );
    const { data: components } = await supabase
      .from("components")
      .select("id, name, price, store_name")
      .in("id", componentIds);

    if (!components || components.length === 0) {
      return new Response(JSON.stringify({ error: "No components found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group components by store_name to determine vendor split
    // Each store_name maps to a vendor Stripe connected account
    const vendorGroups: Record<string, typeof components> = {};
    for (const comp of components) {
      const store = comp.store_name || "Platform";
      if (!vendorGroups[store]) vendorGroups[store] = [];
      vendorGroups[store].push(comp);
    }

    // Build line items for the Checkout Session
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    // Parts line items (one per component)
    for (const comp of components) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: comp.name,
            metadata: { store_name: comp.store_name, component_id: comp.id },
          },
          unit_amount: Math.round(Number(comp.price) * 100),
        },
        quantity: 1,
      });
    }

    // Builder assembly fee line item
    if (body.fulfillmentType === "builder" && body.builderId && body.builderFee > 0) {
      const { data: builder } = await supabase
        .from("builders")
        .select("id, location, stripe_account_id")
        .eq("id", body.builderId)
        .single();

      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: `Assembly Service — ${builder?.location ?? "Builder"}`,
            metadata: { builder_id: body.builderId, type: "assembly_fee" },
          },
          unit_amount: Math.round(body.builderFee * 100),
        },
        quantity: 1,
      });
    }

    // Platform commission line item
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: "Platform Commission",
          metadata: { type: "platform_fee" },
        },
        unit_amount: Math.round(body.platformFee * 100),
      },
      quantity: 1,
    });

    // Create Checkout Session with destination charges
    // The total charge goes to the platform account, then we use
    // transfer_data to route portions to connected accounts.
    //
    // For Stripe Connect destination charges, we set transfer_data
    // on the session to send funds to the appropriate account.
    // Since we have multiple vendors, we'll use separate transfers
    // after payment succeeds via the checkout.session.completed webhook.

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      payment_intent_data: {
        // Capture funds on the platform account, then distribute via transfers
        application_fee_amount: Math.round(body.platformFee * 100),
        metadata: {
          builder_id: body.builderId ?? "",
          fulfillment_type: body.fulfillmentType,
          parts_total: body.partsTotal.toString(),
          builder_fee: body.builderFee.toString(),
          platform_fee: body.platformFee.toString(),
          grand_total: body.grandTotal.toString(),
        },
        transfer_group: `drone_build_${Date.now()}`,
      },
      metadata: {
        builder_id: body.builderId ?? "",
        fulfillment_type: body.fulfillmentType,
        selected_parts: JSON.stringify(body.selectedParts),
      },
      success_url: `${req.headers.get("origin")}/?payment=success`,
      cancel_url: `${req.headers.get("origin")}/?payment=cancelled`,
    });

    // Save the build record with pending payment status
    await supabase.from("builds").insert({
      selected_parts: body.selectedParts,
      fulfillment_type: body.fulfillmentType,
      total_price: body.grandTotal,
      platform_fee_amount: body.platformFee,
      builder_id: body.fulfillmentType === "builder" ? body.builderId : null,
      build_status: "ordered",
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
