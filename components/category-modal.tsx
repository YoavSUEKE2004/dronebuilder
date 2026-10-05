'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  X, Star, ExternalLink, Check, Lock, Search, Loader2,
  Store, Zap, AlertCircle, Filter, XCircle, ArrowRight, Box, ArrowLeft, PackageCheck,
  ChevronDown, Package,
} from 'lucide-react';
import type { ComponentWithSpecs, SelectedParts } from '@/lib/supabase';
import { isCompatibleWithFrame } from '@/lib/frameCompatibility';
import { cn } from '@/lib/utils';
import fallbackPartsData from '@/lib/fallback-parts.json';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onNext: () => void;
  onShow3D: () => void;
  onSkip: () => void;
  category: string;
  categoryLabel: string;
  nextCategoryLabel: string;
  components: ComponentWithSpecs[];
  selectedParts: SelectedParts;
  onSelect: (category: string, componentId: string) => void;
  frame: ComponentWithSpecs | undefined;
  onPartsLoaded?: (parts: ComponentWithSpecs[]) => void;
};

type ApiPart = {
  id: string;
  name: string;
  manufacturer: string;
  mpn: string;
  description: string | null;
  image_url: string | null;
  category: string;
  price: number | null;
  currency: string;
  source: string;
  offers: Array<{
    seller: string;
    url: string;
    inStock: number | null;
    price: number | null;
    currency: string;
  }>;
  specs: Record<string, unknown>;
  quality_score: number;
  stock_status: string;
};

type FallbackPart = {
  id: string;
  name: string;
  category: string;
  brand: string;
  mpn: string;
  price: number;
  store_name: string;
  product_url: string;
  image_url: string;
  dimensions_mm: string;
  mounting_pattern: string;
  weight_g: number;
  shipping_days: number;
  shipping_cost: number;
  quality_score: number;
  specs: Record<string, unknown>;
};

const FALLBACK_PARTS = fallbackPartsData as FallbackPart[];

function getLocalFallbackParts(category: string, query: string): ComponentWithSpecs[] {
  const q = query.toLowerCase().trim();
  return FALLBACK_PARTS.filter((p) => {
    if (category && p.category !== category) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.mpn.toLowerCase().includes(q)
    );
  }).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: p.price,
    store_name: p.store_name,
    product_url: p.product_url,
    image_url: p.image_url || '',
    dimensions_mm: p.dimensions_mm,
    mounting_pattern: p.mounting_pattern,
    weight_g: p.weight_g,
    shipping_days: p.shipping_days,
    shipping_cost: p.shipping_cost,
    quality_score: p.quality_score,
    created_at: new Date().toISOString(),
    electrical_specs: {
      component_id: p.id,
      max_voltage_s: (p.specs.max_voltage_s as number) ?? null,
      min_voltage_s: (p.specs.min_voltage_s as number) ?? null,
      max_current_a: (p.specs.max_current_a as number) ?? null,
      bec_output_v: (p.specs.bec_output_v as number) ?? null,
      protocol: String(p.specs.protocol || ''),
    },
  }));
}

const VENDOR_COLORS: Record<string, string> = {
  GetFPV: 'text-cyan-400 bg-cyan-500/10',
  Banggood: 'text-red-400 bg-red-500/10',
  RaceDayQuads: 'text-orange-400 bg-orange-500/10',
  Pyrodrone: 'text-emerald-400 bg-emerald-500/10',
  AliExpress: 'text-rose-400 bg-rose-500/10',
  Amazon: 'text-amber-400 bg-amber-500/10',
  Temu: 'text-pink-400 bg-pink-500/10',
};

function apiPartToComponent(p: ApiPart): ComponentWithSpecs {
  const specs = (p.specs || {}) as Record<string, unknown>;
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    price: p.price ?? 0,
    store_name: p.offers?.[0]?.seller || p.manufacturer || '',
    product_url: p.offers?.[0]?.url || '',
    image_url: p.image_url || '',
    dimensions_mm: String(specs.dimensions_mm || ''),
    mounting_pattern: String(specs.mounting_pattern || ''),
    weight_g: Number(specs.weight_g) || 0,
    shipping_days: Number(specs.shipping_days) || 0,
    shipping_cost: Number(specs.shipping_cost) || 0,
    quality_score: p.quality_score || 5,
    created_at: new Date().toISOString(),
    electrical_specs: {
      component_id: p.id,
      max_voltage_s: (specs.max_voltage_s as number) ?? null,
      min_voltage_s: (specs.min_voltage_s as number) ?? null,
      max_current_a: (specs.max_current_a as number) ?? null,
      bec_output_v: (specs.bec_output_v as number) ?? null,
      protocol: String(specs.protocol || ''),
    },
  };
}

