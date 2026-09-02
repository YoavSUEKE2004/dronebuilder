import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function PUT(req: NextRequest) {
  try {
    const { commissionPercentage } = await req.json() as { commissionPercentage: number };

    if (typeof commissionPercentage !== 'number' || commissionPercentage < 0 || commissionPercentage > 100) {
      return NextResponse.json({ error: 'Commission must be between 0 and 100' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('platform_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    let result;
    if (existing) {
      result = await supabase
        .from('platform_settings')
        .update({ commission_percentage: commissionPercentage, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('commission_percentage')
        .single();
    } else {
      result = await supabase
        .from('platform_settings')
        .insert({ commission_percentage: commissionPercentage })
        .select('commission_percentage')
        .single();
    }

    if (result.error) {
      return NextResponse.json({ error: 'Failed to update commission' }, { status: 500 });
    }

    return NextResponse.json({ commissionPercentage: result.data.commission_percentage });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update commission' }, { status: 500 });
  }
}
