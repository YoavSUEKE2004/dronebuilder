'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, RefreshCw, Store, Package, Plus, Loader2, Check, X,
  AlertCircle, ExternalLink, Search, ChevronDown, ChevronRight,
  DollarSign, Tag, Edit3, Save, Boxes, Activity, Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type VendorListing = {
  id: string;
  canonical_part_id: string;
  retailer_feed_id: string | null;
  title: string;
  vendor: string;
  url: string;
  price: number;
  currency: string;
  in_stock: boolean;
  stock_quantity: number | null;
  image_url: string;
  last_seen_at: string;
};

type CanonicalPart = {
  id: string;
  name: string;
  category: string;
  manufacturer: string;
  mpn: string;
  normalized_key: string;
  description: string | null;
  image_url: string;
  mounting_pattern: string;
  weight_g: number;
  dimensions_mm: string;
  detected_specs: Record<string, unknown>;
  spec_verified: boolean;
  quality_score: number;
  created_at: string;
  updated_at: string;
  vendor_listings: VendorListing[];
  min_price: number | null;
  max_price: number | null;
  vendor_count: number;
};

type RetailerFeed = {
  id: string;
  name: string;
  feed_type: string;
  url: string;
  is_active: boolean;
  last_synced_at: string | null;
  last_sync_status: string;
  last_sync_count: number;
};

type SyncLog = {
  id: string;
  feed_name: string;
  status: string;
  products_fetched: number;
  products_matched: number;
  products_created: number;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
};

const CATEGORIES = ['all', 'frame', 'motor', 'esc', 'flight_controller', 'propeller', 'battery', 'camera', 'vtx', 'receiver', 'goggles', 'remote'];

