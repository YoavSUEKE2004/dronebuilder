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

  // --- Step 0: Validate environment keys ---
  const clientId = (process.env.NEXAR_CLIENT_ID || '').trim();
  const clientSecret = (process.env.NEXAR_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Nexar credentials are missing in server environment variables.' },
      { status: 400 }
    );
  }

  // --- Step 1: Isolated OAuth token exchange ---
  let accessToken = '';
  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    const tokenRes = await fetch(NEXAR_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      cache: 'no-store',
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return NextResponse.json(
        { error: `OAuth failed (${tokenRes.status}): ${errText}` },
        { status: tokenRes.status }
      );
    }

    const tokenData = await tokenRes.json();
    accessToken = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'OAuth succeeded but no access_token in response.' },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `OAuth Connection Error: ${msg}` },
      { status: 500 }
    );
  }

  // --- Step 2: Isolated GraphQL request ---
  try {
    const gqlRes = await fetch(NEXAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, application/graphql-response+json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
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
      }),
      cache: 'no-store',
    });

    const textData = await gqlRes.text();

    let jsonData;
    try {
      jsonData = JSON.parse(textData);
    } catch {
      return NextResponse.json(
        { error: `Non-JSON response from Nexar (${gqlRes.status}): ${textData.slice(0, 300)}` },
        { status: gqlRes.status }
      );
    }

    if (jsonData.errors && jsonData.errors.length > 0) {
      return NextResponse.json(
        { error: jsonData.errors[0].message },
        { status: 400 }
      );
    }

    // Transform results into the shape the UI expects
    const rawResults = jsonData.data?.supSearch?.results || [];

    const parts = rawResults.map((r: { part: {
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
    }}) => {
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

      const firstOffer = offers.find((o: { price: number | null }) => o.price !== null);

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
        stock_status: offers.some((o: { price: number | null }) => o.price !== null) ? 'in_stock' : 'unknown',
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
      { error: `GraphQL Connection Error: ${msg}` },
      { status: 500 }
    );
  }
}