type FilterSection = {
  key: string;
  label: string;
  values: string[];
  match: (comp: ComponentWithSpecs, value: string) => boolean;
};

function buildFilters(category: string, comps: ComponentWithSpecs[]): FilterSection[] {
  const sections: FilterSection[] = [];

  const sizes = new Set<string>();
  comps.forEach((c) => {
    const match = c.name.match(/(\d+(?:\.\d+)?)"\s*(?:Frame|frame|Props)/);
    if (match) sizes.add(`${match[1]}"`);
  });
  if (sizes.size > 1) {
    sections.push({
      key: 'size', label: 'Size',
      values: Array.from(sizes).sort((a, b) => parseFloat(a) - parseFloat(b)),
      match: (c, v) => c.name.includes(v),
    });
  }

  const volts = new Set<string>();
  comps.forEach((c) => {
    const v = c.electrical_specs?.max_voltage_s;
    if (v) volts.add(`${v}S max`);
  });
  if (volts.size > 1) {
    sections.push({
      key: 'voltage', label: 'Voltage / Cell Count',
      values: Array.from(volts).sort((a, b) => parseInt(a) - parseInt(b)),
      match: (c, v) => {
        const s = c.electrical_specs?.max_voltage_s;
        return s ? `${s}S max` === v : false;
      },
    });
  }

  const priceBuckets = new Set<string>();
  comps.forEach((c) => {
    const p = Number(c.price);
    if (p > 0) {
      if (p < 20) priceBuckets.add('Under $20');
      else if (p < 50) priceBuckets.add('$20 - $50');
      else if (p < 100) priceBuckets.add('$50 - $100');
      else priceBuckets.add('Over $100');
    }
  });
  if (priceBuckets.size > 1) {
    sections.push({
      key: 'price', label: 'Price',
      values: ['Under $20', '$20 - $50', '$50 - $100', 'Over $100'].filter((v) => priceBuckets.has(v)),
      match: (c, v) => {
        const p = Number(c.price);
        if (v === 'Under $20') return p < 20;
        if (v === '$20 - $50') return p >= 20 && p < 50;
        if (v === '$50 - $100') return p >= 50 && p < 100;
        if (v === 'Over $100') return p >= 100;
        return false;
      },
    });
  }

  const vendors = new Set<string>();
  comps.forEach((c) => { if (c.store_name) vendors.add(c.store_name); });
  if (vendors.size > 1) {
    sections.push({
      key: 'vendor', label: 'Vendor / Retailer',
      values: Array.from(vendors).sort(),
      match: (c, v) => c.store_name === v,
    });
  }

  return sections;
}

function PartSkeleton() {
  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-4 flex gap-3 animate-pulse">
      <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-slate-700/50" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-700/50 rounded w-3/4" />
        <div className="h-3 bg-slate-700/40 rounded w-1/2" />
        <div className="flex gap-1.5 mt-2">
          <div className="h-5 bg-slate-700/40 rounded w-16" />
          <div className="h-5 bg-slate-700/40 rounded w-12" />
          <div className="h-5 bg-slate-700/40 rounded w-10" />
        </div>
      </div>
    </div>
  );
}

const FETCH_TIMEOUT_MS = 5000;

