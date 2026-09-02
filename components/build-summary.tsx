'use client';

import { useState, useMemo, useRef } from 'react';
import {
  ShoppingCart, Truck, Wrench, Package, TrendingDown,
  Check, AlertTriangle, XCircle, Loader2, User, Star,
} from 'lucide-react';
import type { ComponentWithSpecs, Builder, SelectedParts, FulfillmentType } from '@/lib/supabase';
import type { DetailedCompatibilityResult } from '@/lib/compatibilityEngine';
import { generateRecommendations } from '@/lib/priceOptimizer';
import type { OptimizationConfig } from '@/lib/priceOptimizer';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import ManualGenerator from '@/components/manual-generator';

type Props = {
  components: ComponentWithSpecs[];
  builders: Builder[];
  selectedParts: SelectedParts;
  compatibility: DetailedCompatibilityResult;
  fulfillmentType: FulfillmentType;
  onFulfillmentChange: (type: FulfillmentType) => void;
  selectedBuilderId: string | null;
  onBuilderChange: (id: string | null) => void;
};

const PLATFORM_FEE_RATE = 0.05;

export default function BuildSummary({
  components,
  builders,
  selectedParts,
  compatibility,
  fulfillmentType,
  onFulfillmentChange,
  selectedBuilderId,
  onBuilderChange,
}: Props) {
  const [optimizing, setOptimizing] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [orderResult, setOrderResult] = useState<{ success: boolean; message: string } | null>(null);
  const checkoutRef = useRef(false);

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

  const shippingTotal = useMemo(
    () => selectedComponents.reduce((sum, { component }) => sum + Number(component.shipping_cost || 0), 0),
    [selectedComponents]
  );

  const maxShippingDays = useMemo(() => {
    if (selectedComponents.length === 0) return 0;
    return Math.max(...selectedComponents.map(({ component }) => component.shipping_days));
  }, [selectedComponents]);

  const builderFee = useMemo(() => {
    if (fulfillmentType !== 'builder' || !selectedBuilderId) return 0;
    const builder = builders.find((b) => b.id === selectedBuilderId);
    return builder ? Number(builder.assembly_fee) : 0;
  }, [fulfillmentType, selectedBuilderId, builders]);

  const platformFee = useMemo(
    () => (partsTotal + shippingTotal + builderFee) * PLATFORM_FEE_RATE,
    [partsTotal, shippingTotal, builderFee]
  );

  const grandTotal = partsTotal + shippingTotal + builderFee + platformFee;

  const { current, recommendations } = useMemo(
    () => generateRecommendations(selectedParts, components),
    [selectedParts, components]
  );

  const handleOptimize = () => {
    setOptimizing(true);
    setShowRecommendations(false);
    setTimeout(() => {
      setOptimizing(false);
      setShowRecommendations(true);
    }, 1200);
  };

  const handleCheckout = async () => {
    if (!compatibility.compatible || ordering || checkoutRef.current) return;
    checkoutRef.current = true;
    setOrdering(true);
    setOrderResult(null);
    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedParts,
          fulfillmentType,
          builderId: fulfillmentType === 'builder' ? selectedBuilderId : null,
          builderFee,
          partsTotal,
          platformFee,
          grandTotal,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      if (data.sessionData) {
        const encoded = encodeURIComponent(JSON.stringify(data.sessionData));
        window.location.href = `/checkout?data=${encoded}`;
      } else {
        setOrderResult({ success: true, message: 'Order placed! Your build has been saved.' });
      }
    } catch (err) {
      setOrderResult({ success: false, message: 'Could not place order. Please try again.' });
    } finally {
      setOrdering(false);
      checkoutRef.current = false;
    }
  };

  const errorCount = compatibility.issues.filter((i) => i.level === 'error').length;

  return (
    <div
      className="flex flex-col h-full bg-slate-900/50 border-l border-slate-800 overflow-y-auto"
      style={{ maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}
    >
      {/* Fulfillment toggle */}
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Fulfillment</h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onFulfillmentChange('kit')}
            className={cn(
              'flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all',
              fulfillmentType === 'kit'
                ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:bg-slate-800/70'
            )}
          >
            <Package className="w-5 h-5" />
            <span className="text-sm font-semibold">DIY Kit</span>
            <span className="text-[10px] text-slate-500">Ships to you</span>
          </button>
          <button
            onClick={() => onFulfillmentChange('builder')}
            className={cn(
              'flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all',
              fulfillmentType === 'builder'
                ? 'bg-orange-500/15 border-orange-500/50 text-orange-300'
                : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:bg-slate-800/70'
            )}
          >
            <Wrench className="w-5 h-5" />
            <span className="text-sm font-semibold">Hire a Builder</span>
            <span className="text-[10px] text-slate-500">Pro assembly</span>
          </button>
        </div>

        {/* Builder selection */}
        {fulfillmentType === 'builder' && (
          <div className="mt-3 space-y-2">
            {builders.map((builder) => (
              <button
                key={builder.id}
                onClick={() => onBuilderChange(builder.id)}
                className={cn(
                  'w-full text-left p-3 rounded-xl border transition-all',
                  selectedBuilderId === builder.id
                    ? 'bg-orange-500/10 border-orange-500/50 ring-1 ring-orange-500/30'
                    : 'bg-slate-800/40 border-slate-700/40 hover:bg-slate-800/70'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-700">
                      <User className="w-4 h-4 text-slate-300" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{builder.location}</p>
                      <p className="text-xs text-slate-500 capitalize">
                        {builder.subscription_status} · {builder.rating}★
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-orange-300">${builder.assembly_fee}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{builder.bio}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Price/Shipping Optimizer */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Price Optimizer</h2>
          <button
            onClick={handleOptimize}
            disabled={optimizing || selectedComponents.length === 0}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {optimizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingDown className="w-3 h-3" />}
            {optimizing ? 'Analyzing...' : 'Optimize'}
          </button>
        </div>

        {/* Shipping estimate */}
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800/50 mb-2">
          <Truck className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-slate-300">
              Est. delivery: <span className="font-semibold text-slate-100">{maxShippingDays} days</span>
            </p>
            <p className="text-[10px] text-slate-500">Based on slowest part</p>
          </div>
        </div>

        {/* Optimization results: 3 recommended configurations */}
        {showRecommendations && recommendations.length > 0 && (
          <div className="space-y-2 mt-3">
            {current && (
              <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
                <span>Your current build</span>
                <span>${current.totalPrice.toFixed(2)} · {current.deliveryDays}d</span>
              </div>
            )}
            {recommendations.map((config) => (
              <RecommendationCard key={config.name} config={config} currentTotal={current?.totalPrice ?? null} />
            ))}
          </div>
        )}
        {showRecommendations && recommendations.length === 0 && (
          <div className="text-xs text-slate-500 text-center py-2">No components available to optimize.</div>
        )}
      </div>

      {/* Bill of Materials */}
      <div className="p-4 border-b border-slate-800 flex-1">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Bill of Materials ({selectedComponents.length}/9)
        </h2>
        {selectedComponents.length === 0 ? (
          <p className="text-xs text-slate-600 text-center py-6">Select parts to build your drone</p>
        ) : (
          <div className="space-y-1.5">
            {selectedComponents.map(({ category, component }) => (
              <div key={category} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-800/40">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-500 uppercase">{category.replace('_', ' ')}</p>
                  <p className="text-xs font-medium text-slate-200 truncate">{component.name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold text-slate-300">${Number(component.price).toFixed(2)}</p>
                  <p className="text-[9px] text-slate-500">+ ${Number(component.shipping_cost || 0).toFixed(2)} ship</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compatibility rules — per-rule status with red error alerts */}
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Compatibility Checks</h2>
        <div className="space-y-1.5">
          {compatibility.rules.map((rule) => {
            const hasErrors = rule.issues.some((issue) => issue.level === 'error');
            return (
              <div
                key={rule.id}
                className={cn(
                  'rounded-lg border p-2.5 transition-colors',
                  hasErrors
                    ? 'bg-red-500/10 border-red-500/40'
                    : 'bg-emerald-500/5 border-emerald-500/20'
                )}
              >
                <div className="flex items-center gap-2">
                  {hasErrors ? (
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  ) : (
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  )}
                  <span className={cn('text-xs font-medium', hasErrors ? 'text-red-300' : 'text-emerald-300')}>
                    {rule.label}
                  </span>
                </div>
                {hasErrors && (
                  <div className="mt-1.5 ml-6 space-y-1">
                    {rule.issues.map((issue, j) => (
                      <div key={j} className="flex items-start gap-1.5 text-xs text-red-300">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span>{issue.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {/* Missing-part warnings */}
          {compatibility.issues
            .filter((i) => i.level === 'warning')
            .map((issue, i) => (
              <div key={`w${i}`} className="flex items-start gap-2 text-xs p-2 rounded-lg bg-amber-500/10 text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{issue.message}</span>
              </div>
            ))}
        </div>
      </div>

      {/* AI Assembly Manual Generator */}
      <ManualGenerator
        selectedParts={selectedParts}
        components={components}
        compatible={compatibility.compatible}
      />

      {/* Checkout */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/80 sticky bottom-0">
        <div className="space-y-1 mb-3">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Parts subtotal</span>
            <span className="text-slate-200 font-medium">${partsTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Shipping</span>
            <span className="text-slate-200 font-medium">${shippingTotal.toFixed(2)}</span>
          </div>
          {builderFee > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Builder fee</span>
              <span className="text-orange-300 font-medium">${builderFee.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Platform fee (5%)</span>
            <span className="text-slate-200 font-medium">${platformFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm pt-1 border-t border-slate-700/50">
            <span className="text-slate-200 font-semibold">Total</span>
            <span className="text-cyan-300 font-bold text-lg">${grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {orderResult && (
          <div className={cn(
            'text-xs p-2 rounded-lg mb-2 text-center',
            orderResult.success ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
          )}>
            {orderResult.message}
          </div>
        )}

        <button
          onClick={handleCheckout}
          disabled={!compatibility.compatible || ordering || selectedComponents.length === 0}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all',
            compatibility.compatible && !ordering
              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 shadow-lg shadow-cyan-500/20'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          )}
        >
          {ordering ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
          {ordering ? 'Placing Order...' : `Checkout · $${grandTotal.toFixed(2)}`}
        </button>
        {!compatibility.compatible && selectedComponents.length > 0 && (
          <p className="text-[10px] text-red-400 text-center mt-1.5">
            {errorCount > 0 ? 'Fix compatibility errors before checkout' : 'Select all 9 parts to checkout'}
          </p>
        )}
      </div>
    </div>
  );
}

function RecommendationCard({ config, currentTotal }: { config: OptimizationConfig; currentTotal: number | null }) {
  const accentClass =
    config.name === 'Cheapest Deal'
      ? 'border-emerald-500/30 bg-emerald-500/5'
      : config.name === 'Fastest Delivery'
      ? 'border-cyan-500/30 bg-cyan-500/5'
      : 'border-amber-500/30 bg-amber-500/5';

  const accentText =
    config.name === 'Cheapest Deal'
      ? 'text-emerald-300'
      : config.name === 'Fastest Delivery'
      ? 'text-cyan-300'
      : 'text-amber-300';

  const savings = currentTotal != null ? currentTotal - config.totalPrice : null;

  return (
    <div className={cn('rounded-lg border p-2.5', accentClass)}>
      <div className="flex items-center justify-between mb-1">
        <span className={cn('text-xs font-semibold', accentText)}>{config.name}</span>
        {savings != null && savings > 0 && (
          <span className="text-[10px] font-bold text-emerald-400">Save ${savings.toFixed(2)}</span>
        )}
      </div>
      <p className="text-[10px] text-slate-500 mb-1.5">{config.description}</p>
      <div className="flex items-center gap-3 text-[10px] text-slate-400">
        <span className="font-semibold text-slate-200">${config.totalPrice.toFixed(2)}</span>
        <span className="flex items-center gap-1">
          <Truck className="w-2.5 h-2.5" /> {config.deliveryDays}d
        </span>
        <span className="flex items-center gap-1">
          <Star className="w-2.5 h-2.5" /> {config.avgQuality}/10
        </span>
      </div>
    </div>
  );
}
