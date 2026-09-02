'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  X, Star, ExternalLink, Check, Lock, Search, Loader2,
  Store, Zap, AlertCircle, ChevronDown, Filter, XCircle, ArrowRight, Box, ArrowLeft, PackageCheck,
} from 'lucide-react';
import type { ComponentWithSpecs, SelectedParts } from '@/lib/supabase';
import { isCompatibleWithFrame } from '@/lib/frameCompatibility';
import { cn } from '@/lib/utils';

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
};

const VENDOR_COLORS: Record<string, string> = {
  GetFPV: 'text-cyan-400 bg-cyan-500/10',
  Banggood: 'text-red-400 bg-red-500/10',
  RaceDayQuads: 'text-orange-400 bg-orange-500/10',
  Pyrodrone: 'text-emerald-400 bg-emerald-500/10',
  AliExpress: 'text-rose-400 bg-rose-500/10',
  Amazon: 'text-amber-400 bg-amber-500/10',
  Temu: 'text-pink-400 bg-pink-500/10',
};

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

  if (category === 'motor') {
    const kvs = new Set<string>();
    comps.forEach((c) => {
      const m = c.name.match(/(\d+)KV/);
      if (m) {
        const kv = parseInt(m[1]);
        if (kv < 1500) kvs.add('Low KV (<1500)');
        else if (kv < 2500) kvs.add('Mid KV (1500-2500)');
        else kvs.add('High KV (>2500)');
      }
    });
    if (kvs.size > 0) {
      sections.push({
        key: 'kv', label: 'KV Rating',
        values: Array.from(kvs).sort(),
        match: (c, v) => {
          const m = c.name.match(/(\d+)KV/);
          if (!m) return false;
          const kv = parseInt(m[1]);
          if (v.startsWith('Low')) return kv < 1500;
          if (v.startsWith('Mid')) return kv >= 1500 && kv < 2500;
          if (v.startsWith('High')) return kv >= 2500;
          return false;
        },
      });
    }
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

  if (category === 'esc') {
    const amps = new Set<string>();
    comps.forEach((c) => {
      const a = c.electrical_specs?.max_current_a;
      if (a) amps.add(`${a}A`);
    });
    if (amps.size > 1) {
      sections.push({
        key: 'current', label: 'Current Rating',
        values: Array.from(amps).sort((a, b) => parseInt(a) - parseInt(b)),
        match: (c, v) => {
          const a = c.electrical_specs?.max_current_a;
          return a ? `${a}A` === v : false;
        },
      });
    }
  }

  if (category === 'receiver') {
    const sensorTypes: { label: string; keywords: string[] }[] = [
      { label: 'LiDAR / Rangefinder', keywords: ['lidar', 'tfmini', 'rangefinder', 'altitude'] },
      { label: 'GPS / Rescue Modules', keywords: ['gps', 'm10', 'rescue', 'gnss'] },
      { label: 'Optical Flow Sensors', keywords: ['optical', 'flow'] },
      { label: 'Current / Power Sensors', keywords: ['current', 'power sensor', 'power monitor'] },
    ];
    const available = sensorTypes.filter((st) =>
      comps.some((c) => st.keywords.some((kw) => c.name.toLowerCase().includes(kw)))
    );
    if (available.length > 0) {
      sections.push({
        key: 'sensorType', label: 'Sensor Type',
        values: available.map((s) => s.label),
        match: (c, v) => {
          const st = sensorTypes.find((s) => s.label === v);
          if (!st) return false;
          return st.keywords.some((kw) => c.name.toLowerCase().includes(kw));
        },
      });
    }
  }

  const weightBuckets = new Set<string>();
  comps.forEach((c) => {
    const w = c.weight_g;
    if (w <= 10) weightBuckets.add('Ultra-light (<10g)');
    else if (w <= 30) weightBuckets.add('Light (10-30g)');
    else if (w <= 100) weightBuckets.add('Medium (30-100g)');
    else if (w <= 300) weightBuckets.add('Heavy (100-300g)');
    else weightBuckets.add('Very Heavy (>300g)');
  });
  if (weightBuckets.size > 1) {
    sections.push({
      key: 'weight', label: 'Weight',
      values: Array.from(weightBuckets).sort(),
      match: (c, v) => {
        const w = c.weight_g;
        if (v.startsWith('Ultra')) return w <= 10;
        if (v.startsWith('Light')) return w > 10 && w <= 30;
        if (v.startsWith('Medium')) return w > 30 && w <= 100;
        if (v.startsWith('Heavy')) return w > 100 && w <= 300;
        if (v.startsWith('Very')) return w > 300;
        return false;
      },
    });
  }

  const priceBuckets = new Set<string>();
  comps.forEach((c) => {
    const p = Number(c.price);
    if (p < 20) priceBuckets.add('Under $20');
    else if (p < 50) priceBuckets.add('$20 - $50');
    else if (p < 100) priceBuckets.add('$50 - $100');
    else priceBuckets.add('Over $100');
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

  const protos = new Set<string>();
  comps.forEach((c) => {
    const p = c.electrical_specs?.protocol;
    if (p && p !== '') protos.add(p);
  });
  if (protos.size > 1) {
    sections.push({
      key: 'protocol', label: 'Protocol / Signal',
      values: Array.from(protos).sort(),
      match: (c, v) => c.electrical_specs?.protocol === v,
    });
  }

  return sections;
}

export default function CategoryModal({
  isOpen, onClose, onNext, onShow3D, onSkip, category, categoryLabel, nextCategoryLabel, components, selectedParts, onSelect, frame,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [aiSearching, setAiSearching] = useState(false);
  const [aiResults, setAiResults] = useState<ComponentWithSpecs[] | null>(null);
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setAiResults(null);
      setActiveFilters({});
    }
  }, [isOpen, category]);

  const categoryComponents = useMemo(
    () => components.filter((c) => c.category === category),
    [components, category]
  );

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

    if (aiResults) {
      const aiIds = new Set(aiResults.map((r) => r.id));
      result = result.filter((c) => aiIds.has(c.id));
    }

    return result;
  }, [categoryComponents, activeFilters, searchQuery, aiResults, filterSections]);

  const handleAiSearch = async () => {
    if (!searchQuery.trim()) return;
    setAiSearching(true);
    setAiResults(null);
    try {
      await new Promise((r) => setTimeout(r, 800));
      const q = searchQuery.toLowerCase();
      const results = categoryComponents.filter((c) => {
        if (c.name.toLowerCase().includes(q)) return true;
        const kvMatch = c.name.match(/(\d+)KV/);
        if (kvMatch && q.includes(kvMatch[1])) return true;
        if (q.includes('high kv') && kvMatch && parseInt(kvMatch[1]) >= 2500) return true;
        if (q.includes('low kv') && kvMatch && parseInt(kvMatch[1]) < 1500) return true;
        if (q.includes('high efficiency') && c.quality_score >= 8) return true;
        if (q.includes('long range') && (c.electrical_specs?.protocol === 'CRSF' || c.name.includes('Crossfire'))) return true;
        if (q.includes('budget') && Number(c.price) < 35) return true;
        if (q.includes('premium') && c.quality_score >= 9) return true;
        if (q.includes('light') && c.weight_g < 30) return true;
        if (q.includes('digital') && c.electrical_specs?.protocol === 'Digital') return true;
        if (q.includes('analog') && c.electrical_specs?.protocol === 'Analog') return true;
        return false;
      });
      setAiResults(results.length > 0 ? results : categoryComponents);
    } catch {
      setAiResults(categoryComponents);
    } finally {
      setAiSearching(false);
    }
  };

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-6xl max-h-[88vh] bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white">{categoryLabel} Selection</h2>
            <p className="text-xs text-slate-500">
              {filtered.length} options available
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

        {/* Two-column body: left sidebar (filters) + right grid */}
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
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAiSearch(); }}
                  placeholder={`Search ${categoryLabel.toLowerCase()}...`}
                  className="w-full pl-10 pr-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
                />
              </div>
              <button
                onClick={handleAiSearch}
                disabled={aiSearching || !searchQuery.trim()}
                className={cn(
                  'flex items-center gap-1.5 w-full mt-2 px-3 py-2 rounded-lg text-xs font-medium transition-all justify-center',
                  aiSearching || !searchQuery.trim()
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25'
                )}
              >
                {aiSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                AI Search
              </button>
              {aiResults && (
                <p className="text-[10px] text-cyan-400 flex items-center gap-1 mt-2">
                  <Zap className="w-3 h-3" /> AI found {aiResults.length} result{aiResults.length !== 1 ? 's' : ''}
                  <button onClick={() => setAiResults(null)} className="ml-1 text-slate-500 hover:text-slate-300">clear</button>
                </p>
              )}
            </div>

            {/* Filters — independently scrollable */}
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
                <p className="text-xs text-slate-600 text-center py-8">No filters available for this category</p>
              )}
            </div>
          </div>

          {/* Right column: component grid */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filtered.map((comp) => {
                const isSelected = selectedId === comp.id;
                const compatible = isCompatibleWithFrame(comp, frame, category);
                const specs = comp.electrical_specs;
                const vendorColor = VENDOR_COLORS[comp.store_name] || 'text-slate-400 bg-slate-700/30';

                const itemTotal = Number(comp.price) + Number(comp.shipping_cost || 0);

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
                    <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-slate-800 border border-slate-700/40">
                      {comp.image_url ? (
                        <img src={comp.image_url} alt={comp.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Store className="w-6 h-6 text-slate-600" />
                        </div>
                      )}
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
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full', vendorColor)}>
                          <Store className="w-3 h-3" />
                          {comp.store_name}
                        </span>
                        <span className="text-[10px] text-slate-500">{comp.shipping_days}d shipping</span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <SpecChip label={`${Number(comp.price).toFixed(2)} + ${Number(comp.shipping_cost || 0).toFixed(2)} ship`} highlight />
                        <SpecChip label={`Total ${itemTotal.toFixed(2)}`} />
                        <SpecChip label={`${comp.weight_g}g`} />
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
                      <a
                        href={comp.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-cyan-400 transition-colors px-2 py-1 rounded-lg bg-slate-700/30 hover:bg-cyan-500/10"
                      >
                        View on {comp.store_name} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="w-8 h-8 text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">No parts match your search criteria</p>
              </div>
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
            {/* I already own this — skip toggle */}
            {(category === 'goggles' || category === 'remote') && (
              <button
                onClick={onSkip}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border',
                  isSkipped
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-800'
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
