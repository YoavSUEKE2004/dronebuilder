import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const NEXAR_API_URL = 'https://api.nexar.com/graphql';
const NEXAR_TOKEN_URL = 'https://identity.nexar.com/connect/token';
const FETCH_TIMEOUT_MS = 10000;

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
          shortDescription: string | null;
          bestDatasheet: { url: string } | null;
          sellers: Array<{
            company: { name: string } | null;
            offers: Array<{
              clickUrl: string | null;
              prices: Array<{ price: number; currency: string }> | null;
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

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

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

  let tokenResponse: Response;
  try {
    tokenResponse = await fetchWithTimeout(
      NEXAR_TOKEN_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      },
      FETCH_TIMEOUT_MS
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown network error';
    console.error('[Nexar Proxy] Token fetch network/timeout error:', msg);
    throw new Error(`OAuth token fetch failed (network/timeout after ${FETCH_TIMEOUT_MS}ms): ${msg}`);
  }

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
      errorDetail = `Non-JSON response (${tokenContentType || 'unknown content-type'}). Status: ${tokenResponse.statusText}`;
    }
    console.error(`[Nexar Proxy] OAuth token fetch failed [${tokenResponse.status}]:`, errorDetail);
    throw new Error(
      `OAuth token fetch failed [${tokenResponse.status} ${tokenResponse.statusText}]: ${errorDetail}`
    );
  }

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

    if (!query && !category) {
      return NextResponse.json(
        { error: 'Provide a search query via the "q" or "category" parameter' },
        { status: 400 }
      );
    }

    const searchTerm = query || getDefaultQuery(category);

    // Step 1: OAuth 2.0 token retrieval (with 10s timeout)
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

    // Step 2: GraphQL query (with 10s timeout)
    const payload = JSON.stringify({
      query: `
        query SearchParts($q: String!) {
          supSearch(q: $q, limit: 10) {
            results {
              part {
                mpn
                name
                shortDescription
                bestDatasheet {
                  url
                }
                sellers {
                  company {
                    name
                  }
                  offers {
                    clickUrl
                    prices {
                      price
                      currency
                    }
                  }
                }
              }
            }
          }
        }`,
      variables: { q: searchTerm || 'FPV' },
    });

    console.log(`[Nexar Proxy] GraphQL query: q="${searchTerm || 'FPV'}", category="${category}"`);

    let res: Response;
    try {
      res = await fetchWithTimeout(
        NEXAR_API_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, application/graphql-response+json',
            Authorization: `Bearer ${token}`,
          },
          body: payload,
        },
        FETCH_TIMEOUT_MS
      );
    } catch (fetchErr) {
      const isAbort = fetchErr instanceof Error && fetchErr.name === 'AbortError';
      const msg = fetchErr instanceof Error ? fetchErr.message : 'Network error';
      console.error(`[Nexar Proxy] ${isAbort ? 'GraphQL fetch timed out' : 'Network error'} after ${FETCH_TIMEOUT_MS}ms:`, msg);
      return NextResponse.json(
        { error: `Nexar Error: [${isAbort ? 'Timeout' : 'CORS / Network Error'}] ${msg}`, parts: [], count: 0 },
        { status: 500 }
      );
    }

    // Parse the response body as JSON even on HTTP 400 — Nexar returns error
    // arrays in JSON format for GraphQL syntax/validation errors.
    const rawBody = await res.text();
    let result: NexarGraphQLResponse;
    try {
      result = JSON.parse(rawBody) as NexarGraphQLResponse;
    } catch {
      const statusText = res.status === 401 ? 'Unauthorized - Check API Keys' : res.statusText;
      console.error(`[Nexar Proxy] GraphQL endpoint returned non-JSON [${res.status} ${statusText}]:`, rawBody.slice(0, 500));
      return NextResponse.json(
        { error: `Nexar Error: [${res.status} ${statusText}] Non-JSON response: ${rawBody.slice(0, 300)}`, parts: [], count: 0 },
        { status: res.status }
      );
    }

    // Check for GraphQL errors in the parsed body (present even on HTTP 400)
    if (result.errors && result.errors.length > 0) {
      const message = result.errors[0].message;
      console.error('[Nexar Proxy] GraphQL errors:', message);
      return NextResponse.json(
        { error: message, parts: [], count: 0 },
        { status: res.status === 200 ? 400 : res.status }
      );
    }

    // If the HTTP status is not OK but there were no GraphQL errors array,
    // surface the raw body as the error detail.
    if (!res.ok) {
      const statusText = res.status === 401 ? 'Unauthorized - Check API Keys' : res.statusText;
      console.error(`[Nexar Proxy] GraphQL API error [${res.status}]:`, rawBody.slice(0, 500));
      return NextResponse.json(
        { error: `Nexar Error: [${res.status} ${statusText}] ${rawBody.slice(0, 300)}`, parts: [], count: 0 },
        { status: res.status }
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
          inStock: null,
          price: offer.prices?.[0]?.price ?? null,
          currency: offer.prices?.[0]?.currency || 'USD',
        }))
      );

      const stockStatus = offers.some((o) => o.price !== null) ? 'in_stock' : 'unknown';

      return {
        id: part.mpn,
        name: part.name || part.mpn,
        manufacturer: '',
        mpn: part.mpn,
        description: part.shortDescription,
        datasheetUrl: part.bestDatasheet?.url || null,
        image_url: null,
        category: category || '',
        price: offers.find((o) => o.price !== null)?.price ?? null,
        currency: offers.find((o) => o.price !== null)?.currency || 'USD',
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
