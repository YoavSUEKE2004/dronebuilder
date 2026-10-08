'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign, TrendingUp, Users, ShoppingBag, Settings, Star,
  Check, X, Loader2, Save, ArrowLeft, Store, Package,
  BadgeCheck, AlertCircle, RefreshCw, Plus, Edit3, ExternalLink,
  Search, Boxes, ClipboardList, Zap, Truck, AlertTriangle,
  Wand2, Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

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

type VendorListing = {
  id: string;
  canonical_part_id: string;
  vendor_name: string;
  title: string;
  url: string;
  buy_price: number | null;
  sell_price: number;
  in_stock: boolean;
};

type InventoryPart = {
  id: string;
  name: string;
  category: string;
  brand: string;
  image_url: string;
  mounting_pattern: string;
  voltage_range: string;
  max_current: number | null;
  weight_g: number;
  video_system: string | null;
  vendor_listings: VendorListing[];
  min_buy_price: number | null;
  min_sell_price: number | null;
  max_sell_price: number | null;
  vendor_count: number;
  any_in_stock: boolean;
};

type Tab = 'add-part' | 'inventory' | 'orders';

const CATEGORY_OPTIONS = [
  { value: 'flight_controller', label: 'Flight Controller' },
  { value: 'esc', label: 'ESC' },
  { value: 'motor', label: 'Motor' },
  { value: 'frame', label: 'Frame' },
  { value: 'vtx', label: 'VTX' },
  { value: 'camera', label: 'Camera' },
  { value: 'receiver', label: 'Receiver' },
  { value: 'battery', label: 'Battery' },
  { value: 'propeller', label: 'Propellers' },
];

