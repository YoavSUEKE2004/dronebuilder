import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const NEXAR_API_URL = 'https://api.nexar.com/graphql';
const NEXAR_TOKEN_URL = 'https://identity.nexar.com/connect/token';

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

type NexarTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

type NexarGraphQLResponse = {
  data?: {
    supSearch?: {
      results: Array<{
        part: {
          mpn: string;
          name: string | null;
          manufacturer: { name: string } | null;
          shortDescription: string | null;
          bestDatasheet: { url: string } | null;
          bestImage: { url: string } | null;
          medianPrice: { price: number; currency: string } | null;
          sellers: Array<{
            company: { name: string } | null;
            offers: Array<{
              clickUrl: string | null;
              inventory: number | null;
              prices: Array<{ price: number; currency: string; quantity: number }> | null;
            }> | null;
          }> | null;
        };
      }> | null;
    };
  };
  errors?: Array<{ message: string }>;
};

type NexarPartResponse = {
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
  source: 'nexar';
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

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getNexarToken(): Promise<string> {
  const clientId = process.env.NEXAR_CLIENT_ID;
  const clientSecret = process.env.NEXAR_CLIENT_SECRET;

  console.log('[Nexar Proxy] ID present:', !!clientId);
  console.log('[Nexar Proxy] Secret present:', !!clientSecret);

  if (!clientId || !clientSecret) {
    throw new Error(
      `NEXAR_CLIENT_ID or NEXAR_CLIENT_SECRET missing in environment variables ` +
      `(ID present: ${!!clientId}, Secret present: ${!!clientSecret})`
    );
  }

  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    console.log('[Nexar Proxy] Using cached token (expires in', Math.round((cachedToken.expiresAt - Date.now()) / 1000), 's)');
    return cachedToken.token;
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);

  console.log('[Nexar Proxy] Requesting OAuth token from', NEXAR_TOKEN_URL);

  const tokenResponse = await fetch(NEXAR_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const tokenContentType = tokenResponse.headers.get('content-type') || '';

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    let errorDetail: string;
    if (tokenContentType.includes('application/json')) {
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = JSON.stringify(errorJson, null, 2);
      } catch {
        errorDetail = errorText.slice(0, 500);
      }
    } else {
      // HTML error page (e.g. Cloudflare 530) — don't try to parse as JSON
      errorDetail = `Non-JSON response (${tokenContentType || 'unknown content-type'}). Status: ${tokenResponse.statusText}`;
    }
    console.error(`[Nexar Proxy] OAuth token fetch failed [${tokenResponse.status}]:`, errorDetail);
    throw new Error(
      `OAuth token fetch failed [${tokenResponse.status} ${tokenResponse.statusText}]: ${errorDetail}`
    );
  }

  // Guard against HTML error pages being parsed as JSON
  if (!tokenContentType.includes('application/json')) {
    const bodyPreview = await tokenResponse.text().catch(() => '<unreadable>');
    console.error(`[Nexar Proxy] Token endpoint returned non-JSON content-type: ${tokenContentType}`);
    throw new Error(
      `Token endpoint returned non-JSON response (content-type: ${tokenContentType || 'none'}). ` +
      `Status: ${tokenResponse.statusText}. Body preview: ${bodyPreview.slice(0, 200)}`
    );
  }

  const tokenData = (await tokenResponse.json()) as NexarTokenResponse;

  if (!tokenData.access_token) {
    console.error('[Nexar Proxy] Token response missing access_token:', JSON.stringify(tokenData));
    throw new Error('OAuth response did not contain access_token');
  }

  cachedToken = {
    token: tokenData.access_token,
    expiresAt: Date.now() + (tokenData.expires_in - 60) * 1000,
  };

  console.log('[Nexar Proxy] Token acquired, expires in', tokenData.expires_in, 's');
  return cachedToken.token;
}

