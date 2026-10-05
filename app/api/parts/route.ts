import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const NEXAR_API_URL = 'https://api.nexar.com/graphql';
const NEXAR_TOKEN_URL = 'https://identity.nexar.com/connect/token';
const CACHE_STALE_MS = 7 * 24 * 60 * 60 * 1000;

// ============================================================
// SUPABASE SERVER CLIENT (service role for upserts)
// ============================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseServer = createClient(supabaseUrl!, supabaseServiceKey!, {
  auth: { persistSession: false },
});

// ============================================================
// TYPES
// ============================================================

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
// NEXAR AUTH
// ============================================================

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getNexarToken(): Promise<string> {
  const clientId = process.env.NEXAR_CLIENT_ID;
  const clientSecret = process.env.NEXAR_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('NEXAR_CLIENT_ID and NEXAR_CLIENT_SECRET must be set');
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
  freshOnly: boolean
): Promise<{ parts: CachedNexarPart[]; isStale: boolean }> {
  let query = supabaseServer
    .from('cached_nexar_parts')
    .select('*');

  if (category) {
    query = query.eq('category', category);
  }
  if (searchTerm) {
    query = query.or(`search_term.ilike.%${searchTerm}%,mpn.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`);
  }

  const { data, error } = await query.order('updated_at', { ascending: false }).limit(50);

  if (error || !data || data.length === 0) {
    return { parts: [], isStale: false };
  }

  const cachedRows = data as CachedNexarPart[];
  const staleCutoff = Date.now() - CACHE_STALE_MS;

  const fresh = cachedRows.filter(
    (row) => new Date(row.updated_at).getTime() > staleCutoff
  );

  if (fresh.length > 0) {
    return { parts: fresh, isStale: false };
  }

  // No fresh data — return stale if we're allowed to
  return { parts: freshOnly ? [] : cachedRows, isStale: cachedRows.length > 0 };
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
    // Non-fatal — cache write failure shouldn't break the response
  }
}

// ============================================================
// NEXAR FETCH — returns empty array on failure, never throws
// ============================================================

async function fetchNexarParts(
  searchTerm: string,
  category: string,
  limit: number
): Promise<NormalizedPart[]> {
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

    const res = await fetch(NEXAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: gqlQuery,
        variables: { search: searchTerm, limit },
      }),
    });

    if (!res.ok) return [];

    const result = (await res.json()) as NexarGraphQLResponse;
    if (result.errors && result.errors.length > 0) return [];

    const hits = result.data?.supSearch?.hits || [];

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
  } catch {
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
// ROUTE HANDLER
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || searchParams.get('query') || '';
    const category = searchParams.get('category') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    if (!query && !category) {
      return NextResponse.json(
        { error: 'Provide a search query via the "q" or "category" parameter' },
        { status: 400 }
      );
    }

    const searchTerm = query || category;

    // 1. Check Supabase cache first — fresh data (within 7 days)
    const { parts: freshCached, isStale } = await getCachedParts(searchTerm, category, true);

    if (freshCached.length > 0) {
      const parts = freshCached.slice(0, limit).map((row) => cacheRowToPart(row, 'cache'));
      return NextResponse.json({ parts, count: parts.length, source: 'cache' });
    }

    // 2. No fresh cache — call Nexar live
    const nexarParts = await fetchNexarParts(searchTerm, category, limit);

    if (nexarParts.length > 0) {
      // 3. Upsert results into Supabase cache for future queries
      await upsertCachedParts(nexarParts, searchTerm);

      const parts = nexarParts.slice(0, limit);
      return NextResponse.json({ parts, count: parts.length, source: 'nexar' });
    }

    // 4. Nexar returned nothing or failed — fall back to stale cache
    if (isStale) {
      const { parts: staleParts } = await getCachedParts(searchTerm, category, false);
      if (staleParts.length > 0) {
        const parts = staleParts.slice(0, limit).map((row) => cacheRowToPart(row, 'stale-cache'));
        return NextResponse.json({
          parts,
          count: parts.length,
          source: 'stale-cache',
          warning: 'Live data unavailable, showing cached results from a previous fetch',
        });
      }
    }

    // 5. No data anywhere — return empty, no error
    return NextResponse.json({
      parts: [],
      count: 0,
      source: 'empty',
      warning: 'No parts found. Check your search term or try a different category.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch parts';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
