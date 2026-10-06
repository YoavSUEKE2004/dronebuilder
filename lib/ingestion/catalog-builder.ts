import { supabase } from '@/lib/supabase';
import { fetchFromFeed, type RawProduct, type FeedConfig, type FetchResult } from './fetchers';
import { extractSpecs, specsToJson, type DetectedSpecs } from './spec-parser';

export type CanonicalPart = {
  id: string;
  name: string;
  category: string;
  manufacturer: string;
  mpn: string;
  normalized_key: string;
  description: string | null;
  image_url: string;
  mounting_pattern: string;
  weight_g: number;
  dimensions_mm: string;
  detected_specs: Record<string, unknown>;
  spec_verified: boolean;
  quality_score: number;
  created_at: string;
  updated_at: string;
};

export type VendorListing = {
  id: string;
  canonical_part_id: string;
  retailer_feed_id: string | null;
  title: string;
  vendor: string;
  url: string;
  price: number;
  currency: string;
  in_stock: boolean;
  stock_quantity: number | null;
  image_url: string;
  last_seen_at: string;
};

export type SyncResult = {
  feedId: string;
  feedName: string;
  status: 'success' | 'partial' | 'failed';
  productsFetched: number;
  productsMatched: number;
  productsCreated: number;
  errors: string[];
  durationMs: number;
};

// ============================================================
// NORMALIZATION & MATCHING
// ============================================================

function normalizeModelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(?:the|a|an|for|with|and|or)\b/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\b\d+pack\b/g, ' ')
    .replace(/\b\d+x\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMpn(title: string): string {
  const match = title.match(/\b([A-Z]{2,5}[\-\s]?\d{2,5}[A-Z]?)\b/);
  return match ? match[1].replace(/\s/g, '-') : '';
}

function buildNormalizedKey(name: string, mpn?: string): string {
  const normalized = normalizeModelName(name);
  const mpnClean = mpn ? mpn.toLowerCase().replace(/\s/g, '') : '';
  return mpnClean || normalized.slice(0, 100);
}

// ============================================================
// CATALOG BUILDER
// ============================================================

export async function syncFeed(feed: FeedConfig): Promise<SyncResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let productsFetched = 0;
  let productsMatched = 0;
  let productsCreated = 0;

  const fetchResult: FetchResult = await fetchFromFeed(feed);
  errors.push(...fetchResult.errors);
  productsFetched = fetchResult.products.length;

  if (productsFetched === 0) {
    return {
      feedId: feed.id,
      feedName: feed.name,
      status: errors.length > 0 ? 'failed' : 'success',
      productsFetched: 0,
      productsMatched: 0,
      productsCreated: 0,
      errors,
      durationMs: Date.now() - startTime,
    };
  }

  for (const product of fetchResult.products) {
    try {
      const result = await upsertProduct(product, feed.id);
      if (result.created) productsCreated++;
      else productsMatched++;
    } catch (err) {
      errors.push(`Upsert failed for "${product.title}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Update feed sync status
  await supabase
    .from('retailer_feeds')
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: errors.length === 0 ? 'success' : 'partial',
      last_sync_count: productsFetched,
    })
    .eq('id', feed.id);

  // Log the sync
  await supabase.from('catalog_sync_logs').insert({
    retailer_feed_id: feed.id,
    feed_name: feed.name,
    status: errors.length === 0 ? 'success' : 'partial',
    products_fetched: productsFetched,
    products_matched: productsMatched,
    products_created: productsCreated,
    error_message: errors.length > 0 ? errors.join('; ').slice(0, 2000) : null,
    duration_ms: Date.now() - startTime,
  });

  return {
    feedId: feed.id,
    feedName: feed.name,
    status: errors.length === 0 ? 'success' : 'partial',
    productsFetched,
    productsMatched,
    productsCreated,
    errors,
    durationMs: Date.now() - startTime,
  };
}

async function upsertProduct(
  product: RawProduct,
  feedId: string
): Promise<{ created: boolean; canonicalId: string }> {
  const specs = extractSpecs(product);
  const mpn = product.mpn || extractMpn(product.title);
  const normalizedKey = buildNormalizedKey(product.title, mpn);

  // Try to find an existing canonical part by normalized key
  const { data: existing } = await supabase
    .from('canonical_parts')
    .select('id, name, detected_specs')
    .eq('normalized_key', normalizedKey)
    .maybeSingle();

  let canonicalId: string;
  let created = false;

  if (existing) {
    canonicalId = existing.id;

    // Update the vendor listing for this feed
    await supabase
      .from('vendor_listings')
      .upsert(
        {
          canonical_part_id: canonicalId,
          retailer_feed_id: feedId,
          title: product.title,
          vendor: product.vendor,
          url: product.url,
          price: product.price,
          currency: 'USD',
          in_stock: product.inStock,
          image_url: product.imageUrl,
          raw_data: product.rawData || {},
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'canonical_part_id,retailer_feed_id' }
      );
  } else {
    // Create a new canonical part
    const { data: newPart, error } = await supabase
      .from('canonical_parts')
      .insert({
        name: product.title,
        category: specs.category,
        manufacturer: extractManufacturer(product.vendor, product.title),
        mpn,
        normalized_key: normalizedKey,
        description: product.description || null,
        image_url: product.imageUrl,
        mounting_pattern: specs.mountingPattern || '',
        weight_g: specs.weightG || 0,
        detected_specs: specsToJson(specs),
        spec_verified: false,
        quality_score: 5,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    canonicalId = newPart.id;
    created = true;

    // Insert the vendor listing
    await supabase.from('vendor_listings').insert({
      canonical_part_id: canonicalId,
      retailer_feed_id: feedId,
      title: product.title,
      vendor: product.vendor,
      url: product.url,
      price: product.price,
      currency: 'USD',
      in_stock: product.inStock,
      image_url: product.imageUrl,
      raw_data: product.rawData || {},
      last_seen_at: new Date().toISOString(),
    });
  }

  return { created, canonicalId };
}

function extractManufacturer(vendor: string, title: string): string {
  const knownBrands = [
    'SpeedyBee', 'BetaFPv', 'HGLRC', 'T-Motor', 'EMAX', 'Flycolor', 'Skystars',
    'JHEMCU', 'GEPRC', 'HAKRC', 'Diatone', 'iFlight', 'Armattan', 'Lumenier',
    'Pyrodrone', 'GetFPV', 'RaceDay', 'Foxeer', 'Caddx', 'DJI', 'RunCam',
    'Walksnail', 'FatShark', 'Stinger', 'Ethix', 'HQProp', 'Gemfan',
    'Dalprop', 'Aztec', 'BrotherHobby', 'Amax', 'Surgeon',
  ];

  for (const brand of knownBrands) {
    if (title.toLowerCase().includes(brand.toLowerCase())) return brand;
  }
  return vendor;
}

// ============================================================
// READ FUNCTIONS
// ============================================================

export async function getCanonicalPartsWithListings(
  category?: string,
  search?: string,
  limit = 50,
  offset = 0
): Promise<{ parts: (CanonicalPart & { vendor_listings: VendorListing[]; min_price: number | null; max_price: number | null; vendor_count: number })[]; total: number }> {
  let query = supabase
    .from('canonical_parts')
    .select('*, vendor_listings(*)', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (category && category !== 'all') {
    query = query.eq('category', category);
  }
  if (search) {
    query = query.or(`name.ilike.%${search}%,mpn.ilike.%${search}%,manufacturer.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[Catalog] Fetch error:', error.message);
    return { parts: [], total: 0 };
  }

  const parts = (data || []).map((p) => {
    const listings = (p.vendor_listings || []) as VendorListing[];
    const prices = listings.map((l) => l.price).filter((p) => p > 0);
    return {
      ...p,
      vendor_listings: listings,
      min_price: prices.length > 0 ? Math.min(...prices) : null,
      max_price: prices.length > 0 ? Math.max(...prices) : null,
      vendor_count: listings.length,
    };
  });

  return { parts, total: count || 0 };
}

export async function getRetailerFeeds(): Promise<FeedConfig[]> {
  const { data, error } = await supabase
    .from('retailer_feeds')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Catalog] Feeds fetch error:', error.message);
    return [];
  }

  return (data || []).map((f) => ({
    id: f.id,
    name: f.name,
    feedType: f.feed_type,
    url: f.url,
  }));
}

