import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const NEXAR_API_URL = 'https://api.nexar.com/graphql';
const NEXAR_TOKEN_URL = 'https://identity.nexar.com/connect/token';
const CACHE_STALE_MS = 7 * 24 * 60 * 60 * 1000;

const DEFAULT_QUERIES: Record<string, string> = {
  frame: 'FPV frame',
  motor: 'brushless motor',
  esc: 'ESC 4in1',
  flight_controller: 'flight controller FC',
  propeller: 'FPV propeller',
  battery: 'lipo battery',
  camera: 'FPV camera',
  vtx: 'VTX 5.8GHz',
  receiver: 'ELRS receiver',
  goggles: 'FPV goggles',
  remote: 'radio controller FPV',
};

function getDefaultQuery(category: string): string {
  return DEFAULT_QUERIES[category] || category;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseServer = createClient(supabaseUrl!, supabaseServiceKey!, {
  auth: { persistSession: false },
});

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
  source: 'cache' | 'nexar' | 'stale-cache';
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

type NexarSeller = {
  company: { name: string } | null;
  offers: Array<{
    clickUrl: string | null;
    inventory: number | null;
    prices: Array<{ price: number; currency: string; quantity: number }> | null;
  }> | null;
};

type NexarPart = {
  mpn: string;
  name: string | null;
  manufacturer: { name: string } | null;
  descriptions: Array<{ text: string }> | null;
  bestDatasheet: { url: string } | null;
  bestImage: { url: string } | null;
  medianPrice: { price: number; currency: string } | null;
  sellers: NexarSeller[] | null;
};

type NexarGraphQLResponse = {
  data?: {
    supSearch?: {
      results: Array<{ part: NexarPart }> | null;
    };
  };
  errors?: Array<{ message: string }>;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getNexarToken(): Promise<string> {
  const clientId = process.env.NEXAR_CLIENT_ID;
  const clientSecret = process.env.NEXAR_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('NEXAR_CLIENT_ID or NEXAR_CLIENT_SECRET is missing');
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
    throw new Error(`Nexar OAuth failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as NexarTokenResponse;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

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

  if (category) query = query.eq('category', category);
  if (searchTerm) {
    query = query.or(`search_term.ilike.%${searchTerm}%,mpn.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`);
  }

  const { data, error, count } = await query
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) console.error('[Supabase] Cache query error:', error.message);

  if (error || !data || data.length === 0) {
    const { count: categoryCount } = await supabaseServer
      .from('cached_nexar_parts')
      .select('*', { count: 'exact', head: true })
      .eq('category', category);
    return { parts: [], isStale: false, totalInCategory: categoryCount || 0 };
  }

  const cachedRows = data as CachedNexarPart[];
  const staleCutoff = Date.now() - CACHE_STALE_MS;
  const fresh = cachedRows.filter((r) => new Date(r.updated_at).getTime() > staleCutoff);

  if (fresh.length > 0) return { parts: fresh, isStale: false, totalInCategory: count || 0 };
  return { parts: freshOnly ? [] : cachedRows, isStale: cachedRows.length > 0, totalInCategory: count || 0 };
}

async function upsertCachedParts(parts: NormalizedPart[], searchTerm: string): Promise<void> {
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

  if (error) console.error('[Supabase] Upsert error:', error.message);
}

async function fetchNexarParts(
  searchTerm: string,
  category: string,
  limit: number
): Promise<NormalizedPart[]> {
  const clientId = process.env.NEXAR_CLIENT_ID;
  const clientSecret = process.env.NEXAR_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      `Nexar credentials not configured on the server. ` +
      `Ensure NEXAR_CLIENT_ID and NEXAR_CLIENT_SECRET are set in the server environment. ` +
      `(ID present: ${!!clientId}, Secret present: ${!!clientSecret})`
    );
  }

  const token = await getNexarToken();

  const gqlQuery = `
    query SearchParts($q: String!, $limit: Int!) {
      supSearch(q: $q, limit: $limit) {
        results {
          part {
            mpn
            name
            manufacturer { name }
            descriptions { text }
            bestDatasheet { url }
            bestImage { url }
            medianPrice { price currency }
            sellers {
              company { name }
              offers {
                clickUrl
                inventory
                prices { price currency quantity }
              }
            }
          }
        }
      }
    }
  `;

  const payload = JSON.stringify({ query: gqlQuery, variables: { q: searchTerm, limit } });

  console.log(`[Nexar] Querying: q="${searchTerm}", category="${category}", limit=${limit}`);

  const res = await fetch(NEXAR_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: payload,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Nexar API error (${res.status}): ${text}`);
  }

  const result = (await res.json()) as NexarGraphQLResponse;

  if (result.errors && result.errors.length > 0) {
    const messages = result.errors.map((e) => e.message).join('; ');
    throw new Error(`Nexar GraphQL errors: ${messages}`);
  }

  const results = result.data?.supSearch?.results || [];

  if (results.length === 0) {
    console.warn(`[Nexar] Zero results for q="${searchTerm}", category="${category}"`);
  } else {
    console.log(`[Nexar] Got ${results.length} results for q="${searchTerm}"`);
  }

  return results.map((r) => {
    const part = r.part;
    const sellers = part.sellers || [];
    const offers = sellers.flatMap((s) =>
      (s.offers || []).map((offer) => ({
        seller: s.company?.name || '',
        url: offer.clickUrl || '',
        inStock: offer.inventory ?? null,
        price: offer.prices?.[0]?.price ?? null,
        currency: offer.prices?.[0]?.currency || 'USD',
      }))
    );

    const totalStock = offers.reduce((sum, o) => sum + (o.inStock ?? 0), 0);
    const stockStatus = totalStock > 10 ? 'in_stock' : totalStock > 0 ? 'low_stock' : 'unknown';
    const description = part.descriptions?.[0]?.text ?? null;

    return {
      id: part.mpn,
      name: part.name || part.mpn,
      manufacturer: part.manufacturer?.name || '',
      mpn: part.mpn,
      description,
      datasheetUrl: part.bestDatasheet?.url || null,
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
}

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

async function getAnyCategoryParts(category: string, limit: number): Promise<NormalizedPart[]> {
  const { data } = await supabaseServer
    .from('cached_nexar_parts')
    .select('*')
    .eq('category', category)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (!data) return [];
  return (data as CachedNexarPart[]).map((r) => cacheRowToPart(r, 'stale-cache'));
}

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

    // 1. Check Supabase cache — fresh data
    const { parts: freshCached, isStale, totalInCategory } = await getCachedParts(searchTerm, category, true, offset, limit);

    if (freshCached.length > 0) {
      const parts = freshCached.slice(0, limit).map((r) => cacheRowToPart(r, 'cache'));
      return NextResponse.json({
        parts, count: parts.length, source: 'cache', offset, limit,
        hasMore: totalInCategory > offset + limit,
      });
    }

    // 2. Live Nexar fetch — will throw on missing keys or auth failure
    let nexarError: string | null = null;
    let nexarParts: NormalizedPart[] = [];

    try {
      nexarParts = await fetchNexarParts(searchTerm, category, limit);
    } catch (err) {
      nexarError = err instanceof Error ? err.message : String(err);
      console.error('[Parts API] Nexar fetch error:', nexarError);
    }

    if (nexarParts.length > 0) {
      await upsertCachedParts(nexarParts, searchTerm);
      return NextResponse.json({
        parts: nexarParts.slice(0, limit), count: nexarParts.length,
        source: 'nexar', offset, limit,
        hasMore: nexarParts.length === limit,
      });
    }

    // 3. Try stale cache
    if (isStale) {
      const { parts: staleParts } = await getCachedParts(searchTerm, category, false, offset, limit);
      if (staleParts.length > 0) {
        const parts = staleParts.slice(0, limit).map((r) => cacheRowToPart(r, 'stale-cache'));
        return NextResponse.json({
          parts, count: parts.length, source: 'stale-cache',
          warning: 'Live data unavailable, showing cached results',
          offset, limit, hasMore: false,
        });
      }
    }

    // 4. Any cached parts in category
    if (category) {
      const anyParts = await getAnyCategoryParts(category, limit);
      if (anyParts.length > 0) {
        return NextResponse.json({
          parts: anyParts, count: anyParts.length, source: 'stale-cache',
          warning: 'No exact match found, showing other cached parts in this category',
          offset: 0, limit, hasMore: false,
        });
      }
    }

    // 5. No data at all — return explicit error
    return NextResponse.json({
      parts: [],
      count: 0,
      source: 'empty',
      error: nexarError || (isCustomSearch
        ? 'No parts found for your search. Try a different term.'
        : 'No parts available for this category.'),
      offset, limit, hasMore: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch parts';
    console.error('[Parts API] Unhandled error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
