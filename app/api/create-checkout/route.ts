import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { ComponentWithSpecs, SelectedParts } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { selectedParts, fulfillmentType, builderId, builderFee, partsTotal, platformFee, grandTotal } = body as {
      selectedParts: SelectedParts;
      fulfillmentType: 'kit' | 'builder';
      builderId: string | null;
      builderFee: number;
      partsTotal: number;
      platformFee: number;
      grandTotal: number;
    };

    const componentIds = Object.values(selectedParts).filter((id): id is string => id !== null);
    const { data: components } = await supabase
      .from('components')
      .select('id, name, price, store_name, image_url')
      .in('id', componentIds) as { data: ComponentWithSpecs[] | null };

    if (!components || components.length === 0) {
      return NextResponse.json({ error: 'No components found' }, { status: 400 });
    }

    const vendorTotals: Record<string, { amount: number; parts: string[] }> = {};
    for (const comp of components) {
      const store = comp.store_name || 'Platform';
      if (!vendorTotals[store]) vendorTotals[store] = { amount: 0, parts: [] };
      vendorTotals[store].amount += Number(comp.price);
      vendorTotals[store].parts.push(comp.name);
    }

    const sessionId = `cs_test_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const sessionData = {
      session_id: sessionId,
      selected_parts: selectedParts,
      fulfillment_type: fulfillmentType,
      builder_id: fulfillmentType === 'builder' ? builderId : null,
      builder_fee: builderFee,
      parts_total: partsTotal,
      platform_fee: platformFee,
      grand_total: grandTotal,
      vendor_totals: vendorTotals,
      components: components.map((c) => ({ id: c.id, name: c.name, price: Number(c.price), store_name: c.store_name, image_url: c.image_url })),
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    await supabase.from('builds').insert({
      selected_parts: selectedParts,
      fulfillment_type: fulfillmentType,
      total_price: grandTotal,
      platform_fee_amount: platformFee,
      builder_id: fulfillmentType === 'builder' ? builderId : null,
      build_status: 'ordered',
    });

    return NextResponse.json({ sessionId, sessionData });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