export async function getSyncLogs(limit = 10): Promise<SyncLogEntry[]> {
  const { data, error } = await supabase
    .from('catalog_sync_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Catalog] Sync logs error:', error.message);
    return [];
  }

  return (data || []) as unknown as SyncLogEntry[];
}

export type SyncLogEntry = {
  id: string;
  retailer_feed_id: string | null;
  feed_name: string;
  status: string;
  products_fetched: number;
  products_matched: number;
  products_created: number;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
};

export async function updateCanonicalPartSpecs(
  partId: string,
  specs: Record<string, unknown>,
  verified: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from('canonical_parts')
    .update({
      detected_specs: specs,
      spec_verified: verified,
      mounting_pattern: String(specs.mounting_pattern || ''),
      weight_g: Number(specs.weight_g) || 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', partId);

  if (error) {
    console.error('[Catalog] Update specs error:', error.message);
    return false;
  }
  return true;
}

export async function addRetailerFeed(
  name: string,
  feedType: 'shopify' | 'woocommerce' | 'csv',
  url: string
): Promise<boolean> {
  const { error } = await supabase.from('retailer_feeds').insert({
    name,
    feed_type: feedType,
    url,
    is_active: true,
  });

  if (error) {
    console.error('[Catalog] Add feed error:', error.message);
    return false;
  }
  return true;
}

export async function syncAllFeeds(): Promise<SyncResult[]> {
  const feeds = await getRetailerFeeds();
  const results: SyncResult[] = [];

  for (const feed of feeds) {
    const result = await syncFeed(feed);
    results.push(result);
  }

  return results;
}
