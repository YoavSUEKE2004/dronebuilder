export type NexarOffer = {
  seller: string;
  url: string;
  inStock: number | null;
  price: number | null;
  currency: string;
};

export type NexarPart = {
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
  offers: NexarOffer[];
  specs: Record<string, unknown>;
  quality_score: number;
  stock_status: string;
};

export type NexarSearchResult = {
  parts: NexarPart[];
  count: number;
  source: 'nexar';
  hasMore: boolean;
  error?: string;
};

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

export function getNexarToken(): string | null {
  return process.env.NEXT_PUBLIC_NEXAR_TOKEN?.trim() || null;
}

export async function searchNexarParts(
  query: string,
  category: string,
  limit = 20
): Promise<NexarSearchResult> {
  const token = getNexarToken();
  if (!token) {
    return {
      parts: [],
      count: 0,
      source: 'nexar',
      hasMore: false,
      error: 'NEXT_PUBLIC_NEXAR_TOKEN is missing. Add it to your .env file to enable live parts search.',
    };
  }

  const searchTerm = query || getDefaultQuery(category);

  try {
    const res = await fetch(NEXAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, application/graphql-response+json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: `
          query SearchParts($q: String!, $limit: Int!) {
            supSearch(q: $q, limit: $limit) {
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
                      inventory
                      prices { price currency }
                    }
                  }
                }
              }
            }
          }`,
        variables: { q: searchTerm || 'FPV', limit },
      }),
      cache: 'no-store',
    });

    const text = await res.text();

    if (!res.ok) {
      return {
        parts: [],
        count: 0,
        source: 'nexar',
        hasMore: false,
        error: `Nexar API error (${res.status}): ${text.slice(0, 300)}`,
      };
    }

    let data: {
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
                  inventory: number | null;
                  prices: Array<{ price: number; currency: string }> | null;
                }> | null;
              }> | null;
            };
          }>;
        };
      };
    };

    try {
      data = JSON.parse(text);
    } catch {
      return {
        parts: [],
        count: 0,
        source: 'nexar',
        hasMore: false,
        error: 'Nexar returned an invalid response. Please try again.',
      };
    }

    if (data.errors && data.errors.length > 0) {
      return {
        parts: [],
        count: 0,
        source: 'nexar',
        hasMore: false,
        error: data.errors[0].message,
      };
    }

    const rawResults = data.data?.supSearch?.results || [];

    const parts: NexarPart[] = rawResults.map((r) => {
      const part = r.part;
      const sellers = part.sellers || [];
      const offers: NexarOffer[] = sellers.flatMap((s) =>
        (s.offers || []).map((offer) => ({
          seller: s.company?.name || '',
          url: offer.clickUrl || '',
          inStock: offer.inventory ?? null,
          price: offer.prices?.[0]?.price ?? null,
          currency: offer.prices?.[0]?.currency || 'USD',
        }))
      );

      const firstOffer = offers.find((o) => o.price !== null);
      const totalStock = offers.reduce((sum, o) => sum + (o.inStock ?? 0), 0);
      const stockStatus = totalStock > 10 ? 'in_stock' : totalStock > 0 ? 'low_stock' : 'unknown';

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
        stock_status: stockStatus,
      };
    });

    return {
      parts,
      count: parts.length,
      source: 'nexar',
      hasMore: parts.length === limit,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      parts: [],
      count: 0,
      source: 'nexar',
      hasMore: false,
      error: `Nexar Request Failed: ${msg}`,
    };
  }
}
