import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const NEXAR_API_URL = 'https://api.nexar.com/graphql';
const NEXAR_TOKEN_URL = 'https://identity.nexar.com/connect/token';

type NexarTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
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

type NexarGraphQLResponse = {
  data?: {
    supSearch?: {
      hits?: Array<{
        part: NexarPart;
      }>;
    };
    multiPartSearch?: {
      hits?: Array<{
        part: NexarPart;
      }>;
    };
  };
  errors?: Array<{ message: string }>;
};

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
    const text = await res.text();
    throw new Error(`Nexar token request failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as NexarTokenResponse;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || searchParams.get('query') || '';
    const category = searchParams.get('category') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    if (!query && !category) {
      return NextResponse.json(
        { error: 'Provide a search query via the "q" parameter' },
        { status: 400 }
      );
    }

    const token = await getNexarToken();

    const searchTerm = query || category;

    const gqlQuery = `
      query SearchParts($search: String!, $limit: Int!) {
        supSearch(q: $search, limit: $limit) {
          hits {
            part {
              id
              name
              manufacturer {
                name
              }
              mpn
              description
              datasheetUrl
              bestImage {
                url
              }
              medianPrice {
                price
                currency
              }
              offers {
                seller {
                  name
                }
                url
                clickUrl
                inventory
                prices {
                  price
                  currency
                  quantity
                }
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

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Nexar API request failed (${res.status})` },
        { status: 502 }
      );
    }

    const result = (await res.json()) as NexarGraphQLResponse;

    if (result.errors && result.errors.length > 0) {
      return NextResponse.json(
        { error: result.errors[0].message },
        { status: 502 }
      );
    }

    const hits = result.data?.supSearch?.hits || [];

    const parts = hits.map((hit) => {
      const part = hit.part;
      return {
        id: part.id,
        name: part.name,
        manufacturer: part.manufacturer?.name || '',
        mpn: part.mpn,
        description: part.description,
        datasheetUrl: part.datasheetUrl,
        image_url: part.bestImage?.url || null,
        medianPrice: part.medianPrice
          ? { price: part.medianPrice.price, currency: part.medianPrice.currency }
          : null,
        offers: (part.offers || []).map((offer) => ({
          seller: offer.seller?.name || '',
          url: offer.url,
          inStock: offer.inventory ?? null,
          price: offer.prices?.[0]
            ? { price: offer.prices[0].price, currency: offer.prices[0].currency }
            : null,
        })),
      };
    });

    return NextResponse.json({ parts, count: parts.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch parts from Nexar';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