export default function CatalogAdminPage() {
  const router = useRouter();
  const [parts, setParts] = useState<CanonicalPart[]>([]);
  const [total, setTotal] = useState(0);
  const [feeds, setFeeds] = useState<RetailerFeed[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedPartId, setExpandedPartId] = useState<string | null>(null);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [editSpecs, setEditSpecs] = useState<Record<string, string>>({});
  const [savingSpecs, setSavingSpecs] = useState(false);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [newFeed, setNewFeed] = useState({ name: '', type: 'shopify', url: '' });
  const [addingFeed, setAddingFeed] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (search) params.set('search', search);
      params.set('limit', '50');

      const res = await fetch(`/api/admin/catalog?${params.toString()}`);
      const data = await res.json();
      if (data.parts) {
        setParts(data.parts);
        setTotal(data.total || 0);
      }
      if (data.feeds) setFeeds(data.feeds);
      if (data.syncLogs) setSyncLogs(data.syncLogs);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch('/api/admin/catalog/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        const totalFetched = (data.results || []).reduce((s: number, r: any) => s + r.productsFetched, 0);
        const totalCreated = (data.results || []).reduce((s: number, r: any) => s + r.productsCreated, 0);
        setSyncMsg({ ok: true, text: `Synced ${data.results.length} feeds: ${totalFetched} products fetched, ${totalCreated} new parts created.` });
        await loadData();
      } else {
        setSyncMsg({ ok: false, text: data.error || 'Sync failed' });
      }
    } catch {
      setSyncMsg({ ok: false, text: 'Network error during sync' });
    } finally {
      setSyncing(false);
    }
  };

  const handleAddFeed = async () => {
    if (!newFeed.name || !newFeed.url) return;
    setAddingFeed(true);
    try {
      const res = await fetch('/api/admin/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFeed),
      });
      if (res.ok) {
        setNewFeed({ name: '', type: 'shopify', url: '' });
        setShowAddFeed(false);
        await loadData();
      }
    } catch {
      // ignore
    } finally {
      setAddingFeed(false);
    }
  };

  const startEdit = (part: CanonicalPart) => {
    const specs = part.detected_specs || {};
    setEditSpecs({
      mounting_pattern: String(specs.mounting_pattern || ''),
      motor_kv: String(specs.motor_kv || ''),
      voltage_s: String(specs.voltage_s || ''),
      voltage_range: String(specs.voltage_range || ''),
      mcu_chip: String(specs.mcu_chip || ''),
      gyro_chip: String(specs.gyro_chip || ''),
      camera_size: String(specs.camera_size || ''),
      prop_diameter: String(specs.prop_diameter || ''),
      category: String(specs.category || part.category || ''),
      weight_g: String(specs.weight_g || ''),
    });
    setEditingPartId(part.id);
  };

  const saveEdit = async (partId: string) => {
    setSavingSpecs(true);
    try {
      const specsObj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(editSpecs)) {
        if (v.trim()) {
          if (k === 'motor_kv' || k === 'voltage_s' || k === 'weight_g') {
            specsObj[k] = parseInt(v, 10) || null;
          } else {
            specsObj[k] = v.trim();
          }
        } else {
          specsObj[k] = null;
        }
      }

      await fetch('/api/admin/catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partId, specs: specsObj, verified: true }),
      });

      setEditingPartId(null);
      await loadData();
    } catch {
      // ignore
    } finally {
      setSavingSpecs(false);
    }
  };

  const formatSpecs = (specs: Record<string, unknown>): string[] => {
    const result: string[] = [];
    if (specs.mounting_pattern) result.push(String(specs.mounting_pattern));
    if (specs.motor_kv) result.push(`${specs.motor_kv}KV`);
    if (specs.voltage_range) result.push(String(specs.voltage_range));
    else if (specs.voltage_s) result.push(`${specs.voltage_s}S`);
    if (specs.mcu_chip) result.push(String(specs.mcu_chip));
    if (specs.gyro_chip) result.push(String(specs.gyro_chip));
    if (specs.camera_size) result.push(String(specs.camera_size));
    if (specs.prop_diameter) result.push(`${specs.prop_diameter} prop`);
    return result;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Admin
          </button>
          <span className="text-slate-700">/</span>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-cyan-400" /> Catalog Ingestion
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddFeed(!showAddFeed)}
            className="flex items-center gap-2 text-xs text-slate-300 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/40 hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Feed
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className={cn(
              'flex items-center gap-2 text-xs font-semibold px-4 py-1.5 rounded-lg transition-all',
              syncing
                ? 'bg-slate-800 text-slate-500 cursor-wait'
                : 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25'
            )}
          >
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Sync Retailer Feeds
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Sync message */}
        {syncMsg && (
          <div className={cn(
            'flex items-start gap-2 px-4 py-3 rounded-lg text-sm',
            syncMsg.ok ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'
          )}>
            {syncMsg.ok ? <Check className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
            {syncMsg.text}
          </div>
        )}

        {/* Add feed form */}
        {showAddFeed && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Store className="w-4 h-4 text-cyan-400" /> Add Retailer Feed
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Feed name (e.g. GetFPV)"
                value={newFeed.name}
                onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
                className="px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
              <select
                value={newFeed.type}
                onChange={(e) => setNewFeed({ ...newFeed, type: e.target.value })}
                className="px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors"
              >
                <option value="shopify">Shopify</option>
                <option value="woocommerce">WooCommerce</option>
                <option value="csv">CSV Feed</option>
              </select>
              <input
                type="text"
                placeholder="Store URL (e.g. getfpv.com)"
                value={newFeed.url}
                onChange={(e) => setNewFeed({ ...newFeed, url: e.target.value })}
                className="px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors md:col-span-2"
              />
              <button
                onClick={handleAddFeed}
                disabled={addingFeed || !newFeed.name || !newFeed.url}
                className={cn(
                  'flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  addingFeed || !newFeed.name || !newFeed.url
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25'
                )}
              >
                {addingFeed ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add
              </button>
            </div>
          </div>
        )}

        {/* Feeds overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Store className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Retailer Feeds</h3>
            </div>
            {feeds.length === 0 ? (
              <p className="text-xs text-slate-500">No feeds configured. Add one to start ingesting.</p>
            ) : (
              <div className="space-y-2">
                {feeds.slice(0, 5).map((f) => (
                  <div key={f.id} className="flex items-center justify-between text-xs">
                    <div className="min-w-0">
                      <p className="text-slate-300 font-medium truncate">{f.name}</p>
                      <p className="text-slate-600 text-[10px] uppercase">{f.feed_type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400">{f.last_sync_count || 0} items</p>
                      <p className={cn(
                        'text-[10px]',
                        f.last_sync_status === 'success' ? 'text-emerald-400' : f.last_sync_status === 'partial' ? 'text-amber-400' : 'text-slate-500'
                      )}>
                        {f.last_sync_status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Catalog Stats</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-2xl font-bold text-white">{total}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total Parts</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-cyan-400">
                  {parts.filter((p) => p.spec_verified).length}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Verified</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-400">
                  {parts.filter((p) => !p.spec_verified).length}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Needs Review</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-300">{feeds.length}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Feeds</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-orange-400" />
              <h3 className="text-sm font-semibold text-white">Recent Syncs</h3>
            </div>
            {syncLogs.length === 0 ? (
              <p className="text-xs text-slate-500">No sync runs yet.</p>
            ) : (
              <div className="space-y-2">
                {syncLogs.slice(0, 4).map((log) => (
                  <div key={log.id} className="flex items-center justify-between text-xs">
                    <div className="min-w-0">
                      <p className="text-slate-300 font-medium truncate">{log.feed_name}</p>
                      <p className="text-slate-600 text-[10px]">
                        {log.products_fetched} fetched · {log.products_created} new
                      </p>
                    </div>
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full',
                      log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                    )}>
                      {log.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Search + filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search parts by name, MPN, or manufacturer..."
              className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-lg border transition-all capitalize',
                  categoryFilter === cat
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                )}
              >
                {cat === 'all' ? 'All' : cat.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Parts table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : parts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="w-10 h-10 text-slate-700 mb-3" />
            <p className="text-sm text-slate-500">No parts in catalog yet.</p>
            <p className="text-xs text-slate-600 mt-1">Add a retailer feed and click "Sync Retailer Feeds" to start ingesting.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {parts.map((part) => {
              const isExpanded = expandedPartId === part.id;
              const isEditing = editingPartId === part.id;
              const specList = formatSpecs(part.detected_specs);
              const listings = part.vendor_listings || [];

              return (
                <div key={part.id} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                  {/* Main row */}
                  <div
                    onClick={() => setExpandedPartId(isExpanded ? null : part.id)}
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="w-12 h-12 shrink-0 rounded-lg bg-slate-800 border border-slate-700/40 flex items-center justify-center overflow-hidden">
                      {part.image_url ? (
                        <img src={part.image_url} alt={part.name} className="w-full h-full object-contain"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <Package className="w-5 h-5 text-slate-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-slate-200 truncate">{part.name}</h3>
                        {part.spec_verified ? (
                          <span className="flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                            <Check className="w-2.5 h-2.5" /> Verified
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                            <AlertCircle className="w-2.5 h-2.5" /> Unverified
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {part.category && (
                          <span className="text-[10px] text-slate-500 capitalize">{part.category.replace('_', ' ')}</span>
                        )}
                        {part.manufacturer && (
                          <span className="text-[10px] text-slate-600">· {part.manufacturer}</span>
                        )}
                        {specList.slice(0, 3).map((s, i) => (
                          <span key={i} className="text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                      </div>
                    </div>

                    {/* Price comparison */}
                    <div className="text-right shrink-0">
                      {part.min_price !== null && (
                        <p className="text-sm font-bold text-emerald-400">
                          ${part.min_price.toFixed(2)}
                          {part.max_price !== null && part.max_price !== part.min_price && (
                            <span className="text-slate-500 text-xs"> - ${part.max_price.toFixed(2)}</span>
                          )}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-500">
                        {part.vendor_count} vendor{part.vendor_count !== 1 ? 's' : ''}
                      </p>
                    </div>

                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-slate-800 p-4 space-y-4 bg-slate-950/30">
                      {/* Vendor listings */}
                      <div>
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Tag className="w-3 h-3" /> Vendor Listings
                        </h4>
                        {listings.length === 0 ? (
                          <p className="text-xs text-slate-600">No vendor listings linked.</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {listings.map((l) => (
                              <div key={l.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium text-slate-300 truncate">{l.vendor}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-xs text-emerald-400 font-medium">${l.price.toFixed(2)}</span>
                                    <span className={cn(
                                      'text-[9px] px-1 py-0.5 rounded',
                                      l.in_stock ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                    )}>
                                      {l.in_stock ? 'In Stock' : 'Out'}
                                    </span>
                                  </div>
                                </div>
                                {l.url && (
                                  <a
                                    href={l.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-slate-500 hover:text-cyan-400 transition-colors p-1"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Specs editor */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Settings className="w-3 h-3" /> Detected Specs
                          </h4>
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingPartId(null); }}
                                className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); saveEdit(part.id); }}
                                disabled={savingSpecs}
                                className={cn(
                                  'flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg font-medium transition-all',
                                  savingSpecs ? 'bg-slate-800 text-slate-500' : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                                )}
                              >
                                {savingSpecs ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                Save & Verify
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); startEdit(part); }}
                              className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 px-2 py-1"
                            >
                              <Edit3 className="w-3 h-3" /> Edit
                            </button>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {Object.entries(editSpecs).map(([key, val]) => (
                              <div key={key}>
                                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                                  {key.replace(/_/g, ' ')}
                                </label>
                                <input
                                  type="text"
                                  value={val}
                                  onChange={(e) => setEditSpecs({ ...editSpecs, [key]: e.target.value })}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-2 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors"
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {specList.length === 0 ? (
                              <p className="text-xs text-slate-600">No specs detected. Click "Edit" to add manually.</p>
                            ) : (
                              specList.map((s, i) => (
                                <span key={i} className="text-xs text-slate-300 bg-slate-800/60 border border-slate-700/40 px-2 py-1 rounded-lg">
                                  {s}
                                </span>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
