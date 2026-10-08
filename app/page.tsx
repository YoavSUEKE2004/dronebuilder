'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, type ComponentWithSpecs, type SelectedParts, type Builder, type FulfillmentType } from '@/lib/supabase';
import { validateDetailedCompatibility, type DetailedCompatibilityResult } from '@/lib/compatibilityEngine';
import AIAssistant from '@/components/ai-assistant';
import ConfigAudit from '@/components/config-audit';
import PerformanceDashboard from '@/components/performance-dashboard';
import CategoryModal from '@/components/category-modal';
import CheckoutDrawer from '@/components/checkout-drawer';
import { CATEGORIES } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Settings, ShoppingCart, Check, AlertTriangle, XCircle,
  Loader2, Cpu, Fan, Zap, Square, Wind, BatteryCharging,
  Camera, Radio, Antenna, Package, RefreshCw, Gauge,
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  frame: Square,
  motor: Fan,
  esc: Zap,
  flight_controller: Cpu,
  propeller: Wind,
  battery: BatteryCharging,
  camera: Camera,
  vtx: Radio,
  receiver: Antenna,
};

export default function ConfiguratorPage() {
  const [components, setComponents] = useState<ComponentWithSpecs[]>([]);
  const [builders, setBuilders] = useState<Builder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedParts, setSelectedParts] = useState<SelectedParts>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('kit');
  const [selectedBuilderId, setSelectedBuilderId] = useState<string | null>(null);
  const [categoryParts, setCategoryParts] = useState<ComponentWithSpecs[]>([]);

  // Load components and builders from Supabase
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [compRes, specRes, builderRes] = await Promise.all([
          supabase.from('components').select('*').order('quality_score', { ascending: false }),
          supabase.from('electrical_specs').select('*'),
          supabase.from('builders').select('*'),
        ]);

        if (compRes.data && specRes.data) {
          const specsMap = new Map(specRes.data.map((s) => [s.component_id, s]));
          const merged = compRes.data.map((c) => ({
            ...c,
            electrical_specs: specsMap.get(c.id) || null,
          })) as ComponentWithSpecs[];
          setComponents(merged);
        }

        if (builderRes.data) {
          setBuilders(builderRes.data as Builder[]);
        }
      } catch {
        // Supabase unavailable — app will show empty state
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const compatibility: DetailedCompatibilityResult = useMemo(
    () => validateDetailedCompatibility(selectedParts, components),
    [selectedParts, components]
  );

  const selectedCount = Object.values(selectedParts).filter((id) => id && id !== 'skip').length;
  const errorCount = compatibility.issues.filter((i) => i.level === 'error').length;

  const handleSelectPart = useCallback((category: string, componentId: string) => {
    setSelectedParts((prev) => ({ ...prev, [category]: componentId }));
    setActiveCategory(null);
  }, []);

  const handleBuildGenerated = useCallback((parts: SelectedParts) => {
    setSelectedParts(parts);
  }, []);

  const handlePartsLoaded = useCallback((parts: ComponentWithSpecs[]) => {
    setCategoryParts(parts);
  }, []);

  // Merge loaded components with any new parts from the category modal
  useEffect(() => {
    if (categoryParts.length > 0) {
      const existingIds = new Set(components.map((c) => c.id));
      const newParts = categoryParts.filter((p) => !existingIds.has(p.id));
      if (newParts.length > 0) {
        setComponents((prev) => [...prev, ...newParts]);
      }
    }
  }, [categoryParts, components]);

  const selectedComponents = useMemo(() => {
    return Object.entries(selectedParts)
      .filter(([, id]) => id && id !== 'skip')
      .map(([cat, id]) => ({ category: cat, component: components.find((c) => c.id === id)! }))
      .filter((x) => x.component);
  }, [selectedParts, components]);

  const partsTotal = useMemo(
    () => selectedComponents.reduce((sum, { component }) => sum + Number(component.price), 0),
    [selectedComponents]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
          <p className="text-sm text-slate-500">Loading component catalog...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Top header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white">FPV Configurator</h1>
          <span className="text-[10px] text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-full">
            {components.length} parts loaded
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {errorCount === 0 && selectedCount > 0 ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                <Check className="w-3.5 h-3.5" /> {selectedCount}/9 Compatible
              </span>
            ) : errorCount > 0 ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-red-400 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20">
                <XCircle className="w-3.5 h-3.5" /> {errorCount} Issues
              </span>
            ) : (
              <span className="text-xs text-slate-500">{selectedCount}/9 selected</span>
            )}
          </div>
          <button
            onClick={() => setCheckoutOpen(true)}
            disabled={selectedCount === 0}
            className={cn(
              'flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-all',
              selectedCount > 0
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 shadow-lg shadow-cyan-500/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            )}
          >
            <ShoppingCart className="w-4 h-4" />
            ${partsTotal.toFixed(2)}
          </button>
        </div>
      </header>

      {/* Main 3-column layout */}
      <div className="flex h-[calc(100vh-60px)]">
        {/* Left: Build slots */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* AI Assistant */}
          <div className="mb-6">
            <AIAssistant components={components} onBuildGenerated={handleBuildGenerated} />
          </div>

          {/* Component slots grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.key] || Package;
              const selectedId = selectedParts[cat.key];
              const comp = selectedId && selectedId !== 'skip'
                ? components.find((c) => c.id === selectedId)
                : null;
              const hasError = compatibility.rules.some(
                (r) => r.issues.some((i) => i.level === 'error' && i.message.toLowerCase().includes(cat.key.replace('_', ' ')))
              );

              return (
                <div
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={cn(
                    'relative p-4 rounded-xl border cursor-pointer transition-all group',
                    comp
                      ? hasError
                        ? 'bg-red-500/5 border-red-500/30 hover:border-red-500/50'
                        : 'bg-slate-800/40 border-slate-700/40 hover:border-slate-600'
                      : 'bg-slate-800/20 border-slate-700/30 hover:border-cyan-500/40 hover:bg-slate-800/40'
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={cn('w-4 h-4', comp ? 'text-cyan-400' : 'text-slate-500')} />
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{cat.label}</span>
                    </div>
                    {comp && (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </div>
                  {comp ? (
                    <div>
                      <p className="text-sm font-medium text-slate-200 truncate">{comp.name}</p>
                      <p className="text-xs text-cyan-400 mt-1 font-mono">${Number(comp.price).toFixed(2)}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Click to select {cat.label.toLowerCase()}...</p>
                  )}
                  {hasError && (
                    <AlertTriangle className="absolute top-2 right-2 w-3.5 h-3.5 text-red-400" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Compatibility rules summary */}
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" /> Real-Time Compatibility Checks
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {compatibility.rules.map((rule) => {
                const hasErrors = rule.issues.some((i) => i.level === 'error');
                const hasWarnings = rule.issues.some((i) => i.level === 'warning');
                return (
                  <div
                    key={rule.id}
                    className={cn(
                      'rounded-lg border p-2.5',
                      hasErrors ? 'bg-red-500/10 border-red-500/30' : hasWarnings ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/5 border-emerald-500/20'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {hasErrors ? (
                        <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      ) : hasWarnings ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      )}
                      <span className={cn(
                        'text-xs font-medium',
                        hasErrors ? 'text-red-300' : hasWarnings ? 'text-amber-300' : 'text-emerald-300'
                      )}>
                        {rule.label}
                      </span>
                    </div>
                    {rule.issues.filter((i) => i.level !== 'ok').map((issue, j) => (
                      <p key={j} className={cn('text-[10px] mt-1 ml-5', hasErrors ? 'text-red-300' : 'text-amber-300')}>
                        {issue.message}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Performance + Audit sidebar */}
        <div className="w-[340px] shrink-0 border-l border-slate-800 bg-slate-900/30 overflow-y-auto">
          <PerformanceDashboard selectedParts={selectedParts} components={components} />
          <ConfigAudit
            selectedParts={selectedParts}
            components={components}
            compatibility={compatibility}
          />
        </div>
      </div>

      {/* Category modal */}
      <CategoryModal
        isOpen={!!activeCategory}
        onClose={() => setActiveCategory(null)}
        onNext={() => {
          if (activeCategory) {
            const idx = CATEGORIES.findIndex((c) => c.key === activeCategory);
            const next = CATEGORIES[idx + 1];
            setActiveCategory(next ? next.key : null);
          }
        }}
        onShow3D={() => {}}
        onSkip={() => {
          if (activeCategory) {
            setSelectedParts((prev) => ({ ...prev, [activeCategory]: 'skip' }));
            setActiveCategory(null);
          }
        }}
        category={activeCategory || ''}
        categoryLabel={CATEGORIES.find((c) => c.key === activeCategory)?.label || ''}
        nextCategoryLabel={(() => {
          if (!activeCategory) return '';
          const idx = CATEGORIES.findIndex((c) => c.key === activeCategory);
          return CATEGORIES[idx + 1]?.label || '';
        })()}
        components={components}
        selectedParts={selectedParts}
        onSelect={handleSelectPart}
        frame={selectedParts.frame && selectedParts.frame !== 'skip' ? components.find((c) => c.id === selectedParts.frame) : undefined}
        onPartsLoaded={handlePartsLoaded}
      />

      {/* Checkout drawer */}
      <CheckoutDrawer
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        components={components}
        builders={builders}
        selectedParts={selectedParts}
        compatibility={compatibility}
        fulfillmentType={fulfillmentType}
        onFulfillmentChange={setFulfillmentType}
        selectedBuilderId={selectedBuilderId}
        onBuilderChange={setSelectedBuilderId}
      />
    </div>
  );
}
