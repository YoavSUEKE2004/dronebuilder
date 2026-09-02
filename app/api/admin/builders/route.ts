import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest) {
  try {
    const { builderId, action, value } = await req.json() as {
      builderId: string;
      action: 'subscription_status' | 'assembly_fee' | 'rating' | 'approved';
      value: string | number | boolean;
    };

    if (!builderId || !action) {
      return NextResponse.json({ error: 'Missing builderId or action' }, { status: 400 });
    }

    const update: Record<string, unknown> = {};

    if (action === 'subscription_status') {
      if (!['free', 'pro', 'elite'].includes(value as string)) {
        return NextResponse.json({ error: 'Invalid subscription status' }, { status: 400 });
      }
      update.subscription_status = value;
    } else if (action === 'assembly_fee') {
      update.assembly_fee = value;
    } else if (action === 'rating') {
      update.rating = value;
    } else if (action === 'approved') {
      update.stripe_account_id = value === true ? 'acct_approved' : null;
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { error } = await supabase.from('builders').update(update).eq('id', builderId);

    if (error) {
      return NextResponse.json({ error: 'Failed to update builder' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update builder' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('builders')
      .select('id, bio, location, subscription_status, assembly_fee, rating, created_at, stripe_account_id')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to load builders' }, { status: 500 });
    }

    return NextResponse.json({ builders: data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load builders' }, { status: 500 });
  }
}
