import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import https from 'https';

export const runtime = 'nodejs';

const httpsAgent = new https.Agent({ keepAlive: false });

const NEXAR_HEADERS = {
  'Connection': 'close',
  'User-Agent': 'FPVConfigurator/1.0',
};

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

  try {
    // --- Step 1: Fetch OAuth access token via axios ---
    const tokenParams = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    const tokenRes = await axios.post(NEXAR_TOKEN_URL, tokenParams.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...NEXAR_HEADERS,
      },
      httpsAgent,
      timeout: 12000,
    });

    const accessToken = tokenRes.data.access_token;
    if (!accessToken) {
      return NextResponse.json(
        { error: 'OAuth succeeded but no access_token in response.' },
        { status: 500 }
      );
    }

    // --- Step 2: Fetch GraphQL data via axios ---
    const gqlRes = await axios.post(
      NEXAR_API_URL,
      {
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
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, application/graphql-response+json',
          Authorization: `Bearer ${accessToken}`,
          ...NEXAR_HEADERS,
        },
        httpsAgent,
        timeout: 12000,
      }
    );

    const jsonData = gqlRes.data;

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
    if (axios.isAxiosError(err)) {
      const errMsg = err.response?.data
        ? typeof err.response.data === 'string'
          ? err.response.data.slice(0, 500)
          : JSON.stringify(err.response.data)
        : err.message;
      return NextResponse.json(
        { error: `Nexar Request Failed: ${errMsg}` },
        { status: err.response?.status || 500 }
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Nexar Request Failed: ${msg}` },
      { status: 500 }
    );
  }
}
