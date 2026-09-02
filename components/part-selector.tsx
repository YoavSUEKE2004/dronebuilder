import React, { useState, useMemo, memo } from 'react';
import { 
  Check, 
  ExternalLink, 
  Star, 
  ImageOff, 
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';

interface ComponentSpec {
  id: string;
  name: string;
  category: string;
  price: number;
  weight_g?: number;
  image_url?: string;
  shipping_days?: number;
  quality_score?: number; // 1-10
  store_url?: string;
  electrical_specs?: Record<string, any>;
  [key: string]: any;
}

interface FilterDef {
  id: string;
  label: string;
  getValues: (items: ComponentSpec[]) => string[];
  match: (item: ComponentSpec, selectedValue: string) => boolean;
}

// Fixed filter definitions with range-based matching
const FILTER_DEFS: Record<string, FilterDef[]> = {
  esc: [
    {
      id: 'current',
      label: 'Current Rating',
      getValues: (items) => {
        const set = new Set<string>();
        items.forEach((item) => {
          const current = item.electrical_specs?.max_current_a || parseInt(item.name.match(/(\d+)A/i)?.[1] || '0');
          if (current >= 80) set.add('80A+');
          else if (current >= 60) set.add('60A');
          else if (current >= 45) set.add('45A');
          else if (current >= 20) set.add('20A');
        });
        return Array.from(set);
      },
      match: (item, selected) => {
        const current = item.electrical_specs?.max_current_a || parseInt(item.name.match(/(\d+)A/i)?.[1] || '0');
        if (selected === '80A+') return current >= 80;
        if (selected === '60A') return current >= 60 && current < 80;
        if (selected === '45A') return current >= 45 && current < 60;
        if (selected === '20A') return current >= 20 && current < 45;
        return false;
      }
    }
  ],
  motor: [
    {
      id: 'kv',
      label: 'KV Band',
      getValues: () => ['Low (<1500)', 'Mid (1500-2500)', 'High (>2500)'],
      match: (item, selected) => {
        const kv = parseInt(item.name.match(/(\d+)KV/i)?.[1] || '0');
        if (selected === 'Low (<1500)') return kv > 0 && kv < 1500;
        if (selected === 'Mid (1500-2500)') return kv >= 1500 && kv <= 2500;
        if (selected === 'High (>2500)') return kv > 2500;
        return false;
      }
    }
  ]
};

// Memoized Image Component with Failure Recovery
const PartImage = memo(({ url, alt }: { url?: string; alt: string }) => {
  const [hasError, setHasError] = useState(false);

  if (!url || hasError) {
    return (
      <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center text-slate-500 rounded-md">
        <ImageOff className="w-6 h-6 mb-1 opacity-60" />
        <span className="text-[10px]">No Preview</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setHasError(true)}
      className="w-full h-full object-cover rounded-md transition-opacity duration-200"
    />
  );
});

PartImage.displayName = 'PartImage';

// Main Component
export const PartSelector: React.FC<{
  components: ComponentSpec[];
  selectedCategory: string;
  onSelectPart: (part: ComponentSpec) => void;
  selectedPartId?: string;
}> = ({ components, selectedCategory, onSelectPart, selectedPartId }) => {
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});

  // Reset category filters on change
  const categoryComponents = useMemo(() => {
    return components.filter((c) => c.category.toLowerCase() === selectedCategory.toLowerCase());
  }, [components, selectedCategory]);

  const availableFilters = FILTER_DEFS[selectedCategory.toLowerCase()] || [];

  // Filter Matching Engine
  const filteredComponents = useMemo(() => {
    if (Object.keys(activeFilters).length === 0) return categoryComponents;

    return categoryComponents.filter((item) => {
      return availableFilters.every((fDef) => {
        const selectedVals = activeFilters[fDef.id];
        if (!selectedVals || selectedVals.length === 0) return true;
        return selectedVals.some((val) => fDef.match(item, val));
      });
    });
  }, [categoryComponents, activeFilters, availableFilters]);

  const toggleFilter = (filterId: string, value: string) => {
    setActiveFilters((prev) => {
      const current = prev[filterId] || [];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];

      if (updated.length === 0) {
        const { [filterId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [filterId]: updated };
    });
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-6xl mx-auto p-4 bg-slate-900 text-slate-100 rounded-xl border border-slate-800">
      {/* Filter Sidebar / Top Bar */}
      {availableFilters.length > 0 && (
        <div className="flex flex-wrap gap-4 items-center p-3 bg-slate-950/50 rounded-lg border border-slate-800/80">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
            Filters
          </div>
          {availableFilters.map((fDef) => {
            const options = fDef.getValues(categoryComponents);
            return (
              <div key={fDef.id} className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-slate-400 mr-1">{fDef.label}:</span>
                {options.map((opt) => {
                  const isActive = activeFilters[fDef.id]?.includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => toggleFilter(fDef.id, opt)}
                      className={`text-xs px-2.5 py-1 rounded-md transition-all border ${
                        isActive
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-medium'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Part Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredComponents.map((item) => {
          const isSelected = item.id === selectedPartId;
          return (
            <div
              key={item.id}
              onClick={() => onSelectPart(item)}
              className={`relative flex gap-3 p-3 rounded-lg cursor-pointer border transition-all ${
                isSelected
                  ? 'bg-emerald-950/20 border-emerald-500 shadow-md shadow-emerald-950/30'
                  : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/80'
              }`}
            >
              <div className="w-20 h-20 shrink-0">
                <PartImage url={item.image_url} alt={item.name} />
              </div>

              <div className="flex flex-col justify-between flex-1 min-w-0">
                <div>
                  <h4 className="text-sm font-medium text-slate-200 truncate">{item.name}</h4>
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span className="text-xs text-slate-400 font-mono">
                      {item.quality_score ? `${item.quality_score}/10` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/40">
                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    ${item.price.toFixed(2)}
                  </span>

                  {item.store_url && (
                    <a
                      href={item.store_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-slate-400 hover:text-slate-200 transition-colors p-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {isSelected && (
                <div className="absolute top-2 right-2 bg-emerald-500 text-slate-950 rounded-full p-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};