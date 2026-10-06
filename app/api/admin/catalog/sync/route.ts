import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchFromFeed, type FeedConfig } from '@/lib/ingestion/fetchers';
import { extractSpecs, specsToJson } from '@/lib/ingestion/spec-parser';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type SyncResultEntry = {
  feedId: string;
  feedName: string;
  status: 'success' | 'partial' | 'failed';
  productsFetched: number;
  productsMatched: number;
  productsCreated: number;
  errors: string[];
};

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

function extractManufacturer(vendor: string, title: string): string {
  const knownBrands = [
    'SpeedyBee', 'BetaFPv', 'HGLRC', 'T-Motor', 'EMAX', 'Flycolor', 'Skystars',
    'JHEMCU', 'GEPRC', 'HAKRC', 'Diatone', 'iFlight', 'Armattan', 'Lumenier',
    'Pyrodrone', 'Foxeer', 'Caddx', 'DJI', 'RunCam', 'Walksnail', 'FatShark',
    'Ethix', 'HQProp', 'Gemfan', 'Dalprop', 'BrotherHobby',
  ];
  for (const brand of knownBrands) {
    if (title.toLowerCase().includes(brand.toLowerCase())) return brand;
  }
  return vendor;
}

export async function POST(req: NextRequest) {
  try {
    // Get all active feeds
    const { data: feeds, error: feedsError } = await supabase
      .from('retailer_feeds')
      .select('*')
      .eq('is_active', true);

    if (feedsError) {
      return NextResponse.json({ error: feedsError.message }, { status: 500 });
    }

    if (!feeds || feeds.length === 0) {
      return NextResponse.json({ error: 'No active feeds to sync. Add a retailer feed first.' }, { status: 400 });
    }

    const results: SyncResultEntry[] = [];

    for (const feed of feeds) {
      const startTime = Date.now();
      const feedConfig: FeedConfig = {
        id: feed.id,
        name: feed.name,
        feedType: feed.feed_type,
        url: feed.url,
      };

      let productsFetched = 0;
      let productsMatched = 0;
      let productsCreated = 0;
      const errors: string[] = [];

      try {
        const fetchResult = await fetchFromFeed(feedConfig);
        errors.push(...fetchResult.errors);
        productsFetched = fetchResult.products.length;

        for (const product of fetchResult.products) {
          try {
            const specs = extractSpecs(product);
            const mpn = product.mpn || extractMpn(product.title);
            const normalizedKey = buildNormalizedKey(product.title, mpn);

            // Check for existing canonical part
            const { data: existing } = await supabase
              .from('canonical_parts')
              .select('id')
              .eq('normalized_key', normalizedKey)
              .maybeSingle();

            if (existing) {
              // Update vendor listing
              await supabase
                .from('vendor_listings')
                .upsert(
                  {
                    canonical_part_id: existing.id,
                    retailer_feed_id: feed.id,
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
              productsMatched++;
            } else {
              // Create new canonical part
              const { data: newPart, error: insertError } = await supabase
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

              if (insertError) {
                errors.push(`Insert failed for "${product.title}": ${insertError.message}`);
                continue;
              }

              await supabase.from('vendor_listings').insert({
                canonical_part_id: newPart.id,
                retailer_feed_id: feed.id,
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
              productsCreated++;
            }
          } catch (err) {
            errors.push(`Upsert failed for "${product.title}": ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      } catch (err) {
        errors.push(`Feed sync failed: ${err instanceof Error ? err.message : String(err)}`);
      }

      const durationMs = Date.now() - startTime;
      const status: SyncResultEntry['status'] = errors.length === 0 ? 'success' : productsFetched > 0 ? 'partial' : 'failed';

      // Update feed status
      await supabase
        .from('retailer_feeds')
        .update({
          last_synced_at: new Date().toISOString(),
          last_sync_status: status,
          last_sync_count: productsFetched,
        })
        .eq('id', feed.id);

      // Log sync
      await supabase.from('catalog_sync_logs').insert({
        retailer_feed_id: feed.id,
        feed_name: feed.name,
        status,
        products_fetched: productsFetched,
        products_matched: productsMatched,
        products_created: productsCreated,
        error_message: errors.length > 0 ? errors.join('; ').slice(0, 2000) : null,
        duration_ms: durationMs,
      });

      results.push({
        feedId: feed.id,
        feedName: feed.name,
        status,
        productsFetched,
        productsMatched,
        productsCreated,
        errors,
      });
    }

    return NextResponse.json({ results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
