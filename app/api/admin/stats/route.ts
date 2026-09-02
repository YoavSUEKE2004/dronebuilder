import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const [buildsRes, buildersRes, settingsRes, componentsRes] = await Promise.all([
      supabase.from('builds').select('total_price, platform_fee_amount, build_status, created_at'),
      supabase.from('builders').select('id, subscription_status, rating, assembly_fee, location, bio, created_at, stripe_account_id'),
      supabase.from('platform_settings').select('commission_percentage').limit(1).maybeSingle(),
      supabase.from('components').select('id, category, store_name', { count: 'exact', head: false }),
    ]);

    const builds = buildsRes.data ?? [];
    const totalRevenue = builds.reduce((sum, b) => sum + Number(b.total_price), 0);
    const totalCommission = builds.reduce((sum, b) => sum + Number(b.platform_fee_amount), 0);
    const totalOrders = builds.length;
    const activeSubscriptions = (buildersRes.data ?? []).filter(
      (b) => b.subscription_status === 'pro' || b.subscription_status === 'elite'
    ).length;

    const recentOrders = builds
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map((b) => ({
        total: Number(b.total_price),
        commission: Number(b.platform_fee_amount),
        status: b.build_status,
        date: b.created_at,
      }));

    const vendorCount = new Set((componentsRes.data ?? []).map((c) => c.store_name)).size;
    const partCount = componentsRes.data?.length ?? 0;

    return NextResponse.json({
      totalRevenue,
      totalCommission,
      totalOrders,
      activeSubscriptions,
      totalBuilders: (buildersRes.data ?? []).length,
      commissionPercentage: settingsRes.data?.commission_percentage ?? 5.0,
      recentOrders,
      vendorCount,
      partCount,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
