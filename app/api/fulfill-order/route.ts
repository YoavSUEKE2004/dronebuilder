import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type VendorOrderPayload = {
  vendorName: string;
  items: Array<{
    title: string;
    url: string;
    price: number;
    quantity: number;
  }>;
  totalCost: number;
  status: 'pending';
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { selectedParts, customerDetails, totalPrice } = body;

    if (!selectedParts) {
      return NextResponse.json({ error: 'Missing selectedParts' }, { status: 400 });
    }

    // Fetch all selected components with their vendor listings
    const partIds = Object.values(selectedParts).filter((id: any) => id && id !== 'skip');

    if (partIds.length === 0) {
      return NextResponse.json({ error: 'No parts selected' }, { status: 400 });
    }

    const { data: components, error: compError } = await supabase
      .from('components')
      .select('*')
      .in('id', partIds);

    if (compError) {
      return NextResponse.json({ error: compError.message }, { status: 500 });
    }

    // Fetch vendor listings for these parts
    const { data: vendorListings, error: vlError } = await supabase
      .from('vendor_listings')
      .select('*, canonical_part_id')
      .in('canonical_part_id', partIds);

    // Group items by vendor for fulfillment
    const vendorGroups = new Map<string, Array<{ title: string; url: string; price: number; quantity: number }>>();

    for (const comp of components || []) {
      // Find the best (cheapest in-stock) vendor listing
      const listings = (vendorListings || []).filter(
        (vl: any) => vl.canonical_part_id === comp.id && vl.in_stock
      );

      const bestListing = listings.length > 0
        ? listings.reduce((min: any, l: any) => (l.price < min.price ? l : min), listings[0])
        : null;

      const vendorName = bestListing?.vendor_name || comp.store_name || 'Unknown Vendor';
      const vendorUrl = bestListing?.url || comp.product_url || '';
      const vendorPrice = bestListing ? Number(bestListing.price) : Number(comp.price);

      if (!vendorGroups.has(vendorName)) {
        vendorGroups.set(vendorName, []);
      }
      vendorGroups.get(vendorName)!.push({
        title: comp.name,
        url: vendorUrl,
        price: vendorPrice,
        quantity: 1,
      });
    }

    // Build vendor order payloads
    const vendorOrderPayloads: VendorOrderPayload[] = [];
    for (const [vendorName, items] of Array.from(vendorGroups)) {
      const totalCost = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      vendorOrderPayloads.push({
        vendorName,
        items,
        totalCost: Math.round(totalCost * 100) / 100,
        status: 'pending',
      });
    }

    // Create the order record
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_details: customerDetails || {},
        build_configuration: selectedParts,
        total_price: totalPrice || 0,
        status: 'ordered_from_vendor',
        vendor_order_payload: vendorOrderPayloads,
      })
      .select('id')
      .single();

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    return NextResponse.json({
      orderId: order.id,
      vendorOrders: vendorOrderPayloads,
      status: 'ordered_from_vendor',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
