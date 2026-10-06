import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'all';
    const search = searchParams.get('search') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Fetch canonical parts with vendor listings
    let partsQuery = supabase
      .from('canonical_parts')
      .select('*, vendor_listings(*)', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category !== 'all') {
      partsQuery = partsQuery.eq('category', category);
    }
    if (search) {
      partsQuery = partsQuery.or(`name.ilike.%${search}%,mpn.ilike.%${search}%,manufacturer.ilike.%${search}%`);
    }

    const { data: partsData, error: partsError, count } = await partsQuery;

    if (partsError) {
      return NextResponse.json({ error: partsError.message }, { status: 500 });
    }

    const parts = (partsData || []).map((p) => {
      const listings = p.vendor_listings || [];
      const prices = listings.map((l: any) => l.price).filter((p: number) => p > 0);
      return {
        ...p,
        vendor_listings: listings,
        min_price: prices.length > 0 ? Math.min(...prices) : null,
        max_price: prices.length > 0 ? Math.max(...prices) : null,
        vendor_count: listings.length,
      };
    });

    // Fetch feeds
    const { data: feedsData } = await supabase
      .from('retailer_feeds')
      .select('*')
      .order('created_at', { ascending: false });

    // Fetch sync logs
    const { data: logsData } = await supabase
      .from('catalog_sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      parts,
      total: count || 0,
      feeds: feedsData || [],
      syncLogs: logsData || [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, type, url } = body;

    if (!name || !url || !type) {
      return NextResponse.json({ error: 'Missing required fields: name, type, url' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('retailer_feeds')
      .insert({ name, feed_type: type, url, is_active: true })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id, ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { partId, specs, verified } = body;

    if (!partId || !specs) {
      return NextResponse.json({ error: 'Missing partId or specs' }, { status: 400 });
    }

    const { error } = await supabase
      .from('canonical_parts')
      .update({
        detected_specs: specs,
        spec_verified: verified ?? true,
        mounting_pattern: String(specs.mounting_pattern || ''),
        weight_g: Number(specs.weight_g) || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', partId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
