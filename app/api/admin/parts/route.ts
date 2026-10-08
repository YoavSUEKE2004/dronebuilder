import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name, brand, category, imageUrl,
      mountingPattern, voltageRange, maxCurrent, mcu, weightG, videoStandard,
      vendorName, supplierUrl, buyPrice, sellPrice, inStock,
    } = body;

    if (!name || !category || !vendorName || !supplierUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: name, category, vendorName, supplierUrl' },
        { status: 400 }
      );
    }

    const { data: part, error: partError } = await supabase
      .from('canonical_parts')
      .insert({
        name,
        brand: brand || '',
        manufacturer: brand || '',
        category,
        image_url: imageUrl || '',
        mounting_pattern: mountingPattern || '',
        voltage_range: voltageRange || '',
        max_current: maxCurrent || null,
        weight_g: weightG || 0,
        mcu: mcu || '',
        video_system: videoStandard || null,
        spec_verified: true,
        quality_score: 5,
        normalized_key: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      })
      .select('id')
      .single();

    if (partError) {
      return NextResponse.json({ error: partError.message }, { status: 500 });
    }

    const { error: listingError } = await supabase
      .from('vendor_listings')
      .insert({
        canonical_part_id: part.id,
        vendor_name: vendorName,
        title: name,
        url: supplierUrl,
        buy_price: buyPrice || null,
        sell_price: sellPrice || 0,
        price: sellPrice || 0,
        in_stock: inStock ?? true,
        currency: 'USD',
      });

    if (listingError) {
      return NextResponse.json({ error: listingError.message, partId: part.id }, { status: 500 });
    }

    return NextResponse.json({ ok: true, partId: part.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
