import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('canonical_parts')
      .select('*, vendor_listings(*)')
      .order('updated_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const parts = (data || []).map((p) => {
      const listings = p.vendor_listings || [];
      const buyPrices = listings.map((l: any) => Number(l.buy_price)).filter((v: number) => v > 0);
      const sellPrices = listings.map((l: any) => Number(l.sell_price)).filter((v: number) => v > 0);
      return {
        ...p,
        vendor_listings: listings,
        min_buy_price: buyPrices.length > 0 ? Math.min(...buyPrices) : null,
        min_sell_price: sellPrices.length > 0 ? Math.min(...sellPrices) : null,
        max_sell_price: sellPrices.length > 0 ? Math.max(...sellPrices) : null,
        vendor_count: listings.length,
        any_in_stock: listings.some((l: any) => l.in_stock),
      };
    });

    return NextResponse.json({ parts });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { listingId, updates } = body;

    if (!listingId || !updates) {
      return NextResponse.json({ error: 'Missing listingId or updates' }, { status: 400 });
    }

    const allowed: Record<string, any> = {};
    if ('sell_price' in updates) allowed.sell_price = Number(updates.sell_price);
    if ('buy_price' in updates) allowed.buy_price = Number(updates.buy_price);
    if ('in_stock' in updates) allowed.in_stock = Boolean(updates.in_stock);
    if ('url' in updates) allowed.url = String(updates.url);
    if ('vendor_name' in updates) allowed.vendor_name = String(updates.vendor_name);

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { error } = await supabase
      .from('vendor_listings')
      .update(allowed)
      .eq('id', listingId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