const VIDEO_STANDARDS = ['Digital', 'Analog'];

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('add-part');
  const [stats, setStats] = useState<Stats | null>(null);
  const [builders, setBuilders] = useState<Builder[]>([]);
  const [loading, setLoading] = useState(true);
  const [commissionInput, setCommissionInput] = useState('5');
  const [savingCommission, setSavingCommission] = useState(false);
  const [updatingBuilderId, setUpdatingBuilderId] = useState<string | null>(null);

  // Add-part form state
  const [form, setForm] = useState({
    name: '', brand: '', category: 'flight_controller', imageUrl: '',
    mountingPattern: '', voltageRange: '', maxCurrent: '', mcu: '', weightG: '', videoStandard: '',
    vendorName: '', supplierUrl: '', buyPrice: '', sellPrice: '', inStock: true,
  });
  const [submitting, setSubmitting] = useState(false);

  // Scrape state
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  // Inventory state
  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const [invSearch, setInvSearch] = useState('');
  const [invCategory, setInvCategory] = useState('all');
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ url?: string; sell_price?: string; buy_price?: string; in_stock?: boolean }>({});
  const [patchingId, setPatchingId] = useState<string | null>(null);

  const marginPreview = useMemo(() => {
    const buy = parseFloat(form.buyPrice);
    const sell = parseFloat(form.sellPrice);
    if (!isNaN(buy) && !isNaN(sell) && buy > 0 && sell > 0) {
      const profit = sell - buy;
      const pct = (profit / sell) * 100;
      return { profit, pct, valid: true };
    }
    return { profit: 0, pct: 0, valid: false };
  }, [form.buyPrice, form.sellPrice]);

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
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInventory = useCallback(async () => {
    setInvLoading(true);
    try {
      const res = await fetch('/api/admin/inventory');
      const data = await res.json();
      if (data.parts) setParts(data.parts);
    } catch {
      // ignore
    } finally {
      setInvLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeTab === 'inventory') loadInventory();
  }, [activeTab, loadInventory]);

  const handleSaveCommission = async () => {
    const value = parseFloat(commissionInput);
    if (isNaN(value) || value < 0 || value > 100) return;
    setSavingCommission(true);
    try {
      const res = await fetch('/api/admin/commission', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commissionPercentage: value }),
      });
      const data = await res.json();
      if (res.ok) {
        setStats((s) => s ? { ...s, commissionPercentage: data.commissionPercentage } : s);
        toast.success(`Commission set to ${data.commissionPercentage}%`);
      }
    } catch {
      toast.error('Failed to save commission');
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

  const handleScrape = async () => {
    if (!scrapeUrl) return;
    setScraping(true);
    setScrapeError(null);
    try {
      const res = await fetch('/api/admin/scrape-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        setForm((prev) => ({
          ...prev,
          name: data.name || prev.name,
          brand: data.brand || prev.brand,
          category: data.category || prev.category,
          imageUrl: data.image_url || prev.imageUrl,
          mountingPattern: data.mounting_pattern || prev.mountingPattern,
          voltageRange: data.voltage_range || prev.voltageRange,
          maxCurrent: data.continuous_current != null ? String(data.continuous_current) : prev.maxCurrent,
          mcu: data.mcu || prev.mcu,
          weightG: data.weight_g != null ? String(data.weight_g) : prev.weightG,
          buyPrice: data.buy_price != null ? String(data.buy_price) : prev.buyPrice,
          vendorName: data.vendor_name || prev.vendorName,
          supplierUrl: data.supplier_url || scrapeUrl,
        }));
        toast.success('Auto-filled from supplier page — review and adjust before saving');
      } else {
        setScrapeError(data.error || 'Failed to scrape page');
        toast.error(data.error || 'Failed to scrape page');
      }
    } catch {
      setScrapeError('Network error while scraping');
      toast.error('Network error while scraping');
    } finally {
      setScraping(false);
    }
  };

  const handleSubmitPart = async () => {
    if (!form.name || !form.category || !form.vendorName || !form.supplierUrl) {
      toast.error('Fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          brand: form.brand,
          category: form.category,
          imageUrl: form.imageUrl,
          mountingPattern: form.mountingPattern,
          voltageRange: form.voltageRange,
          maxCurrent: form.maxCurrent ? parseFloat(form.maxCurrent) : null,
          mcu: form.mcu || null,
          weightG: form.weightG ? parseFloat(form.weightG) : 0,
          videoStandard: form.videoStandard || null,
          vendorName: form.vendorName,
          supplierUrl: form.supplierUrl,
          buyPrice: form.buyPrice ? parseFloat(form.buyPrice) : null,
          sellPrice: form.sellPrice ? parseFloat(form.sellPrice) : 0,
          inStock: form.inStock,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`"${form.name}" added to catalog with ${form.vendorName} listing`);
        setForm({
          name: '', brand: '', category: 'flight_controller', imageUrl: '',
          mountingPattern: '', voltageRange: '', maxCurrent: '', mcu: '', weightG: '', videoStandard: '',
          vendorName: '', supplierUrl: '', buyPrice: '', sellPrice: '', inStock: true,
        });
        // Switch to inventory tab to show the new part
        setActiveTab('inventory');
        loadInventory();
      } else {
        toast.error(data.error || 'Failed to add part');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const startEditListing = (listing: VendorListing) => {
    setEditingListingId(listing.id);
    setEditValues({
      url: listing.url,
      sell_price: String(listing.sell_price),
      buy_price: listing.buy_price ? String(listing.buy_price) : '',
      in_stock: listing.in_stock,
    });
  };

  const saveListingEdit = async (listingId: string) => {
    setPatchingId(listingId);
    try {
      const updates: Record<string, unknown> = {};
      if (editValues.url !== undefined) updates.url = editValues.url;
      if (editValues.sell_price !== undefined) updates.sell_price = parseFloat(editValues.sell_price) || 0;
      if (editValues.buy_price !== undefined) updates.buy_price = editValues.buy_price ? parseFloat(editValues.buy_price) : null;
      if (editValues.in_stock !== undefined) updates.in_stock = editValues.in_stock;

      const res = await fetch('/api/admin/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, updates }),
      });
      if (res.ok) {
        toast.success('Listing updated');
        setEditingListingId(null);
        loadInventory();
      } else {
        toast.error('Failed to update listing');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setPatchingId(null);
    }
  };

  const toggleStock = async (listing: VendorListing) => {
    setPatchingId(listing.id);
    try {
      const res = await fetch('/api/admin/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id, updates: { in_stock: !listing.in_stock } }),
      });
      if (res.ok) loadInventory();
    } catch {
      // ignore
    } finally {
      setPatchingId(null);
    }
  };

  const filteredParts = useMemo(() => {
    return parts.filter((p) => {
      if (invCategory !== 'all' && p.category !== invCategory) return false;
      if (invSearch) {
        const q = invSearch.toLowerCase();
        return p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [parts, invSearch, invCategory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Toaster position="top-right" theme="dark" richColors />

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
            <Settings className="w-5 h-5 text-cyan-400" /> Admin Portal
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/admin/catalog')}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/40"
          >
            <Boxes className="w-3.5 h-3.5" /> Catalog Ingestion
          </button>
          <button
            onClick={() => { loadData(); if (activeTab === 'inventory') loadInventory(); }}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/40"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </header>

      {/* Tab navigation */}
      <div className="sticky top-[57px] z-10 flex items-center gap-1 px-6 py-2 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
        <TabButton active={activeTab === 'add-part'} onClick={() => setActiveTab('add-part')} icon={Plus} label="Add New Part & Supplier" />
        <TabButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={Package} label="Parts Inventory & Margin Manager" />
        <TabButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={ClipboardList} label="Orders & Fulfillment Queue" />
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Stats bar (always visible) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <MiniStat label="Total Revenue" value={`$${(stats?.totalRevenue ?? 0).toFixed(2)}`} icon={DollarSign} />
          <MiniStat label="Parts Catalog" value={String(stats?.partCount ?? 0)} icon={Package} />
          <MiniStat label="Orders" value={String(stats?.totalOrders ?? 0)} icon={ShoppingBag} />
          <MiniStat label="Commission" value={`${stats?.commissionPercentage ?? 5}%`} icon={TrendingUp} />
        </div>

        {/* === TAB 1: Add New Part === */}
        {activeTab === 'add-part' && (
          <div className="space-y-6">
            {/* URL Auto-Fill & Scrape */}
            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/5 rounded-2xl border border-cyan-500/20 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Wand2 className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">URL Auto-Fill & Scrape</h3>
                <span className="text-[10px] text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-full">AI-powered</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Paste a supplier product page URL and let AI extract the part name, specs, price, and image automatically.
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={scrapeUrl}
                    onChange={(e) => setScrapeUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && scrapeUrl && !scraping) handleScrape(); }}
                    placeholder="https://getfpv.com/speedybee-f405-v3-flight-controller.html"
                    className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-slate-900/80 border border-slate-700/50 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
                  />
                </div>
                <button
                  onClick={handleScrape}
                  disabled={scraping || !scrapeUrl}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition-all',
                    scraping || !scrapeUrl
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 shadow-lg shadow-cyan-500/20'
                  )}
                >
                  {scraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {scraping ? 'Scraping...' : 'Auto-Fill from URL'}
                </button>
              </div>
              {scraping && (
                <div className="flex items-center gap-2 mt-3 text-xs text-cyan-400">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '300ms' }} />
                  </div>
                  Fetching page and extracting product data with AI...
                </div>
              )}
              {scrapeError && !scraping && (
                <div className="flex items-center gap-2 mt-3 text-xs text-red-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {scrapeError}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Core Part Information */}
            <div className="lg:col-span-2 space-y-6">
              <FormCard title="Core Part Information" icon={Package} accent="cyan">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Part Name" required>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. SpeedyBee F405 V3"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Brand">
                    <input
                      type="text"
                      value={form.brand}
                      onChange={(e) => setForm({ ...form, brand: e.target.value })}
                      placeholder="e.g. SpeedyBee"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Category" required>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className={inputClass}
                    >
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Image URL">
                    <input
                      type="text"
                      value={form.imageUrl}
                      onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                      placeholder="https://..."
                      className={inputClass}
                    />
                  </Field>
                </div>

                {/* Image preview */}
                {form.imageUrl && (
                  <div className="mt-4">
                    <div className="w-24 h-24 rounded-lg border border-slate-700/50 bg-slate-800/40 overflow-hidden flex items-center justify-center">
                      <img
                        src={form.imageUrl}
                        alt="Preview"
                        className="w-full h-full object-contain"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.2'; }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Specifications</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Mounting Pattern" hint="e.g. 30.5x30.5mm, 20x20mm">
                      <input
                        type="text"
                        value={form.mountingPattern}
                        onChange={(e) => setForm({ ...form, mountingPattern: e.target.value })}
                        placeholder="30.5x30.5mm"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Voltage Tolerance" hint="e.g. 4S-6S">
                      <input
                        type="text"
                        value={form.voltageRange}
                        onChange={(e) => setForm({ ...form, voltageRange: e.target.value })}
                        placeholder="4S-6S"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Max Current (Amps)" hint="For ESC/Motors">
                      <input
                        type="number"
                        value={form.maxCurrent}
                        onChange={(e) => setForm({ ...form, maxCurrent: e.target.value })}
                        placeholder="45"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Weight (grams)">
                      <input
                        type="number"
                        value={form.weightG}
                        onChange={(e) => setForm({ ...form, weightG: e.target.value })}
                        placeholder="8.5"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="MCU" hint="e.g. F405, F722, AT32F435">
                      <input
                        type="text"
                        value={form.mcu}
                        onChange={(e) => setForm({ ...form, mcu: e.target.value })}
                        placeholder="F405"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Video Standard">
                      <select
                        value={form.videoStandard}
                        onChange={(e) => setForm({ ...form, videoStandard: e.target.value })}
                        className={inputClass}
                      >
                        <option value="">N/A</option>
                        {VIDEO_STANDARDS.map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>
              </FormCard>
            </div>

            {/* Vendor & Dropship Settings */}
            <div className="space-y-6">
              <FormCard title="Vendor & Dropship Settings" icon={Store} accent="emerald">
                <div className="space-y-4">
                  <Field label="Vendor Name" required hint="e.g. GetFPV, Banggood, AliExpress">
                    <input
                      type="text"
                      value={form.vendorName}
                      onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                      placeholder="GetFPV"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Supplier Product Page URL" required>
                    <input
                      type="text"
                      value={form.supplierUrl}
                      onChange={(e) => setForm({ ...form, supplierUrl: e.target.value })}
                      placeholder="https://getfpv.com/..."
                      className={inputClass}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Buy Price (Cost)">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={form.buyPrice}
                          onChange={(e) => setForm({ ...form, buyPrice: e.target.value })}
                          placeholder="25.00"
                          className={cn(inputClass, 'pl-6')}
                        />
                      </div>
                    </Field>
                    <Field label="Sell Price (Retail)">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={form.sellPrice}
                          onChange={(e) => setForm({ ...form, sellPrice: e.target.value })}
                          placeholder="39.99"
                          className={cn(inputClass, 'pl-6')}
                        />
                      </div>
                    </Field>
                  </div>

                  {/* Live margin indicator */}
                  <div className={cn(
                    'rounded-lg border p-3 transition-all',
                    marginPreview.valid && marginPreview.pct >= 15
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : marginPreview.valid && marginPreview.pct < 15
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-slate-800/40 border-slate-700/40'
                  )}>
                    {marginPreview.valid ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={cn(
                            'text-lg font-bold',
                            marginPreview.pct >= 15 ? 'text-emerald-400' : 'text-red-400'
                          )}>
                            {marginPreview.pct.toFixed(1)}%
                          </p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Profit Margin</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-slate-200">
                            +${marginPreview.profit.toFixed(2)}
                          </p>
                          <p className="text-[10px] text-slate-500">per unit</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 text-center py-1">
                        Enter buy & sell prices to see margin
                      </p>
                    )}
                    {marginPreview.valid && marginPreview.pct < 15 && (
                      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-red-500/20">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                        <p className="text-[10px] text-red-400">Below 15% minimum margin threshold</p>
                      </div>
                    )}
                  </div>

                  <Field label="In Stock">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setForm({ ...form, inStock: !form.inStock })}
                        className={cn(
                          'relative w-11 h-6 rounded-full transition-colors',
                          form.inStock ? 'bg-emerald-500' : 'bg-slate-700'
                        )}
                      >
                        <span
                          className={cn(
                            'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                            form.inStock ? 'translate-x-5' : 'translate-x-0.5'
                          )}
                        />
                      </button>
                      <span className="text-sm text-slate-400">{form.inStock ? 'In stock' : 'Out of stock'}</span>
                    </div>
                  </Field>
                </div>
              </FormCard>

              {/* Submit button */}
              <button
                onClick={handleSubmitPart}
                disabled={submitting || !form.name || !form.vendorName || !form.supplierUrl}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all',
                  submitting || !form.name || !form.vendorName || !form.supplierUrl
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 shadow-lg shadow-cyan-500/20'
                )}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Part & Create Vendor Listing
              </button>
            </div>
          </div>
          </div>
        )}

        {/* === TAB 2: Inventory & Margin Manager === */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            {/* Search + filter */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={invSearch}
                  onChange={(e) => setInvSearch(e.target.value)}
                  placeholder="Search parts..."
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                <CategoryChip label="All" value="all" current={invCategory} onClick={setInvCategory} />
                {CATEGORY_OPTIONS.map((c) => (
                  <CategoryChip key={c.value} label={c.label} value={c.value} current={invCategory} onClick={setInvCategory} />
                ))}
              </div>
            </div>

            {invLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              </div>
            ) : filteredParts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Package className="w-10 h-10 text-slate-700 mb-3" />
                <p className="text-sm text-slate-500">No parts in inventory yet.</p>
                <button
                  onClick={() => setActiveTab('add-part')}
                  className="mt-3 text-xs text-cyan-400 hover:text-cyan-300"
                >
                  Add your first part &rarr;
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60">
                      <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Part</th>
                      <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-3 hidden md:table-cell">Vendor</th>
                      <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Buy Price</th>
                      <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Sell Price</th>
                      <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Margin</th>
                      <th className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Stock</th>
                      <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParts.flatMap((part) =>
                      part.vendor_listings.length === 0
                        ? [(
                            <tr key={part.id} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                              <PartCell part={part} />
                              <td className="px-3 py-3 text-xs text-slate-600 italic" colSpan={5}>No vendor listings — add one from the Add Part tab</td>
                            </tr>
                          )]
                        : part.vendor_listings.map((listing) => {
                          const buy = Number(listing.buy_price) || 0;
                          const sell = Number(listing.sell_price) || 0;
                          const profit = sell - buy;
                          const pct = sell > 0 ? (profit / sell) * 100 : 0;
                          const lowMargin = pct < 15;
                          const isEditing = editingListingId === listing.id;

                          return (
                            <tr key={listing.id} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                              <PartCell part={part} />
                              <td className="px-3 py-3 hidden md:table-cell">
                                <span className="text-xs text-slate-300">{listing.vendor_name}</span>
                              </td>
                              <td className="px-3 py-3 text-right">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editValues.buy_price || ''}
                                    onChange={(e) => setEditValues({ ...editValues, buy_price: e.target.value })}
                                    className="w-20 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-slate-200 text-right"
                                  />
                                ) : (
                                  <span className="text-xs text-slate-400">{buy > 0 ? `$${buy.toFixed(2)}` : '—'}</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-right">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editValues.sell_price || ''}
                                    onChange={(e) => setEditValues({ ...editValues, sell_price: e.target.value })}
                                    className="w-20 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-slate-200 text-right"
                                  />
                                ) : (
                                  <span className="text-xs font-medium text-slate-200">{sell > 0 ? `$${sell.toFixed(2)}` : '—'}</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-right">
                                {buy > 0 && sell > 0 ? (
                                  <span className={cn(
                                    'text-xs font-semibold',
                                    lowMargin ? 'text-red-400' : 'text-emerald-400'
                                  )}>
                                    {pct.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-600">—</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-center">
                                <button
                                  onClick={() => toggleStock(listing)}
                                  disabled={patchingId === listing.id}
                                  className={cn(
                                    'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full transition-colors',
                                    listing.in_stock
                                      ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                      : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                  )}
                                >
                                  {patchingId === listing.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : listing.in_stock ? (
                                    <Check className="w-3 h-3" />
                                  ) : (
                                    <X className="w-3 h-3" />
                                  )}
                                  {listing.in_stock ? 'In Stock' : 'Out'}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {listing.url && !isEditing && (
                                    <a
                                      href={listing.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-slate-800/60 transition-colors"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                  {isEditing ? (
                                    <>
                                      <button
                                        onClick={() => setEditingListingId(null)}
                                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/60"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => saveListingEdit(listing.id)}
                                        disabled={patchingId === listing.id}
                                        className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                      >
                                        {patchingId === listing.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => startEditListing(listing)}
                                      className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-slate-800/60 transition-colors"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* === TAB 3: Orders & Fulfillment Queue === */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            {/* Commission control */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
              <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                <Settings className="w-4 h-4 text-cyan-400" /> Platform Commission
              </h2>
              <p className="text-xs text-slate-500 mb-4">Percentage taken from each order.</p>
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={commissionInput}
                    onChange={(e) => setCommissionInput(e.target.value)}
                    className="w-full px-4 py-2.5 pr-10 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">%</span>
                </div>
                <button
                  onClick={handleSaveCommission}
                  disabled={savingCommission}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all',
                    savingCommission ? 'bg-slate-800 text-slate-500 cursor-wait' : 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25'
                  )}
                >
                  {savingCommission ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
              </div>
            </div>

            {/* Orders table */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="p-5 pb-3">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-cyan-400" /> Recent Orders
                </h2>
              </div>
              {stats && stats.recentOrders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y border-slate-800 bg-slate-800/20">
                        <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Date</th>
                        <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Status</th>
                        <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Total</th>
                        <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Commission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentOrders.map((o, i) => (
                        <tr key={i} className="border-b border-slate-800/50">
                          <td className="px-5 py-3 text-xs text-slate-400">
                            {new Date(o.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-3 py-3">
                            <span className={cn(
                              'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full capitalize',
                              o.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-400' :
                              o.status === 'shipped' ? 'bg-blue-500/10 text-blue-400' :
                              o.status === 'ordered_from_vendor' ? 'bg-amber-500/10 text-amber-400' :
                              'bg-slate-700/40 text-slate-400'
                            )}>
                              {o.status === 'shipped' && <Truck className="w-3 h-3" />}
                              {o.status === 'ordered_from_vendor' && <Zap className="w-3 h-3" />}
                              {o.status === 'delivered' && <Check className="w-3 h-3" />}
                              {o.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right text-xs text-slate-300 font-medium">${o.total.toFixed(2)}</td>
                          <td className="px-5 py-3 text-right text-xs text-emerald-400 font-medium">${o.commission.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-5 pb-8 text-center text-sm text-slate-500">
                  No orders yet. Orders will appear here after customers check out.
                </div>
              )}
            </div>

            {/* Builder management */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="p-5 pb-3">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-orange-400" /> Builder Management
                </h2>
              </div>
              {builders.length === 0 ? (
                <div className="px-5 pb-8 text-center text-sm text-slate-500">No builders registered.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y border-slate-800 bg-slate-800/20">
                        <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Builder</th>
                        <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Status</th>
                        <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Tier</th>
                        <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Fee</th>
                        <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Rating</th>
                        <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {builders.map((b) => {
                        const isApproved = !!b.stripe_account_id;
                        return (
                          <tr key={b.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                            <td className="px-5 py-3">
                              <p className="text-sm font-medium text-slate-200">{b.location}</p>
                              <p className="text-[10px] text-slate-500 max-w-[200px] truncate">{b.bio}</p>
                            </td>
                            <td className="px-3 py-3">
                              {isApproved ? (
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                  <BadgeCheck className="w-3 h-3" /> Approved
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                                  <AlertCircle className="w-3 h-3" /> Pending
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <select
                                value={b.subscription_status}
                                onChange={(e) => updateBuilder(b.id, 'subscription_status', e.target.value)}
                                className={cn(
                                  'text-xs px-2 py-1.5 rounded-lg border bg-slate-800/60 focus:outline-none focus:border-cyan-500/50',
                                  b.subscription_status === 'elite' ? 'border-amber-500/30 text-amber-300' :
                                  b.subscription_status === 'pro' ? 'border-cyan-500/30 text-cyan-300' :
                                  'border-slate-700/40 text-slate-400'
                                )}
                              >
                                <option value="free">Free</option>
                                <option value="pro">Pro</option>
                                <option value="elite">Elite</option>
                              </select>
                            </td>
                            <td className="px-3 py-3">
                              <div className="relative">
                                <span className="text-xs text-slate-500 absolute left-1.5 top-1/2 -translate-y-1/2">$</span>
                                <input
                                  type="number"
                                  step="5"
                                  min="0"
                                  defaultValue={b.assembly_fee}
                                  onBlur={(e) => {
                                    const v = parseFloat(e.target.value);
                                    if (!isNaN(v) && v !== b.assembly_fee) updateBuilder(b.id, 'assembly_fee', v);
                                  }}
                                  className="w-20 pl-5 pr-2 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                                />
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1">
                                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/30" />
                                <span className="text-xs text-slate-300">{Number(b.rating).toFixed(1)}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-right">
                              {isApproved ? (
                                <button
                                  onClick={() => updateBuilder(b.id, 'approved', false)}
                                  className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20"
                                >
                                  Revoke
                                </button>
                              ) : (
                                <button
                                  onClick={() => updateBuilder(b.id, 'approved', true)}
                                  className="text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
                                >
                                  Approve
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
          </div>
        )}
      </div>
    </div>
  );
}

// --- Helper components ---

const inputClass = 'w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors';

function TabButton({ active, onClick, icon: Icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
        active
          ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function FormCard({ title, icon: Icon, accent, children }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: 'cyan' | 'emerald';
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <Icon className={cn('w-4 h-4', accent === 'cyan' ? 'text-cyan-400' : 'text-emerald-400')} />
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, required, hint, children }: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-slate-600 mt-1">{hint}</p>}
    </div>
  );
}

function MiniStat({ label, value, icon: Icon }: {
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

function CategoryChip({ label, value, current, onClick }: {
  label: string;
  value: string;
  current: string;
  onClick: (v: string) => void;
}) {
  return (
    <button
      onClick={() => onClick(value)}
      className={cn(
        'text-xs px-3 py-1.5 rounded-lg border transition-all',
        current === value
          ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
      )}
    >
      {label}
    </button>
  );
}

function PartCell({ part }: { part: InventoryPart }) {
  return (
    <td className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 shrink-0 rounded-lg bg-slate-800 border border-slate-700/40 flex items-center justify-center overflow-hidden">
          {part.image_url ? (
            <img
              src={part.image_url}
              alt={part.name}
              className="w-full h-full object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <Package className="w-4 h-4 text-slate-600" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate max-w-[200px]">{part.name}</p>
          <p className="text-[10px] text-slate-500 capitalize">{part.category.replace('_', ' ')}</p>
        </div>
      </div>
    </td>
  );
}
