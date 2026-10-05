import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const NEXAR_API_URL = 'https://api.nexar.com/graphql';

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

  const token = (process.env.NEXAR_TOKEN || '').trim();

  if (!token) {
    return NextResponse.json(
      { error: 'NEXAR_TOKEN is missing in .env environment variables.' },
      { status: 400 }
    );
  }

  try {
    const gqlRes = await fetch(NEXAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, application/graphql-response+json',
        'Authorization': `Bearer ${token}`,
        'Connection': 'close',
        'User-Agent': 'FPVConfigurator/1.0',
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
