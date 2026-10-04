import { NextRequest, NextResponse } from 'next/server';
import localParts from '@/lib/parts.json';

export const runtime = 'nodejs';

const NEXAR_API_URL = 'https://api.nexar.com/graphql';
const NEXAR_TOKEN_URL = 'https://identity.nexar.com/connect/token';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ============================================================
// TYPES
// ============================================================

type LocalPart = {
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
  electrical_specs: {
    max_voltage_s: number | null;
    min_voltage_s: number | null;
    max_current_a: number | null;
    bec_output_v: number | null;
    protocol: string;
  };
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
  source: 'local' | 'nexar' | 'merged';
  offers: Array<{
    seller: string;
    url: string;
    inStock: number | null;
    price: number | null;
    currency: string;
  }>;
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
// IN-MEMORY CACHE — 24h TTL per search key
// ============================================================

type CacheEntry = {
  parts: NormalizedPart[];
  timestamp: number;
};

const responseCache = new Map<string, CacheEntry>();

function getCached(key: string): NormalizedPart[] | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return entry.parts;
}

function setCached(key: string, parts: NormalizedPart[]) {
  responseCache.set(key, { parts, timestamp: Date.now() });
}

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
// LOCAL DATA HELPERS
// ============================================================

const LOCAL_PARTS = localParts as LocalPart[];

function searchLocalParts(query: string, category: string, limit: number): LocalPart[] {
  const q = query.toLowerCase().trim();
  return LOCAL_PARTS.filter((p) => {
    if (category && p.category !== category) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.mpn.toLowerCase().includes(q)
    );
  }).slice(0, limit);
}

function normalizeLocalPart(p: LocalPart): NormalizedPart {
  return {
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
    source: 'local',
    offers: [{
      seller: p.store_name,
      url: p.product_url,
      inStock: null,
      price: p.price,
      currency: 'USD',
    }],
  };
}

// ============================================================
// NEXAR FETCH — returns empty array on failure, never throws
// ============================================================

async function fetchNexarParts(searchTerm: string, limit: number): Promise<NormalizedPart[]> {
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
      return {
        id: part.id,
        name: part.name,
        manufacturer: part.manufacturer?.name || '',
        mpn: part.mpn,
        description: part.description,
        datasheetUrl: part.datasheetUrl,
        image_url: part.bestImage?.url || null,
        category: '',
        price: part.medianPrice?.price ?? null,
        currency: part.medianPrice?.currency || 'USD',
        source: 'nexar' as const,
        offers: (part.offers || []).map((offer) => ({
          seller: offer.seller?.name || '',
          url: offer.url,
          inStock: offer.inventory ?? null,
          price: offer.prices?.[0]?.price ?? null,
          currency: offer.prices?.[0]?.currency || 'USD',
        })),
      };
    });
  } catch {
    return [];
  }
}

// ============================================================
// MERGE LOGIC — local parts first, Nexar enriches with live pricing
// ============================================================

function mergeParts(local: NormalizedPart[], nexar: NormalizedPart[]): NormalizedPart[] {
  const merged: NormalizedPart[] = [];
  const seenMpn = new Set<string>();

  for (const lp of local) {
    const nexarMatch = nexar.find((np) =>
      np.mpn && lp.mpn && np.mpn.toLowerCase() === lp.mpn.toLowerCase()
    );

    if (nexarMatch && nexarMatch.price !== null) {
      merged.push({
        ...lp,
        price: nexarMatch.price,
        currency: nexarMatch.currency,
        source: 'merged',
        offers: nexarMatch.offers.length > 0 ? nexarMatch.offers : lp.offers,
        description: nexarMatch.description,
        datasheetUrl: nexarMatch.datasheetUrl,
        image_url: nexarMatch.image_url || lp.image_url,
      });
    } else {
      merged.push(lp);
    }

    if (lp.mpn) seenMpn.add(lp.mpn.toLowerCase());
  }

  for (const np of nexar) {
    if (np.mpn && seenMpn.has(np.mpn.toLowerCase())) continue;
    merged.push(np);
  }

  return merged;
}

// ============================================================
// ROUTE HANDLER
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || searchParams.get('query') || '';
    const category = searchParams.get('category') || '';
    const live = searchParams.get('live') === '1' || searchParams.get('live') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    if (!query && !category) {
      return NextResponse.json(
        { error: 'Provide a search query via the "q" parameter' },
        { status: 400 }
      );
    }

    const searchTerm = query || category;
    const cacheKey = `${searchTerm.toLowerCase()}|${category.toLowerCase()}|${limit}|${live}`;

    // 1. Check in-memory cache first
    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json({ parts: cached, count: cached.length, source: 'cache' });
    }

    // 2. Always check local data first
    const localResults = searchLocalParts(query, category, limit);
    const localNormalized = localResults.map(normalizeLocalPart);

    // 3. If live pricing is not requested, return local data immediately
    if (!live) {
      setCached(cacheKey, localNormalized);
      return NextResponse.json({ parts: localNormalized, count: localNormalized.length, source: 'local' });
    }

    // 4. Fetch from Nexar (cached or fresh), gracefully fall back on failure
    const nexarResults = await fetchNexarParts(searchTerm, limit);

    if (nexarResults.length === 0) {
      // Nexar returned nothing or failed — fall back to local data
      setCached(cacheKey, localNormalized);
      return NextResponse.json({
        parts: localNormalized,
        count: localNormalized.length,
        source: 'local-fallback',
        warning: 'Live pricing unavailable, showing local catalog data',
      });
    }

    // 5. Merge: local parts enriched with live Nexar pricing, plus any Nexar-only results
    const merged = mergeParts(localNormalized, nexarResults).slice(0, limit);
    setCached(cacheKey, merged);

    return NextResponse.json({ parts: merged, count: merged.length, source: 'merged' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch parts';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
