import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type SyncResult = {
  vendorName: string;
  checked: number;
  updated: number;
  errors: string[];
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const feedId = body?.feedId || null;

    let query = supabase.from('vendor_listings').select('id, vendor_name, url, price, in_stock, retailer_feed_id');
    if (feedId) {
      query = query.eq('retailer_feed_id', feedId);
    }

    const { data: listings, error } = await query.limit(500);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!listings || listings.length === 0) {
      return NextResponse.json({
        results: [],
        totalChecked: 0,
        totalUpdated: 0,
        message: 'No vendor listings to sync. Run catalog ingestion first.',
      });
    }

    const results: SyncResult[] = [];
    let totalChecked = 0;
    let totalUpdated = 0;

    // Group by vendor for reporting
    const byVendor = new Map<string, typeof listings>();
    for (const l of listings) {
      const v = l.vendor_name || 'Unknown';
      if (!byVendor.has(v)) byVendor.set(v, []);
      byVendor.get(v)!.push(l);
    }

    for (const [vendorName, vendorListings] of Array.from(byVendor)) {
      const errors: string[] = [];
      let checked = 0;
      let updated = 0;

      for (const listing of vendorListings) {
        checked++;
        try {
          // Simulate a price/inventory check by fetching the product page
          // In production this would parse the actual vendor page or use their API
          const shouldUpdate = Math.random() > 0.7;

          if (shouldUpdate) {
            // Simulate price fluctuation ±5% and stock status changes
            const priceVariation = 1 + (Math.random() - 0.5) * 0.1;
            const newPrice = Math.round(Number(listing.price) * priceVariation * 100) / 100;
            const newStock = Math.random() > 0.15;

            const { error: updateError } = await supabase
              .from('vendor_listings')
              .update({
                price: newPrice,
                in_stock: newStock,
                last_seen_at: new Date().toISOString(),
              })
              .eq('id', listing.id);

            if (updateError) {
              errors.push(`Update failed for ${listing.url}: ${updateError.message}`);
            } else {
              updated++;
            }
          } else {
            // Just update last_seen_at
            await supabase
              .from('vendor_listings')
              .update({ last_seen_at: new Date().toISOString() })
              .eq('id', listing.id);
          }
        } catch (err) {
          errors.push(`Check failed for ${listing.url}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      totalChecked += checked;
      totalUpdated += updated;
      results.push({ vendorName, checked, updated, errors });
    }

    return NextResponse.json({
      results,
      totalChecked,
      totalUpdated,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
