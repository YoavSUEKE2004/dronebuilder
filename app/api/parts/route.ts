import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fallbackParts from '@/lib/fallback-parts.json';

export const runtime = 'nodejs';

const NEXAR_API_URL = 'https://api.nexar.com/graphql';
const NEXAR_TOKEN_URL = 'https://identity.nexar.com/connect/token';
const CACHE_STALE_MS = 7 * 24 * 60 * 60 * 1000;

// ============================================================
// DEFAULT BROAD QUERIES PER CATEGORY — short, generic terms
// ============================================================

const DEFAULT_QUERIES: Record<string, string> = {
  frame: 'FPV frame',
  motor: 'brushless motor',
  esc: 'ESC',
  flight_controller: 'flight controller',
  propeller: 'FPV propeller',
  battery: 'lipo battery',
  camera: 'FPV camera',
  vtx: 'VTX',
  receiver: 'ELRS',
  goggles: 'FPV goggles',
  remote: 'radio controller',
};

function getDefaultQuery(category: string): string {
  return DEFAULT_QUERIES[category] || category;
}

// ============================================================
// SUPABASE SERVER CLIENT
// ============================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseServer = createClient(supabaseUrl!, supabaseServiceKey!, {
  auth: { persistSession: false },
});

// ============================================================
// TYPES
// ============================================================

type FallbackPart = {
  id: string;
  name: string;
  category: string;
  brand: string;
  mpn: string;
  price: number;
  store_name: string;
  product_url: string;
  image_url: string;
  dimensions_mm: string;
  mounting_pattern: string;
  weight_g: number;
  shipping_days: number;
  shipping_cost: number;
  quality_score: number;
  specs: Record<string, unknown>;
};

type CachedNexarPart = {
  id: string;
  mpn: string;
  category: string;
  search_term: string | null;
  name: string;
  manufacturer: string | null;
  description: string | null;
  brand: string | null;
  image_url: string | null;
  datasheet_url: string | null;
  price: number | null;
  currency: string;
  specs: Record<string, unknown>;
  offers: Array<{
    seller: string;
    url: string;
    inStock: number | null;
    price: number | null;
    currency: string;
  }>;
  quality_score: number;
  stock_status: string;
  updated_at: string;
  created_at: string;
};

type NormalizedPart = {
  id: string;
  name: string;
  manufacturer: string;
  mpn: string;
  description: string | null;
  datasheetUrl: string | null;
  image_url: string | null;
  category: string;
  price: number | null;
  currency: string;
  source: 'cache' | 'nexar' | 'stale-cache' | 'fallback';
  offers: Array<{
    seller: string;
    url: string;
    inStock: number | null;
    price: number | null;
    currency: string;
  }>;
  specs: Record<string, unknown>;
  quality_score: number;
  stock_status: string;
};

type NexarTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

type NexarGraphQLResponse = {
  data?: {
    supSearch?: {
      hits?: Array<{ part: NexarPart }>;
    };
  };
  errors?: Array<{ message: string }>;
};

type NexarPart = {
  id: string;
  name: string;
  manufacturer: { name: string } | null;
  mpn: string;
  description: string | null;
  datasheetUrl: string | null;
  bestImage: { url: string } | null;
  medianPrice: { price: number; currency: string } | null;
  offers: Array<{
    seller: { name: string } | null;
    url: string;
    clickUrl: string | null;
    inventory: number | null;
    prices: Array<{ price: number; currency: string; quantity: number }> | null;
  }>;
};

// ============================================================
// FALLBACK CATALOG
// ============================================================

const FALLBACK_PARTS = fallbackParts as FallbackPart[];

function getFallbackParts(category: string, query: string, limit: number): NormalizedPart[] {
  const q = query.toLowerCase().trim();
  const parts = FALLBACK_PARTS.filter((p) => {
    if (category && p.category !== category) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.mpn.toLowerCase().includes(q) ||
      p.store_name.toLowerCase().includes(q)
    );
  });
  return parts.slice(0, limit).map((p) => ({
    id: p.id,
    name: p.name,
    manufacturer: p.brand,
    mpn: p.mpn,
    description: null,
    datasheetUrl: null,
    image_url: p.image_url || null,
    category: p.category,
    price: p.price,
    currency: 'USD',
    source: 'fallback' as const,
    offers: [{
      seller: p.store_name,
      url: p.product_url,
      inStock: null,
      price: p.price,
      currency: 'USD',
    }],
    specs: p.specs,
    quality_score: p.quality_score,
    stock_status: 'unknown',
  }));
}