export async function GET(req: NextRequest) {
  console.log('[Nexar Proxy] Request received:', req.url);
  console.log('Nexar ID present:', !!process.env.NEXAR_CLIENT_ID);

  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

    if (!query && !category) {
      return NextResponse.json(
        { error: 'Provide a search query via the "q" or "category" parameter' },
        { status: 400 }
      );
    }

    const searchTerm = query || getDefaultQuery(category);

    // Step 1: OAuth 2.0 token retrieval
    let token: string;
    try {
      token = await getNexarToken();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown OAuth error';
      console.error('[Nexar Proxy] Token error:', msg);
      return NextResponse.json(
        { error: `Nexar Error: ${msg}`, parts: [], count: 0 },
        { status: 500 }
      );
    }

    // Step 2: GraphQL query
    const gqlQuery = `
      query SearchParts($term: String!) {
        supSearch(q: $term, limit: 10) {
          results {
            part {
              mpn
              name
              manufacturer { name }
              shortDescription
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

    const payload = JSON.stringify({
      query: gqlQuery,
      variables: { term: searchTerm },
    });

    console.log(`[Nexar Proxy] GraphQL query: term="${searchTerm}", category="${category}"`);

    let res: Response;
    try {
      res = await fetch(NEXAR_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: payload,
      });
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : 'Network error';
      console.error('[Nexar Proxy] Network error fetching GraphQL:', msg);
      return NextResponse.json(
        { error: `Nexar Error: [CORS / Network Error] ${msg}`, parts: [], count: 0 },
        { status: 500 }
      );
    }

    if (!res.ok) {
      const errorText = await res.text();
      const gqlContentType = res.headers.get('content-type') || '';
      let errorDetail: string;
      if (gqlContentType.includes('application/json')) {
        try {
          const errorJson = JSON.parse(errorText);
          errorDetail = JSON.stringify(errorJson, null, 2);
        } catch {
          errorDetail = errorText.slice(0, 500);
        }
      } else {
        errorDetail = `Non-JSON response (${gqlContentType || 'unknown content-type'}). Status: ${res.statusText}`;
      }
      const statusText = res.status === 401 ? 'Unauthorized - Check API Keys' : res.statusText;
      console.error(`[Nexar Proxy] GraphQL API error [${res.status}]:`, errorDetail);
      return NextResponse.json(
        { error: `Nexar Error: [${res.status} ${statusText}] ${errorDetail}`, parts: [], count: 0 },
        { status: res.status }
      );
    }

    // Guard against HTML error pages on the GraphQL endpoint
    const gqlContentType = res.headers.get('content-type') || '';
    if (!gqlContentType.includes('application/json')) {
      const bodyPreview = await res.text().catch(() => '<unreadable>');
      console.error(`[Nexar Proxy] GraphQL endpoint returned non-JSON content-type: ${gqlContentType}`);
      return NextResponse.json(
        { error: `Nexar Error: GraphQL endpoint returned non-JSON (content-type: ${gqlContentType || 'none'}, status: ${res.statusText}). Body: ${bodyPreview.slice(0, 200)}`, parts: [], count: 0 },
        { status: 502 }
      );
    }

    const result = (await res.json()) as NexarGraphQLResponse;

    if (result.errors && result.errors.length > 0) {
      const messages = result.errors.map((e) => e.message).join('; ');
      console.error('[Nexar Proxy] GraphQL errors:', messages);
      return NextResponse.json(
        { error: `Nexar Error: [GraphQL] ${messages}`, parts: [], count: 0 },
        { status: 500 }
      );
    }

    const rawResults = result.data?.supSearch?.results || [];

    const parts: NexarPartResponse[] = rawResults.map((r) => {
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

      return {
        id: part.mpn,
        name: part.name || part.mpn,
        manufacturer: part.manufacturer?.name || '',
        mpn: part.mpn,
        description: part.shortDescription,
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

    console.log(`[Nexar Proxy] Returning ${parts.length} parts for term="${searchTerm}"`);

    return NextResponse.json({
      parts,
      count: parts.length,
      source: 'nexar',
      hasMore: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch parts';
    console.error('[Nexar Proxy] Unhandled error:', message);
    return NextResponse.json(
      { error: `Nexar Error: ${message}`, parts: [], count: 0 },
      { status: 500 }
    );
  }
}
