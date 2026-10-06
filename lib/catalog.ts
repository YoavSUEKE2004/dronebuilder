// lib/catalog.ts
export async function getPartsByCategory(category: string): Promise<CanonicalPart[]> {
  // 1. Fetch EVERYTHING from the table without filtering by category first
  const { data, error } = await supabase
    .from('canonical_parts')
    .select('*, vendor_listings(*)');

  // 2. Print the raw results to your browser console
  console.log('--- DB RESPONSE CHECK ---');
  console.log('1. Requested category slug:', category);
  console.log('2. Error from Supabase (if any):', error);
  console.log('3. Raw rows returned from table:', data);

  if (error) {
    console.error('Error fetching parts:', error);
    return [];
  }

  // 3. Filter manually in JS to see if category strings match
  const filtered = (data || []).filter((item) => item.category === category);
  console.log('4. Rows matching requested category:', filtered);

  return filtered;
}