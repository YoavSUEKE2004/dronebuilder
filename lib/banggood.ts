import crypto from 'crypto';

/**
 * Banggood Open Platform API connector.
 *
 * Reads credentials from environment variables — never hard-code real
 * keys here. Set these in .env.local (local dev) and in your hosting
 * platform's environment variable settings (for production):
 *
 *   BANGGOOD_APP_KEY=your_app_key
 *   BANGGOOD_APP_SECRET=your_app_secret
 *
 * NOTE: Banggood's exact signing scheme and endpoint paths can vary by
 * API version. This implementation follows their commonly documented
 * pattern (app key + timestamp + MD5 signature). If your first real
 * request fails, check the response error message and we'll adjust —
 * that's expected for a first integration, not a mistake.
 */

const BANGGOOD_API_BASE = 'https://affapi.banggood.com';

function getCredentials() {
  const appKey = process.env.BANGGOOD_APP_KEY;
  const appSecret = process.env.BANGGOOD_APP_SECRET;

  if (!appKey || !appSecret) {
    throw new Error(
      'Missing Banggood credentials. Set BANGGOOD_APP_KEY and BANGGOOD_APP_SECRET in your environment variables.'
    );
  }

  return { appKey, appSecret };
}

/**
 * Builds the signature Banggood's API expects: an MD5 hash of the
 * sorted request parameters plus your app secret. This proves the
 * request really came from you without sending your secret directly
 * over the network.
 */
function buildSignature(params: Record<string, string>, appSecret: string): string {
  const sortedKeys = Object.keys(params).sort();
  const concatenated = sortedKeys.map((key) => `${key}${params[key]}`).join('');
  const toSign = `${appSecret}${concatenated}${appSecret}`;
  return crypto.createHash('md5').update(toSign).digest('hex').toUpperCase();
}

export type BanggoodProduct = {
  productId: string;
  name: string;
  price: number;
  currency: string;
  productUrl: string;
  imageUrl: string;
  inStock: boolean;
};

/**
 * Fetches current price/availability for a single product by its
 * Banggood product ID.
 */
export async function fetchBanggoodProduct(productId: string): Promise<BanggoodProduct> {
  const { appKey, appSecret } = getCredentials();

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params: Record<string, string> = {
    app_key: appKey,
    timestamp,
    product_id: productId,
    format: 'json',
    v: '1.0',
  };
  params.sign = buildSignature(params, appSecret);

  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${BANGGOOD_API_BASE}/product/detail?${query}`);

  if (!response.ok) {
    throw new Error(`Banggood API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error || data.error_code) {
    throw new Error(`Banggood API error: ${data.error_msg || data.error || 'unknown error'}`);
  }

  // NOTE: field names below are best-guess based on typical Banggood
  // API responses — confirm against your actual response shape once
  // you make a real test call, and adjust the mapping if needed.
  return {
    productId: data.product_id ?? productId,
    name: data.product_name ?? '',
    price: parseFloat(data.price ?? '0'),
    currency: data.currency ?? 'USD',
    productUrl: data.product_url ?? '',
    imageUrl: data.image_url ?? '',
    inStock: data.stock_status === 'in_stock',
  };
}

/**
 * Fetches multiple products at once. Runs requests one at a time with
 * a short delay to stay well under any rate limits — safer than firing
 * everything simultaneously, especially while we're not yet sure what
 * Banggood's actual limits are for your account tier.
 */
export async function fetchBanggoodProducts(productIds: string[]): Promise<BanggoodProduct[]> {
  const results: BanggoodProduct[] = [];

  for (const id of productIds) {
    try {
      const product = await fetchBanggoodProduct(id);
      results.push(product);
    } catch (err) {
      console.error(`Failed to fetch Banggood product ${id}:`, err);
    }
    // Small delay between requests to be a good API citizen.
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return results;
}
