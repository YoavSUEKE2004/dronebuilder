import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const NEXAR_API_URL = 'https://api.nexar.com/graphql';
const NEXAR_TOKEN_URL = 'https://identity.nexar.com/connect/token';

const NEXAR_HEADERS = {
  'Connection': 'close',
  'User-Agent': 'FPVConfigurator/1.0',
};

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

export async function GET(req: NextRequest) {
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

  const clientId = (process.env.NEXAR_CLIENT_ID || '').trim();
  const clientSecret = (process.env.NEXAR_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'NEXAR_CLIENT_ID or NEXAR_CLIENT_SECRET is missing in environment variables.' },
      { status: 400 }
    );
  }

  try {
    // --- Step 1: Fetch OAuth access token via native fetch ---
    const tokenParams = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    const tokenRes = await fetch(NEXAR_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...NEXAR_HEADERS,
      },
      body: tokenParams.toString(),
      cache: 'no-store',
    });

    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) {
      return NextResponse.json(
        { error: `OAuth Token Error (${tokenRes.status}): ${tokenText.slice(0, 500)}` },
        { status: tokenRes.status }
      );
    }

    let tokenData: { access_token?: string };
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      return NextResponse.json(
        { error: 'OAuth token response was not valid JSON.' },
        { status: 500 }
      );
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No access token returned from Nexar identity endpoint.' },
        { status: 500 }
      );
    }

    // --- Step 2: Fetch GraphQL data via native fetch ---
    const gqlBody = JSON.stringify({
      query: `
        query SearchParts($q: String!) {
          supSearch(q: $q, limit: 10) {
            results {
              part {
                mpn
                name
                shortDescription
                bestDatasheet { url }
                sellers {
                  company { name }
                  offers {
                    clickUrl
                    prices { price currency }
                  }
                }
              }
            }
          }
        }`,
      variables: { q: searchTerm || 'FPV' },
    });

    const gqlRes = await fetch(NEXAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, application/graphql-response+json',
        'Authorization': `Bearer ${accessToken}`,
        ...NEXAR_HEADERS,
      },
      body: gqlBody,
      cache: 'no-store',
    });

    const gqlText = await gqlRes.text();
    if (!gqlRes.ok) {
      return NextResponse.json(
        { error: `GraphQL Endpoint Error (${gqlRes.status}): ${gqlText.slice(0, 500)}` },
        { status: gqlRes.status }
      );
    }

    let gqlData: {
      errors?: Array<{ message: string }>;
      data?: {
        supSearch?: {
          results?: Array<{
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
          }>;
        };
      };
    };
    try {
      gqlData = JSON.parse(gqlText);
    } catch {
      return NextResponse.json(
        { error: 'GraphQL response was not valid JSON.' },
        { status: 500 }
      );
    }

    if (gqlData.errors && gqlData.errors.length > 0) {
      return NextResponse.json(
        { error: gqlData.errors[0].message },
        { status: 400 }
      );
    }

    // Transform results into the shape the UI expects
    const rawResults = gqlData.data?.supSearch?.results || [];

    const parts = rawResults.map((r) => {
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

      const firstOffer = offers.find((o) => o.price !== null);

      return {
        id: part.mpn,
        name: part.name || part.mpn,
        manufacturer: '',
        mpn: part.mpn,
        description: part.shortDescription,
        datasheetUrl: part.bestDatasheet?.url || null,
        image_url: null,
        category: category || '',
        price: firstOffer?.price ?? null,
        currency: firstOffer?.currency || 'USD',
        source: 'nexar',
        offers,
        specs: {},
        quality_score: 5,
        stock_status: offers.some((o) => o.price !== null) ? 'in_stock' : 'unknown',
      };
    });

    return NextResponse.json({
      parts,
      count: parts.length,
      source: 'nexar',
      hasMore: false,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Nexar Request Failed: ${msg}` },
      { status: 500 }
    );
  }
}
