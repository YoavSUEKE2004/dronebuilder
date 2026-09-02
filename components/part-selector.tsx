'use client';

import { useState, useMemo } from 'react';
import {
  Square, Fan, Zap, Cpu, Wind, BatteryCharging,
  Camera, Radio, Antenna, Star, ExternalLink, Check,
  Filter, X, ImageOff,
} from 'lucide-react';
import type { ComponentWithSpecs, SelectedParts } from '@/lib/supabase';
import type { CategoryKey } from '@/lib/types';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, typeof Square> = {
  Square, Fan, Zap, Cpu, Wind, BatteryCharging, Camera, Radio, Antenna,
};

const CATEGORIES: { key: CategoryKey; label: string; icon: string }[] = [
  { key: 'frame', label: 'Frame', icon: 'Square' },
  { key: 'motor', label: 'Motors', icon: 'Fan' },
  { key: 'esc', label: 'ESC', icon: 'Zap' },
  { key: 'flight_controller', label: 'Flight Controller', icon: 'Cpu' },
  { key: 'propeller', label: 'Propellers', icon: 'Wind' },
  { key: 'battery', label: 'Battery', icon: 'BatteryCharging' },
  { key: 'camera', label: 'Camera', icon: 'Camera' },
  { key: 'vtx', label: 'VTX', icon: 'Radio' },
  { key: 'receiver', label: 'Receiver', icon: 'Antenna' },
];

type FilterDef = {
  key: string;
  label: string;
  getValues: (components: ComponentWithSpecs[]) => string[];
  match: (comp: ComponentWithSpecs, value: string) => boolean;
};