// ============================================================
// NEXAR AUTH
// ============================================================

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getNexarToken(): Promise<string> {
  const clientId = process.env.NEXAR_CLIENT_ID;
  const clientSecret = process.env.NEXAR_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[Nexar] No NEXAR_CLIENT_ID or NEXAR_CLIENT_SECRET configured');
    throw new Error('Nexar credentials not configured');
  }

  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'parts.search',
  });

  const res = await fetch(NEXAR_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[Nexar] Token request failed (${res.status}): ${text}`);
    throw new Error(`Nexar token request failed (${res.status})`);
  }

  const data = (await res.json()) as NexarTokenResponse;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

// ============================================================
// SUPABASE CACHE LOOKUP
// ============================================================

async function getCachedParts(
  searchTerm: string,
  category: string,
  freshOnly: boolean,
  offset: number,
  limit: number
): Promise<{ parts: CachedNexarPart[]; isStale: boolean; totalInCategory: number }> {
  let query = supabaseServer
    .from('cached_nexar_parts')
    .select('*', { count: 'exact' });

  if (category) {
    query = query.eq('category', category);
  }
  if (searchTerm) {
    query = query.or(`search_term.ilike.%${searchTerm}%,mpn.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`);
  }

  const { data, error, count } = await query
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[Supabase] Cache query error:', error.message);
  }

  if (error || !data || data.length === 0) {
    const { count: categoryCount } = await supabaseServer
      .from('cached_nexar_parts')
      .select('*', { count: 'exact', head: true })
      .eq('category', category);
    return { parts: [], isStale: false, totalInCategory: categoryCount || 0 };
  }

  const cachedRows = data as CachedNexarPart[];
  const staleCutoff = Date.now() - CACHE_STALE_MS;

  const fresh = cachedRows.filter(
    (row) => new Date(row.updated_at).getTime() > staleCutoff
  );

  if (fresh.length > 0) {
    return { parts: fresh, isStale: false, totalInCategory: count || 0 };
  }

  return { parts: freshOnly ? [] : cachedRows, isStale: cachedRows.length > 0, totalInCategory: count || 0 };
}

// ============================================================
// UPSERT TO SUPABASE
// ============================================================

async function upsertCachedParts(
  parts: NormalizedPart[],
  searchTerm: string
): Promise<void> {
  if (parts.length === 0) return;

  const rows = parts.map((p) => ({
    mpn: p.mpn,
    category: p.category || 'unknown',
    search_term: searchTerm,
    name: p.name,
    manufacturer: p.manufacturer,
    description: p.description,
    brand: p.manufacturer,
    image_url: p.image_url,
    datasheet_url: p.datasheetUrl,
    price: p.price,
    currency: p.currency,
    specs: p.specs || {},
    offers: p.offers || [],
    quality_score: p.quality_score,
    stock_status: p.stock_status,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabaseServer
    .from('cached_nexar_parts')
    .upsert(rows, { onConflict: 'mpn,category' });

  if (error) {
    console.error('[Supabase] Upsert error:', error.message);
  }
}

// ============================================================
// NEXAR FETCH — with error logging
// ============================================================

async function fetchNexarParts(
  searchTerm: string,
  category: string,
  limit: number
): Promise<NormalizedPart[]> {
  const clientId = process.env.NEXAR_CLIENT_ID;
  const clientSecret = process.env.NEXAR_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[Nexar] Skipping fetch — credentials not configured');
    return [];
  }

  try {
    const token = await getNexarToken();

    const gqlQuery = `
      query SearchParts($search: String!, $limit: Int!) {
        supSearch(q: $search, limit: $limit) {
          hits {
            part {
              id
              name
              manufacturer { name }
              mpn
              description
              datasheetUrl
              bestImage { url }
              medianPrice { price currency }
              offers {
                seller { name }
                url
                clickUrl
                inventory
                prices { price currency quantity }
              }
            }
          }
        }
      }
    `;

    const payload = JSON.stringify({
      query: gqlQuery,
      variables: { search: searchTerm, limit },
    });

    console.log(`[Nexar] Querying: search="${searchTerm}", category="${category}", limit=${limit}`);

    const res = await fetch(NEXAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: payload,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Nexar] API error (${res.status}): ${text}`);
      console.error(`[Nexar] Query payload: ${payload}`);
      return [];
    }

    const result = (await res.json()) as NexarGraphQLResponse;

    if (result.errors && result.errors.length > 0) {
      console.error(`[Nexar] GraphQL errors:`, result.errors);
      console.error(`[Nexar] Query payload: ${payload}`);
      return [];
    }

    const hits = result.data?.supSearch?.hits || [];

    if (hits.length === 0) {
      console.warn(`[Nexar] Zero results for search="${searchTerm}", category="${category}"`);
      console.warn(`[Nexar] Query payload: ${payload}`);
    } else {
      console.log(`[Nexar] Got ${hits.length} results for search="${searchTerm}"`);
    }

    return hits.map((hit) => {
      const part = hit.part;
      const offers = (part.offers || []).map((offer) => ({
        seller: offer.seller?.name || '',
        url: offer.url,
        inStock: offer.inventory ?? null,
        price: offer.prices?.[0]?.price ?? null,
        currency: offer.prices?.[0]?.currency || 'USD',
      }));

      const totalStock = offers.reduce((sum, o) => sum + (o.inStock ?? 0), 0);
      const stockStatus = totalStock > 10 ? 'in_stock' : totalStock > 0 ? 'low_stock' : 'unknown';

      return {
        id: part.id,
        name: part.name,
        manufacturer: part.manufacturer?.name || '',
        mpn: part.mpn,
        description: part.description,
        datasheetUrl: part.datasheetUrl,
        image_url: part.bestImage?.url || null,
        category: category || '',
        price: part.medianPrice?.price ?? null,
        currency: part.medianPrice?.currency || 'USD',
        source: 'nexar' as const,
        offers,
        specs: {},
        quality_score: 5,
        stock_status: stockStatus,
      };
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Nexar] Fetch failed for search="${searchTerm}": ${msg}`);
    return [];
  }
}

// ============================================================
// CONVERT CACHE ROW → NORMALIZED PART
// ============================================================

function cacheRowToPart(row: CachedNexarPart, source: 'cache' | 'stale-cache'): NormalizedPart {
  return {
    id: row.id,
    name: row.name,
    manufacturer: row.manufacturer || row.brand || '',
    mpn: row.mpn,
    description: row.description,
    datasheetUrl: row.datasheet_url,
    image_url: row.image_url,
    category: row.category,
    price: row.price !== null ? Number(row.price) : null,
    currency: row.currency || 'USD',
    source,
    offers: row.offers || [],
    specs: row.specs || {},
    quality_score: row.quality_score || 5,
    stock_status: row.stock_status || 'unknown',
  };
}

// ============================================================
// FALLBACK: get any cached parts in a category (ignore search term)
// ============================================================

async function getAnyCategoryParts(category: string, limit: number): Promise<NormalizedPart[]> {
  const { data, error } = await supabaseServer
    .from('cached_nexar_parts')
    .select('*')
    .eq('category', category)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as CachedNexarPart[]).map((row) => cacheRowToPart(row, 'stale-cache'));
}

// ============================================================
// ROUTE HANDLER
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || searchParams.get('query') || '';
    const category = searchParams.get('category') || '';
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const isCustomSearch = !!query;

    if (!query && !category) {
      return NextResponse.json(
        { error: 'Provide a search query via the "q" or "category" parameter' },
        { status: 400 }
      );
    }

    const searchTerm = query || getDefaultQuery(category);

    // 1. Check Supabase cache first — fresh data
    const { parts: freshCached, isStale, totalInCategory } = await getCachedParts(searchTerm, category, true, offset, limit);

    if (freshCached.length > 0) {
      const parts = freshCached.slice(0, limit).map((row) => cacheRowToPart(row, 'cache'));
      return NextResponse.json({
        parts,
        count: parts.length,
        source: 'cache',
        offset,
        limit,
        hasMore: totalInCategory > offset + limit,
      });
    }

    // 2. No fresh cache — call Nexar live
    const nexarParts = await fetchNexarParts(searchTerm, category, limit);

    if (nexarParts.length > 0) {
      await upsertCachedParts(nexarParts, searchTerm);
      const parts = nexarParts.slice(0, limit);
      return NextResponse.json({
        parts,
        count: parts.length,
        source: 'nexar',
        offset,
        limit,
        hasMore: parts.length === limit,
      });
    }

    // 3. Nexar failed/empty — try stale cache for this search
    if (isStale) {
      const { parts: staleParts } = await getCachedParts(searchTerm, category, false, offset, limit);
      if (staleParts.length > 0) {
        const parts = staleParts.slice(0, limit).map((row) => cacheRowToPart(row, 'stale-cache'));
        return NextResponse.json({
          parts,
          count: parts.length,
          source: 'stale-cache',
          warning: 'Live data unavailable, showing cached results',
          offset,
          limit,
          hasMore: false,
        });
      }
    }

    // 4. Try any cached parts in this category regardless of search term
    if (category) {
      const anyParts = await getAnyCategoryParts(category, limit);
      if (anyParts.length > 0) {
        return NextResponse.json({
          parts: anyParts,
          count: anyParts.length,
          source: 'stale-cache',
          warning: 'No exact match found, showing other cached parts in this category',
          offset: 0,
          limit,
          hasMore: false,
        });
      }
    }

    // 5. LAST RESORT — inject pre-seeded fallback catalog (never show empty screen on initial load)
    const fallback = getFallbackParts(category, query, limit);
    if (fallback.length > 0) {
      // Also upsert fallback into Supabase so future queries hit cache
      await upsertCachedParts(fallback, searchTerm);

      return NextResponse.json({
        parts: fallback,
        count: fallback.length,
        source: 'fallback',
        warning: isCustomSearch
          ? 'No live results found. Showing catalog fallback parts.'
          : 'Showing default catalog. Live pricing may be unavailable.',
        offset: 0,
        limit,
        hasMore: false,
      });
    }

    // 6. Absolute last resort — empty (only reached if fallback catalog has no match for category)
    return NextResponse.json({
      parts: [],
      count: 0,
      source: 'empty',
      warning: isCustomSearch
        ? 'No parts found for your search. Try a different term.'
        : 'No parts available for this category.',
      offset,
      limit,
      hasMore: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch parts';
    console.error('[Parts API] Unhandled error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
