import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, Stripe-Signature",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const signature = req.headers.get("Stripe-Signature") ?? "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

  let event: Stripe.Event;

  try {
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Invalid signature" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const transferGroup = session.payment_intent
        ? (typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent.id)
        : "";

      // Retrieve line items to determine vendor splits
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);

      // Group parts by store_name to determine vendor transfers
      const vendorTotals: Record<string, number> = {};
      let builderFeeTotal = 0;

      for (const item of lineItems.data) {
        const productName = item.price?.product_data?.name ?? "";
        const metadata = item.price?.metadata ?? {};

        if (metadata.type === "platform_fee") continue;

        if (metadata.type === "assembly_fee") {
          builderFeeTotal += (item.amount_total ?? 0) / 100;
          continue;
        }

        const storeName = metadata.store_name || "Platform";
        if (!vendorTotals[storeName]) vendorTotals[storeName] = 0;
        vendorTotals[storeName] += (item.amount_total ?? 0) / 100;
      }

      // Transfer parts payments to vendor connected accounts
      // Each vendor must have a Stripe connected account stored in the
      // stores table (or mapped by store_name).
      for (const [storeName, amount] of Object.entries(vendorTotals)) {
        const { data: vendorAccount } = await supabase
          .from("vendor_stripe_accounts")
          .select("stripe_account_id")
          .eq("store_name", storeName)
          .single();

        if (vendorAccount?.stripe_account_id && amount > 0) {
          await stripe.transfers.create({
            amount: Math.round(amount * 100),
            currency: "usd",
            destination: vendorAccount.stripe_account_id,
            transfer_group: transferGroup,
            metadata: { store_name: storeName, type: "parts_payment" },
          });
        }
      }

      // Transfer assembly fee to builder's connected account
      if (builderFeeTotal > 0 && session.metadata?.builder_id) {
        const { data: builder } = await supabase
          .from("builders")
          .select("stripe_account_id")
          .eq("id", session.metadata.builder_id)
          .single();

        if (builder?.stripe_account_id) {
          await stripe.transfers.create({
            amount: Math.round(builderFeeTotal * 100),
            currency: "usd",
            destination: builder.stripe_account_id,
            transfer_group: transferGroup,
            metadata: { builder_id: session.metadata.builder_id, type: "assembly_fee" },
          });
        }
      }

      // Update build status
      if (session.metadata?.selected_parts) {
        await supabase
          .from("builds")
          .update({ build_status: "assembling" })
          .eq("selected_parts", session.metadata.selected_parts);
      }

      break;
    }

    case "payment_intent.payment_failed": {
      console.log("Payment failed for session");
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
