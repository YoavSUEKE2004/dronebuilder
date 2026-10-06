import { supabase } from '@/lib/supabase'; // Adjust file name if your client is in supabaseClient.ts or utils/supabase

export interface VendorListing {
  id: string;
  part_id: string;
  vendor_name: string;
  price: number;
  url: string;
  in_stock: boolean;
}

export interface CanonicalPart {
  id: string;
  name: string;
  brand: string;
  category: string;
  mounting_pattern?: string;
  voltage_range?: string;
  continuous_current?: number;
  mcu?: string;
  kv_rating?: number;
  vendor_listings?: VendorListing[];
}

export async function getPartsByCategory(category: string): Promise<CanonicalPart[]> {
  // 1. Fetch EVERYTHING from the table without filtering by category first
  const { data, error } = await supabase
    .from('canonical_parts')
    .select('*, vendor_listings(*)');

  // 2. Print raw results to browser console
  console.log('--- DB RESPONSE CHECK ---');
  console.log('1. Requested category slug:', category);
  console.log('2. Error from Supabase:', error);
  console.log('3. Raw rows returned from table:', data);

  if (error) {
    console.error('Error fetching parts:', error);
    return [];
  }

  // 3. Filter manually in JS to check string matching
  const filtered = (data || []).filter((item) => item.category === category);
  console.log('4. Rows matching requested category:', filtered);

  return filtered;
}