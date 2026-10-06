export type RawProduct = {
  title: string;
  price: number;
  inStock: boolean;
  url: string;
  vendor: string;
  imageUrl: string;
  description?: string;
  mpn?: string;
  rawData?: Record<string, unknown>;
};

export type FeedConfig = {
  id: string;
  name: string;
  feedType: 'shopify' | 'woocommerce' | 'csv';
  url: string;
};

export type FetchResult = {
  products: RawProduct[];
  errors: string[];
};

// ============================================================
// SHOPIFY FETCHER
// ============================================================

type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  body_html: string;
  variants: Array<{
    price: string;
    available: boolean;
    sku: string;
  }>;
  images: Array<{ src: string }>;
};

type ShopifyResponse = {
  products: ShopifyProduct[];
};

export async function fetchShopifyProducts(domain: string): Promise<FetchResult> {
  const products: RawProduct[] = [];
  const errors: string[] = [];

  let cleanDomain = domain.trim();
  if (!cleanDomain.startsWith('http')) {
    cleanDomain = `https://${cleanDomain}`;
  }
  cleanDomain = cleanDomain.replace(/\/$/, '');
  const apiUrl = `${cleanDomain}/products.json?limit=250`;

  try {
    const res = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'FPVConfigurator/1.0' },
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      errors.push(`Shopify ${domain}: HTTP ${res.status}`);
      return { products, errors };
    }

    const data = (await res.json()) as ShopifyResponse;
    const shopDomain = cleanDomain.replace(/^https?:\/\//, '');

    for (const p of data.products || []) {
      const firstVariant = p.variants?.[0];
      const price = firstVariant ? parseFloat(firstVariant.price) : 0;
      const image = p.images?.[0]?.src || '';
      const productUrl = `${cleanDomain}/products/${p.handle}`;

      products.push({
        title: p.title,
        price: isNaN(price) ? 0 : price,
        inStock: firstVariant?.available ?? true,
        url: productUrl,
        vendor: p.vendor || shopDomain,
        imageUrl: image,
        description: stripHtml(p.body_html || ''),
        mpn: firstVariant?.sku || '',
        rawData: { source: 'shopify', id: p.id, product_type: p.product_type },
      });
    }
  } catch (err) {
    errors.push(`Shopify ${domain}: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { products, errors };
}

// ============================================================
// WOOCOMMERCE FETCHER
// ============================================================

type WooProduct = {
  id: number;
  name: string;
  permalink: string;
  price: string;
  stock_status: string;
  stock_quantity: number | null;
  images: Array<{ src: string }>;
  description: string;
  sku: string;
  tags: Array<{ name: string }>;
};

export async function fetchWooCommerceProducts(
  domain: string,
  consumerKey?: string,
  consumerSecret?: string
): Promise<FetchResult> {
  const products: RawProduct[] = [];
  const errors: string[] = [];

  let cleanDomain = domain.trim();
  if (!cleanDomain.startsWith('http')) {
    cleanDomain = `https://${cleanDomain}`;
  }
  cleanDomain = cleanDomain.replace(/\/$/, '');

  const params = new URLSearchParams({
    per_page: '100',
    status: 'publish',
    _embed: 'wp:featured_media',
  });

  const apiUrl = `${cleanDomain}/wp-json/wc/v3/products?${params}`;

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'FPVConfigurator/1.0',
    };

    if (consumerKey && consumerSecret) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    }

    const res = await fetch(apiUrl, {
      headers,
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      errors.push(`WooCommerce ${domain}: HTTP ${res.status}`);
      return { products, errors };
    }

    const data = (await res.json()) as WooProduct[];
    const shopDomain = cleanDomain.replace(/^https?:\/\//, '');

    for (const p of data || []) {
      const price = parseFloat(p.price);
      products.push({
        title: p.name,
        price: isNaN(price) ? 0 : price,
        inStock: p.stock_status === 'instock',
        url: p.permalink,
        vendor: shopDomain,
        imageUrl: p.images?.[0]?.src || '',
        description: stripHtml(p.description || ''),
        mpn: p.sku || '',
        rawData: {
          source: 'woocommerce',
          id: p.id,
          tags: p.tags?.map((t) => t.name) || [],
        },
      });
    }
  } catch (err) {
    errors.push(`WooCommerce ${domain}: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { products, errors };
}

// ============================================================
// CSV / GENERIC FEED PARSER
// ============================================================

export async function fetchCsvFeed(
  feedUrl: string,
  vendorName: string,
  columnMap?: Partial<CsvColumnMap>
): Promise<FetchResult> {
  const products: RawProduct[] = [];
  const errors: string[] = [];

  const defaultMap: CsvColumnMap = {
    title: 'Product Name',
    price: 'Price',
    url: 'Product URL',
    imageUrl: 'Image URL',
    description: 'Description',
    mpn: 'MPN',
    ...columnMap,
  };

  try {
    const res = await fetch(feedUrl, {
      headers: { 'User-Agent': 'FPVConfigurator/1.0' },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      errors.push(`CSV feed: HTTP ${res.status}`);
      return { products, errors };
    }

    const text = await res.text();
    const rows = parseCsv(text);

    if (rows.length < 2) {
      errors.push(`CSV feed: no data rows found`);
      return { products, errors };
    }

    const headers = rows[0].map((h) => h.trim());
    const findCol = (name: string): number => {
      const idx = headers.findIndex(
        (h) => h.toLowerCase() === name.toLowerCase() || h.toLowerCase().includes(name.toLowerCase())
      );
      return idx;
    };

    const colIdx = {
      title: findCol(defaultMap.title),
      price: findCol(defaultMap.price),
      url: findCol(defaultMap.url),
      imageUrl: findCol(defaultMap.imageUrl),
      description: findCol(defaultMap.description),
      mpn: findCol(defaultMap.mpn),
    };

    if (colIdx.title === -1) {
      errors.push(`CSV feed: could not find title column (looked for "${defaultMap.title}")`);
      return { products, errors };
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;

      const title = colIdx.title >= 0 ? row[colIdx.title]?.trim() : '';
      if (!title) continue;

      const priceStr = colIdx.price >= 0 ? row[colIdx.price]?.replace(/[^0-9.]/g, '') : '0';
      const price = parseFloat(priceStr || '0');

      products.push({
        title,
        price: isNaN(price) ? 0 : price,
        inStock: true,
        url: colIdx.url >= 0 ? row[colIdx.url]?.trim() : '',
        vendor: vendorName,
        imageUrl: colIdx.imageUrl >= 0 ? row[colIdx.imageUrl]?.trim() : '',
        description: colIdx.description >= 0 ? row[colIdx.description]?.trim() : '',
        mpn: colIdx.mpn >= 0 ? row[colIdx.mpn]?.trim() : '',
        rawData: { source: 'csv', row: i },
      });
    }
  } catch (err) {
    errors.push(`CSV feed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { products, errors };
}

// ============================================================
// UNIFIED FETCH DISPATCHER
// ============================================================

export async function fetchFromFeed(
  feed: FeedConfig,
  options?: { wooKey?: string; wooSecret?: string; csvVendor?: string; csvColumnMap?: Partial<CsvColumnMap> }
): Promise<FetchResult> {
  switch (feed.feedType) {
    case 'shopify':
      return fetchShopifyProducts(feed.url);
    case 'woocommerce':
      return fetchWooCommerceProducts(feed.url, options?.wooKey, options?.wooSecret);
    case 'csv':
      return fetchCsvFeed(feed.url, options?.csvVendor || feed.name, options?.csvColumnMap);
    default:
      return { products: [], errors: [`Unknown feed type: ${feed.feedType}`] };
  }
}

// ============================================================
// HELPERS
// ============================================================

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1000);
}

type CsvColumnMap = {
  title: string;
  price: string;
  url: string;
  imageUrl: string;
  description: string;
  mpn: string;
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && nextChar === '\n') i++;
        currentRow.push(currentField);
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}