const FILTER_DEFS: Record<string, FilterDef[]> = {
  frame: [
    {
      key: 'size',
      label: 'Frame Size',
      getValues: (comps) => {
        const sizes = new Set<string>();
        comps.forEach((c) => {
          const match = c.name.match(/(\d+(?:\.\d+)?)"\s*(?:Frame|frame)/);
          if (match) sizes.add(`${match[1]}"`);
        });
        return Array.from(sizes).sort((a, b) => parseFloat(a) - parseFloat(b));
      },
      match: (comp, value) => comp.name.includes(value),
    },
  ],
  motor: [
    {
      key: 'kv',
      label: 'KV Rating',
      getValues: (comps) => {
        const kvs = new Set<string>();
        comps.forEach((c) => {
          const match = c.name.match(/(\d+)KV/);
          if (match) {
            const kv = parseInt(match[1]);
            if (kv < 1500) kvs.add('Low KV (<1500)');
            else if (kv < 2500) kvs.add('Mid KV (1500-2500)');
            else kvs.add('High KV (>2500)');
          }
        });
        return Array.from(kvs).sort();
      },
      match: (comp, value) => {
        const match = comp.name.match(/(\d+)KV/);
        if (!match) return false;
        const kv = parseInt(match[1]);
        if (value.startsWith('Low')) return kv < 1500;
        if (value.startsWith('Mid')) return kv >= 1500 && kv < 2500;
        if (value.startsWith('High')) return kv >= 2500;
        return false;
      },
    },
    {
      key: 'voltage',
      label: 'Max Voltage',
      getValues: (comps) => {
        const volts = new Set<string>();
        comps.forEach((c) => {
          const v = c.electrical_specs?.max_voltage_s;
          if (v) {
            if (v <= 4) volts.add('4S max');
            else if (v <= 6) volts.add('6S max');
            else if (v <= 8) volts.add('8S max');
            else volts.add('12S max');
          }
        });
        return Array.from(volts).sort();
      },
      match: (comp, value) => {
        const v = comp.electrical_specs?.max_voltage_s;
        if (!v) return false;
        if (value.startsWith('4S')) return v <= 4;
        if (value.startsWith('6S')) return v <= 6 && v > 4;
        if (value.startsWith('8S')) return v <= 8 && v > 6;
        if (value.startsWith('12S')) return v > 8;
        return false;
      },
    },
  ],
  esc: [
    {
      key: 'current',
      label: 'Current Rating',
      getValues: (comps) => {
        const amps = new Set<string>();
        comps.forEach((c) => {
          const a = c.electrical_specs?.max_current_a;
          if (a) {
            if (a <= 20) amps.add('20A');
            else if (a <= 45) amps.add('45A');
            else if (a <= 60) amps.add('60A');
            else amps.add('80A');
          }
        });
        return Array.from(amps).sort((a, b) => parseInt(a) - parseInt(b));
      },
      match: (comp, value) => {
        const a = comp.electrical_specs?.max_current_a;
        if (!a) return false;
        const target = parseInt(value);
        return a === target;
      },
    },
    {
      key: 'voltage',
      label: 'Max Voltage',
      getValues: (comps) => {
        const volts = new Set<string>();
        comps.forEach((c) => {
          const v = c.electrical_specs?.max_voltage_s;
          if (v) {
            if (v <= 4) volts.add('4S max');
            else if (v <= 6) volts.add('6S max');
            else volts.add('8S max');
          }
        });
        return Array.from(volts).sort();
      },
      match: (comp, value) => {
        const v = comp.electrical_specs?.max_voltage_s;
        if (!v) return false;
        if (value.startsWith('4S')) return v <= 4;
        if (value.startsWith('6S')) return v <= 6 && v > 4;
        if (value.startsWith('8S')) return v <= 8 && v > 6;
        return false;
      },
    },
  ],
  flight_controller: [
    {
      key: 'mount',
      label: 'Mounting',
      getValues: (comps) => {
        const mounts = new Set<string>();
        comps.forEach((c) => {
          if (c.mounting_pattern) mounts.add(c.mounting_pattern);
        });
        return Array.from(mounts).sort();
      },
      match: (comp, value) => comp.mounting_pattern === value,
    },
  ],
  propeller: [
    {
      key: 'size',
      label: 'Diameter',
      getValues: (comps) => {
        const sizes = new Set<string>();
        comps.forEach((c) => {
          const match = c.name.match(/(\d+(?:\.\d+)?)"\s*Props/);
          if (match) sizes.add(`${match[1]}"`);
        });
        return Array.from(sizes).sort((a, b) => parseFloat(a) - parseFloat(b));
      },
      match: (comp, value) => comp.name.includes(value),
    },
  ],
  battery: [
    {
      key: 'scount',
      label: 'S-Count',
      getValues: (comps) => {
        const counts = new Set<string>();
        comps.forEach((c) => {
          const v = c.electrical_specs?.max_voltage_s;
          if (v) counts.add(`${v}S`);
        });
        return Array.from(counts).sort((a, b) => parseInt(a) - parseInt(b));
      },
      match: (comp, value) => {
        const v = comp.electrical_specs?.max_voltage_s;
        return v ? `${v}S` === value : false;
      },
    },
  ],
  camera: [
    {
      key: 'type',
      label: 'Signal Type',
      getValues: (comps) => {
        const types = new Set<string>();
        comps.forEach((c) => {
          const p = c.electrical_specs?.protocol;
          if (p) types.add(p);
        });
        return Array.from(types).sort();
      },
      match: (comp, value) => comp.electrical_specs?.protocol === value,
    },
  ],
  vtx: [
    {
      key: 'power',
      label: 'Output Power',
      getValues: (comps) => {
        const powers = new Set<string>();
        comps.forEach((c) => {
          const match = c.name.match(/(\d+)mW/);
          if (match) powers.add(`${match[1]}mW`);
        });
        return Array.from(powers).sort((a, b) => parseInt(a) - parseInt(b));
      },
      match: (comp, value) => comp.name.includes(value),
    },
  ],
  receiver: [
    {
      key: 'protocol',
      label: 'Protocol',
      getValues: (comps) => {
        const protos = new Set<string>();
        comps.forEach((c) => {
          const p = c.electrical_specs?.protocol;
          if (p) protos.add(p);
        });
        return Array.from(protos).sort();
      },
      match: (comp, value) => comp.electrical_specs?.protocol === value,
    },
  ],
};

type Props = {
  components: ComponentWithSpecs[];
  selectedParts: SelectedParts;
  onSelect: (category: string, componentId: string) => void;
};

export default function PartSelector({ components, selectedParts, onSelect }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>('frame');
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});
  const [showFilters, setShowFilters] = useState(true);

  const categoryComponents = useMemo(
    () => components.filter((c) => c.category === activeCategory),
    [components, activeCategory]
  );

  const filterDefs = FILTER_DEFS[activeCategory] || [];

  const availableFilters = useMemo(() => {
    return filterDefs.map((fdef) => ({
      ...fdef,
      values: fdef.getValues(categoryComponents),
    }));
  }, [filterDefs, categoryComponents]);

  const filtered = useMemo(() => {
    const catFilters = activeFilters[activeCategory];
    if (!catFilters || catFilters.size === 0) return categoryComponents;
    return categoryComponents.filter((comp) => {
      return filterDefs.every((fdef) => {
        const activeVals = Array.from(catFilters).filter((v) =>
          fdef.getValues(categoryComponents).some((fv) => fdef.match(comp, fv) && v === fv)
        );
        if (activeVals.length === 0) return true;
        return activeVals.some((v) => fdef.match(comp, v));
      });
    });
  }, [categoryComponents, activeFilters, activeCategory, filterDefs]);

  const activeIcon = ICON_MAP[CATEGORIES.find((c) => c.key === activeCategory)?.icon || 'Square'];

  const toggleFilter = (category: string, value: string) => {
    setActiveFilters((prev) => {
      const catSet = new Set(prev[category] || []);
      if (catSet.has(value)) catSet.delete(value);
      else catSet.add(value);
      return { ...prev, [category]: catSet };
    });
  };

  const clearFilters = (category: string) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      delete next[category];
      return next;
    });
  };

  const activeFilterCount = activeFilters[activeCategory]?.size || 0;

  return (
    <div className="flex flex-col h-full bg-slate-900/50 border-r border-slate-800">
      {/* Category tabs */}
      <div className="p-3 border-b border-slate-800">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Categories</h2>
        <div className="grid grid-cols-3 gap-1.5">
          {CATEGORIES.map((cat) => {
            const Icon = ICON_MAP[cat.icon];
            const isSelected = !!selectedParts[cat.key];
            const isActive = activeCategory === cat.key;
            const filterBadge = activeFilters[cat.key]?.size || 0;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-all relative',
                  isActive
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                    : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                )}
              >
                <div className="relative">
                  <Icon className="w-4 h-4" />
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900" />
                  )}
                </div>
                <span className="text-[10px] leading-tight text-center">{cat.label}</span>
                {filterBadge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center text-[8px] font-bold text-white">
                    {filterBadge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Attribute Filters */}
      {availableFilters.length > 0 && (
        <div className="border-b border-slate-800">
          <div className="flex items-center justify-between px-3 py-2">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200 transition-colors"
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[9px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={() => clearFilters(activeCategory)}
                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          {showFilters && (
            <div className="px-3 pb-3 space-y-2.5">
              {availableFilters.map((fdef) => (
                <div key={fdef.key}>
                  <p className="text-[10px] font-medium text-slate-500 mb-1.5">{fdef.label}</p>
                  <div className="flex flex-wrap gap-1">
                    {fdef.values.map((val) => {
                      const isActive = activeFilters[activeCategory]?.has(val);
                      return (
                        <button
                          key={val}
                          onClick={() => toggleFilter(activeCategory, val)}
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
          )}
        </div>
      )}

      {/* Component list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-600 text-center py-6">No parts match these filters</p>
        ) : (
          filtered.map((comp) => {
            const isSelected = selectedParts[activeCategory] === comp.id;
            const specs = comp.electrical_specs;
            return (
              <button
                key={comp.id}
                onClick={() => onSelect(activeCategory, comp.id)}
                className={cn(
                  'w-full text-left p-3 rounded-xl border transition-all group',
                  isSelected
                    ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/30'
                    : 'bg-slate-800/40 border-slate-700/40 hover:border-slate-600 hover:bg-slate-800/70'
                )}
              >
                <div className="flex items-start gap-3 mb-1.5">
                  <PartImage src={comp.image_url} alt={comp.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className={cn(
                          'text-sm font-semibold truncate',
                          isSelected ? 'text-cyan-300' : 'text-slate-200'
                        )}>
                          {comp.name}
                        </h3>
                        <p className="text-xs text-slate-500">{comp.store_name}</p>
                      </div>
                      {isSelected && (
                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500/20">
                          <Check className="w-3 h-3 text-cyan-300" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Specs grid */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <SpecChip label={`$${comp.price.toFixed(2)}`} />
                  <SpecChip label={`${comp.shipping_days}d ship`} />
                  <SpecChip label={`${comp.weight_g}g`} />
                  {comp.mounting_pattern && comp.mounting_pattern !== 'XT60' && comp.mounting_pattern !== '5mm shaft' && (
                    <SpecChip label={comp.mounting_pattern} />
                  )}
                  {specs?.max_voltage_s && (
                    <SpecChip label={`${specs.max_voltage_s}S max`} />
                  )}
                  {specs?.max_current_a && (
                    <SpecChip label={`${specs.max_current_a}A`} />
                  )}
                  {specs?.protocol && specs.protocol !== '' && (
                    <SpecChip label={specs.protocol} />
                  )}
                </div>

                {/* Quality + link */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          'w-2.5 h-2.5',
                          i < comp.quality_score
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-700'
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
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-cyan-400 transition-colors"
                  >
                    Store <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

const SPEC_TOOLTIPS: Record<string, string> = {
  KV: 'RPM per volt. Lower KV for 6S batteries, higher KV for 4S.',
  ELRS: 'ExpressLRS radio protocol — high range, low latency.',
  UART: 'Hardware serial ports on the Flight Controller for receiver, GPS, and VTX.',
};

const PLACEHOLDER_IMG = '/images/placeholder-part.svg';

function PartImage({ src, alt }: { src: string; alt: string }) {
  const [errored, setErrored] = useState(false);
  const imgSrc = !src || errored ? PLACEHOLDER_IMG : src;
  return (
    <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-center overflow-hidden">
      {errored ? (
        <ImageOff className="w-6 h-6 text-slate-600" />
      ) : (
        <img
          src={imgSrc}
          alt={alt}
          onError={() => setErrored(true)}
          className="w-full h-full object-contain"
          loading="lazy"
        />
      )}
    </div>
  );
}

function SpecChip({ label }: { label: string }) {
  const tooltipKey = Object.keys(SPEC_TOOLTIPS).find((key) => label.includes(key));
  const tooltip = tooltipKey ? SPEC_TOOLTIPS[tooltipKey] : undefined;
  return (
    <span
      title={tooltip}
      className={cn(
        'text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-700/50 text-slate-300',
        tooltip && 'cursor-help border border-slate-600/50 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors'
      )}
    >
      {label}
    </span>
  );
}
