'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, TrendingUp, Users, ShoppingBag, Settings, Star,
  Check, X, Loader2, Save, ArrowLeft, Store, Package,
  BadgeCheck, AlertCircle, Crown, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type Stats = {
  totalRevenue: number;
  totalCommission: number;
  totalOrders: number;
  activeSubscriptions: number;
  totalBuilders: number;
  commissionPercentage: number;
  vendorCount: number;
  partCount: number;
  recentOrders: { total: number; commission: number; status: string; date: string }[];
};

type Builder = {
  id: string;
  bio: string;
  location: string;
  subscription_status: string;
  assembly_fee: number;
  rating: number;
  created_at: string;
  stripe_account_id: string | null;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [builders, setBuilders] = useState<Builder[]>([]);
  const [loading, setLoading] = useState(true);
  const [commissionInput, setCommissionInput] = useState('5');
  const [savingCommission, setSavingCommission] = useState(false);
  const [commissionMsg, setCommissionMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [updatingBuilderId, setUpdatingBuilderId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, buildersRes] = await Promise.all([
        fetch('/api/admin/stats').then((r) => r.json()),
        fetch('/api/admin/builders').then((r) => r.json()),
      ]);
      if (statsRes && !statsRes.error) {
        setStats(statsRes);
        setCommissionInput(String(statsRes.commissionPercentage));
      }
      if (buildersRes && !buildersRes.error) {
        setBuilders(buildersRes.builders);
      }
    } catch (err) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveCommission = async () => {
    const value = parseFloat(commissionInput);
    if (isNaN(value) || value < 0 || value > 100) {
      setCommissionMsg({ ok: false, text: 'Enter a value between 0 and 100' });
      return;
    }
    setSavingCommission(true);
    setCommissionMsg(null);
    try {
      const res = await fetch('/api/admin/commission', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commissionPercentage: value }),
      });
      const data = await res.json();
      if (res.ok) {
        setCommissionMsg({ ok: true, text: `Commission set to ${data.commissionPercentage}%` });
        setStats((s) => s ? { ...s, commissionPercentage: data.commissionPercentage } : s);
      } else {
        setCommissionMsg({ ok: false, text: data.error || 'Failed to save' });
      }
    } catch {
      setCommissionMsg({ ok: false, text: 'Network error' });
    } finally {
      setSavingCommission(false);
    }
  };

  const updateBuilder = async (builderId: string, action: string, value: string | number | boolean) => {
    setUpdatingBuilderId(builderId);
    try {
      await fetch('/api/admin/builders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ builderId, action, value }),
      });
      await loadData();
    } catch {
      // ignore
    } finally {
      setUpdatingBuilderId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Configurator
          </button>
          <span className="text-slate-700">/</span>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-cyan-400" /> Admin Dashboard
          </h1>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/40"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </header>

      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Revenue"
            value={`$${(stats?.totalRevenue ?? 0).toFixed(2)}`}
            icon={DollarSign}
            color="cyan"
          />
          <StatCard
            label="Commission Earned"
            value={`$${(stats?.totalCommission ?? 0).toFixed(2)}`}
            icon={TrendingUp}
            color="emerald"
          />
          <StatCard
            label="Active Subscriptions"
            value={String(stats?.activeSubscriptions ?? 0)}
            subtext={`${stats?.totalBuilders ?? 0} total builders`}
            icon={Users}
            color="orange"
          />
          <StatCard
            label="Orders Processed"
            value={String(stats?.totalOrders ?? 0)}
            icon={ShoppingBag}
            color="blue"
          />
        </div>

        {/* Secondary stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MiniStat label="Vendors" value={String(stats?.vendorCount ?? 0)} icon={Store} />
          <MiniStat label="Parts Catalog" value={String(stats?.partCount ?? 0)} icon={Package} />
          <MiniStat
            label="Current Commission"
            value={`${stats?.commissionPercentage ?? 5}%`}
            icon={TrendingUp}
          />
        </div>

        {/* Commission control */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
          <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <Settings className="w-4 h-4 text-cyan-400" /> Platform Commission
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Set the percentage taken from each order as platform commission.
          </p>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={commissionInput}
                onChange={(e) => setCommissionInput(e.target.value)}
                className="w-full px-4 py-2.5 pr-10 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">%</span>
            </div>
            <button
              onClick={handleSaveCommission}
              disabled={savingCommission}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all',
                savingCommission
                  ? 'bg-slate-800 text-slate-500 cursor-wait'
                  : 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25'
              )}
            >
              {savingCommission ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
          {commissionMsg && (
            <div
              className={cn(
                'flex items-center gap-2 mt-3 text-xs',
                commissionMsg.ok ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {commissionMsg.ok ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {commissionMsg.text}
            </div>
          )}
        </div>

        {/* Builder management */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="p-6 pb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-orange-400" /> Builder Management
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Approve builders, update subscription tiers, and adjust assembly fees.
            </p>
          </div>

          {builders.length === 0 ? (
            <div className="px-6 pb-8 text-center text-sm text-slate-500">
              No builders registered yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-slate-800 bg-slate-800/20">
                    <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Builder</th>
                    <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Tier</th>
                    <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Fee</th>
                    <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Rating</th>
                    <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {builders.map((b) => {
                    const isApproved = !!b.stripe_account_id;
                    const isUpdating = updatingBuilderId === b.id;
                    return (
                      <tr key={b.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                              {b.location.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-200 truncate">{b.location}</p>
                              <p className="text-[10px] text-slate-500 line-clamp-1 max-w-[200px]">{b.bio}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                              <BadgeCheck className="w-3 h-3" /> Approved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                              <AlertCircle className="w-3 h-3" /> Pending
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <select
                            value={b.subscription_status}
                            onChange={(e) => updateBuilder(b.id, 'subscription_status', e.target.value)}
                            disabled={isUpdating}
                            className={cn(
                              'text-xs font-medium px-2.5 py-1.5 rounded-lg border bg-slate-800/60 text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors',
                              b.subscription_status === 'elite'
                                ? 'border-amber-500/30 text-amber-300'
                                : b.subscription_status === 'pro'
                                ? 'border-cyan-500/30 text-cyan-300'
                                : 'border-slate-700/40 text-slate-400'
                            )}
                          >
                            <option value="free">Free</option>
                            <option value="pro">Pro</option>
                            <option value="elite">Elite</option>
                          </select>
                        </td>
                        <td className="px-4 py-4">
                          <div className="relative">
                            <span className="text-xs text-slate-500 absolute left-2 top-1/2 -translate-y-1/2">$</span>
                            <input
                              type="number"
                              step="5"
                              min="0"
                              defaultValue={b.assembly_fee}
                              onBlur={(e) => {
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v) && v !== b.assembly_fee) {
                                  updateBuilder(b.id, 'assembly_fee', v);
                                }
                              }}
                              disabled={isUpdating}
                              className="w-20 pl-5 pr-2 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/30" />
                            <span className="text-xs text-slate-300">{Number(b.rating).toFixed(1)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isUpdating ? (
                            <Loader2 className="w-4 h-4 animate-spin text-slate-500 ml-auto" />
                          ) : isApproved ? (
                            <button
                              onClick={() => updateBuilder(b.id, 'approved', false)}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" /> Revoke
                            </button>
                          ) : (
                            <button
                              onClick={() => updateBuilder(b.id, 'approved', true)}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent orders */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="p-6 pb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-cyan-400" /> Recent Orders
            </h2>
          </div>
          {stats && stats.recentOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-slate-800 bg-slate-800/20">
                    <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Date</th>
                    <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Total</th>
                    <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentOrders.map((o, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="px-6 py-3 text-xs text-slate-400">
                        {new Date(o.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-800/40 px-2 py-0.5 rounded capitalize">
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-300 font-medium">${o.total.toFixed(2)}</td>
                      <td className="px-6 py-3 text-right text-xs text-emerald-400 font-medium">${o.commission.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 pb-8 text-center text-sm text-slate-500">
              No orders yet. Orders will appear here after customers check out.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  subtext?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'cyan' | 'emerald' | 'orange' | 'blue';
}) {
  const colorMap = {
    cyan: 'from-cyan-500/20 to-cyan-500/5 text-cyan-400 border-cyan-500/20',
    emerald: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/20',
    orange: 'from-orange-500/20 to-orange-500/5 text-orange-400 border-orange-500/20',
    blue: 'from-blue-500/20 to-blue-500/5 text-blue-400 border-blue-500/20',
  };
  return (
    <div className={cn('rounded-2xl border bg-gradient-to-br p-5', colorMap[color])}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
        <Icon className="w-5 h-5 opacity-70" />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {subtext && <p className="text-[10px] text-slate-500 mt-1">{subtext}</p>}
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
      <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center">
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <div>
        <p className="text-lg font-bold text-slate-200">{value}</p>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}
