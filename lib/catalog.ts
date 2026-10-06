import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface CanonicalPart {
  id: string;
  name: string;
  category: string;
  brand: string;
  mounting_pattern?: string;
  voltage_range?: string;
  kv_rating?: number;
  mcu?: string;
  continuous_current?: number;
  image_url?: string;
  vendor_listings: {
    id: string;
    title: string;
    price: number;
    in_stock: boolean;
    product_url: string;
  }[];
}

export async function getPartsByCategory(category: string): Promise<CanonicalPart[]> {
  const { data, error } = await supabase
    .from('canonical_parts')
    .select(`
      id,
      name,
      category,
      brand,
      mounting_pattern,
      voltage_range,
      kv_rating,
      mcu,
      continuous_current,
      image_url,
      vendor_listings (
        id,
        title,
        price,
        in_stock,
        product_url
      )
    `)
    .eq('category', category);

  if (error) {
    console.error(`Error fetching ${category} parts:`, error);
    return [];
  }

  return data || [];
}