export default function CategoryModal({
  isOpen, onClose, onNext, onShow3D, onSkip, category, categoryLabel, nextCategoryLabel, components, selectedParts, onSelect, frame, onPartsLoaded,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});

  const [apiParts, setApiParts] = useState<ComponentWithSpecs[]>([]);
  const [loadingParts, setLoadingParts] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [dataSource, setDataSource] = useState<string>('');
  const [isCustomSearch, setIsCustomSearch] = useState(false);

  // Refs to avoid stale closures and dependency churn
  const apiPartsRef = useRef<ComponentWithSpecs[]>([]);
  const onPartsLoadedRef = useRef(onPartsLoaded);
  const categoryRef = useRef(category);
  const fetchInProgressRef = useRef(false);

  // Keep refs in sync without triggering re-renders
  apiPartsRef.current = apiParts;
  onPartsLoadedRef.current = onPartsLoaded;
  categoryRef.current = category;

  const seededComponents = useMemo(
    () => components.filter((c) => c.category === category),
    [components, category]
  );

  const categoryComponents = useMemo(() => {
    if (hasFetched) return apiParts;
    return seededComponents;
  }, [apiParts, hasFetched, seededComponents]);

  // Stable fetch function — no dependency on apiParts or onPartsLoaded
  const fetchParts = useCallback(async (q: string, off: number, append: boolean) => {
    // Prevent concurrent fetches for the same category
    if (fetchInProgressRef.current) return;
    fetchInProgressRef.current = true;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoadingParts(true);
    }
    setWarning(null);
    setIsCustomSearch(!!q);

    const cat = categoryRef.current;

    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (cat) params.set('category', cat);
      params.set('limit', '20');
      params.set('offset', String(off));

      // 5-second timeout via AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const res = await fetch(`/api/parts?${params.toString()}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const data = (await res.json()) as { parts?: ApiPart[]; hasMore?: boolean; warning?: string; source?: string };
      const newParts = (data.parts || []).map(apiPartToComponent);

      let combined: ComponentWithSpecs[];
      if (append) {
        const existing = apiPartsRef.current;
        const existingIds = new Set(existing.map((p) => p.id));
        combined = [...existing, ...newParts.filter((p) => !existingIds.has(p.id))];
      } else {
        combined = newParts;
      }

      setApiParts(combined);

      if (onPartsLoadedRef.current) {
        onPartsLoadedRef.current(combined);
      }

      setHasMore(data.hasMore ?? false);
      setWarning(data.warning ?? null);
      setDataSource(data.source ?? '');
      setHasFetched(true);
    } catch (err) {
      // Network error or timeout — inject local fallback parts immediately
      const fallback = getLocalFallbackParts(cat, q);

      if (fallback.length > 0) {
        let combined: ComponentWithSpecs[];
        if (append) {
          const existing = apiPartsRef.current;
          const existingIds = new Set(existing.map((p) => p.id));
          combined = [...existing, ...fallback.filter((p) => !existingIds.has(p.id))];
        } else {
          combined = fallback;
        }

        setApiParts(combined);
        if (onPartsLoadedRef.current) {
          onPartsLoadedRef.current(combined);
        }
        setWarning('Live data unavailable — showing catalog fallback parts.');
        setDataSource('fallback');
      } else {
        setWarning('Failed to fetch parts. Please try again.');
        if (!append) setApiParts([]);
      }
      setHasMore(false);
      setHasFetched(true);
    } finally {
      setLoadingParts(false);
      setLoadingMore(false);
      fetchInProgressRef.current = false;
    }
  }, []); // Empty deps — stable forever, reads from refs

  // Initial load — ONLY when isOpen or category changes, never when fetchParts identity changes
  useEffect(() => {
    if (!isOpen) return;

    setSearchQuery('');
    setActiveFilters({});
    setApiParts([]);
    setOffset(0);
    setHasMore(false);
    setHasFetched(false);
    setWarning(null);
    setDataSource('');
    setIsCustomSearch(false);
    fetchParts('', 0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, category]);

  const handleSearch = useCallback(() => {
    setOffset(0);
    fetchParts(searchQuery, 0, false);
  }, [searchQuery, fetchParts]);

  const handleLoadMore = useCallback(() => {
    const newOffset = offset + 20;
    setOffset(newOffset);
    fetchParts(searchQuery, newOffset, true);
  }, [offset, searchQuery, fetchParts]);

  const filterSections = useMemo(
    () => buildFilters(category, categoryComponents),
    [category, categoryComponents]
  );

  const filtered = useMemo(() => {
    let result = categoryComponents;

    for (const [fkey, vals] of Object.entries(activeFilters)) {
      if (vals.size === 0) continue;
      const section = filterSections.find((s) => s.key === fkey);
      if (!section) continue;
      result = result.filter((c) => Array.from(vals).some((v) => section.match(c, v)));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.store_name.toLowerCase().includes(q) ||
        (c.electrical_specs?.protocol || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [categoryComponents, activeFilters, searchQuery, filterSections]);

  const toggleFilter = (fkey: string, value: string) => {
    setActiveFilters((prev) => {
      const catSet = new Set(prev[fkey] || []);
      if (catSet.has(value)) catSet.delete(value);
      else catSet.add(value);
      return { ...prev, [fkey]: catSet };
    });
  };

  const clearAllFilters = () => setActiveFilters({});

  const totalActiveFilters = Object.values(activeFilters).reduce((sum, s) => sum + s.size, 0);

  if (!isOpen) return null;

  const selectedId = selectedParts[category];
  const isSkipped = selectedId === 'skip';
  const showSkeletons = loadingParts && !hasFetched;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-6xl max-h-[88vh] bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white">{categoryLabel} Selection</h2>
            <p className="text-xs text-slate-500">
              {showSkeletons ? 'Loading parts...' : `${filtered.length} options available`}
              {dataSource === 'fallback' && <span className="ml-2 text-amber-400">· Catalog mode</span>}
              {dataSource === 'cache' && <span className="ml-2 text-emerald-400">· Cached</span>}
              {dataSource === 'nexar' && <span className="ml-2 text-cyan-400">· Live data</span>}
              {dataSource === 'stale-cache' && <span className="ml-2 text-amber-400">· Cached (offline)</span>}
              {frame && <span className="ml-2 text-cyan-400">· Filtered for your {frame.name}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onShow3D}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 transition-all"
            >
              <Box className="w-4 h-4" />
              Show 3D Model So Far
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Two-column body */}
        <div className="flex-1 min-h-0 flex">
          {/* Left column: search + filters */}
          <div className="w-[280px] flex-shrink-0 border-r border-slate-800 flex flex-col min-h-0">
            {/* Search */}
            <div className="px-4 py-3 border-b border-slate-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                  placeholder={`Search ${categoryLabel.toLowerCase()}...`}
                  className="w-full pl-10 pr-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={loadingParts || loadingMore}
                className={cn(
                  'flex items-center gap-1.5 w-full mt-2 px-3 py-2 rounded-lg text-xs font-medium transition-all justify-center',
                  loadingParts || loadingMore
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25'
                )}
              >
                {loadingParts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Search Parts
              </button>
            </div>

            {/* Filters */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
              {filterSections.length > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <Filter className="w-3.5 h-3.5" />
                      Filters
                      {totalActiveFilters > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[9px] font-bold">
                          {totalActiveFilters}
                        </span>
                      )}
                    </span>
                    {totalActiveFilters > 0 && (
                      <button
                        onClick={clearAllFilters}
                        className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <XCircle className="w-3 h-3" /> Clear All
                      </button>
                    )}
                  </div>
                  <div className="space-y-4">
                    {filterSections.map((section) => (
                      <div key={section.key}>
                        <p className="text-[10px] font-medium text-slate-500 mb-1.5 uppercase tracking-wider">{section.label}</p>
                        <div className="flex flex-wrap gap-1">
                          {section.values.map((val) => {
                            const isActive = activeFilters[section.key]?.has(val);
                            return (
                              <button
                                key={val}
                                onClick={() => toggleFilter(section.key, val)}
                                className={cn(
                                  'text-[10px] font-medium px-2 py-1 rounded-lg border transition-all',
                                  isActive
                                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                                    : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                                )}
                              >
                                {val}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-600 text-center py-8">No filters available</p>
              )}
            </div>
          </div>

          {/* Right column: component grid */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {/* Warning banner */}
            {warning && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {warning}
              </div>
            )}

            {/* Loading skeletons */}
            {showSkeletons && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <PartSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Parts grid */}
            {!showSkeletons && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {filtered.map((comp) => {
                    const isSelected = selectedId === comp.id;
                    const compatible = isCompatibleWithFrame(comp, frame, category);
                    const specs = comp.electrical_specs;
                    const vendorColor = VENDOR_COLORS[comp.store_name] || 'text-slate-400 bg-slate-700/30';

                    return (
                      <div
                        key={comp.id}
                        className={cn(
                          'relative rounded-xl border p-4 transition-all flex gap-3',
                          isSelected
                            ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/30'
                            : compatible
                            ? 'bg-slate-800/40 border-slate-700/40 hover:border-slate-600 hover:bg-slate-800/70 cursor-pointer'
                            : 'bg-slate-800/20 border-slate-700/30 opacity-60'
                        )}
                        onClick={() => compatible && onSelect(category, comp.id)}
                      >
                        {/* Product image */}
                        <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-slate-800 border border-slate-700/40 flex items-center justify-center">
                          {comp.image_url ? (
                            <img
                              src={comp.image_url}
                              alt={comp.name}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                                (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className={cn('w-full h-full items-center justify-center', comp.image_url ? 'hidden' : 'flex')}>
                            <Package className="w-6 h-6 text-slate-600" />
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {!compatible && (
                            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30">
                              <Lock className="w-3 h-3 text-red-400" />
                              <span className="text-[9px] font-medium text-red-400">Not Compatible</span>
                            </div>
                          )}

                          {isSelected && compatible && (
                            <div className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500/20">
                              <Check className="w-3 h-3 text-cyan-300" />
                            </div>
                          )}

                          <div className="mb-2 pr-20">
                            <h3 className={cn(
                              'text-sm font-semibold',
                              isSelected ? 'text-cyan-300' : 'text-slate-200'
                            )}>
                              {comp.name}
                            </h3>
                            {comp.store_name && (
                              <p className="text-[10px] text-slate-500 mt-0.5">{comp.store_name}</p>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {comp.price > 0 && (
                              <SpecChip label={`$${Number(comp.price).toFixed(2)}`} highlight />
                            )}
                            {comp.weight_g > 0 && <SpecChip label={`${comp.weight_g}g`} />}
                            {comp.mounting_pattern && comp.mounting_pattern !== 'XT60' && comp.mounting_pattern !== '5mm shaft' && comp.mounting_pattern !== 'N/A' && (
                              <SpecChip label={comp.mounting_pattern} />
                            )}
                            {specs?.max_voltage_s && <SpecChip label={`${specs.max_voltage_s}S max`} />}
                            {specs?.max_current_a && <SpecChip label={`${specs.max_current_a}A`} />}
                            {specs?.protocol && specs.protocol !== '' && <SpecChip label={specs.protocol} />}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 10 }).map((_, i) => (
                              <Star
                                key={i}
                                className={cn(
                                  'w-2.5 h-2.5',
                                  i < comp.quality_score ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                                )}
                              />
                            ))}
                            <span className="text-xs text-slate-500 ml-1">{comp.quality_score}/10</span>
                          </div>
                          {comp.product_url && (
                            <a
                              href={comp.product_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-cyan-400 transition-colors px-2 py-1 rounded-lg bg-slate-700/30 hover:bg-cyan-500/10"
                            >
                              View <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Load More button */}
                {hasMore && !loadingMore && (
                  <div className="flex justify-center mt-4">
                    <button
                      onClick={handleLoadMore}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-slate-800/60 border border-slate-700/50 text-slate-300 hover:bg-slate-800 hover:border-cyan-500/40 hover:text-cyan-300 transition-all"
                    >
                      <ChevronDown className="w-4 h-4" />
                      Search / Load More Parts
                    </button>
                  </div>
                )}

                {/* Loading more indicator */}
                {loadingMore && (
                  <div className="flex justify-center mt-4">
                    <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                  </div>
                )}

                {/* Empty state — only on explicit custom searches */}
                {filtered.length === 0 && !loadingParts && isCustomSearch && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertCircle className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-sm text-slate-500">No parts match your search criteria</p>
                    <button
                      onClick={() => { setSearchQuery(''); handleSearch(); }}
                      className="mt-3 text-xs text-cyan-400 hover:text-cyan-300"
                    >
                      Clear search and reload
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {isSkipped ? (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <PackageCheck className="w-3.5 h-3.5" /> {categoryLabel} marked as owned
              </span>
            ) : selectedId ? (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Check className="w-3.5 h-3.5" /> {categoryLabel} selected
              </span>
            ) : (
              <span>Select a {categoryLabel.toLowerCase()} to continue</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(category === 'goggles' || category === 'remote') && (
              <button
                onClick={onSkip}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border',
                  isSkipped
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-800/60 border border-slate-700/50 text-slate-300 hover:bg-slate-800'
                )}
              >
                <PackageCheck className="w-4 h-4" />
                {isSkipped ? 'Owned (Skip)' : 'I Already Own This'}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800/60 border border-slate-700/50 text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Done
            </button>
            {(selectedId || isSkipped) && (
              <button
                onClick={onNext}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
              >
                Next: {nextCategoryLabel}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecChip({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <span className={cn(
      'text-[10px] font-medium px-1.5 py-0.5 rounded-md',
      highlight ? 'bg-cyan-500/15 text-cyan-300' : 'bg-slate-700/50 text-slate-300'
    )}>
      {label}
    </span>
  );
}
