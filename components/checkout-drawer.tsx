'use client';

import { useState, useMemo, useRef } from 'react';
import {
  ShoppingCart, Truck, Package, Check, AlertTriangle, XCircle,
  Loader2, User, Star, X, ExternalLink, DollarSign, TrendingUp,
} from 'lucide-react';
import type { ComponentWithSpecs, Builder, SelectedParts, FulfillmentType } from '@/lib/supabase';
import type { DetailedCompatibilityResult } from '@/lib/compatibilityEngine';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onClose: () => void;
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
const DROPSHIP_MARGIN = 0.15;

export default function CheckoutDrawer({
  open, onClose, components, builders, selectedParts, compatibility,
  fulfillmentType, onFulfillmentChange, selectedBuilderId, onBuilderChange,
}: Props) {
  const [ordering, setOrdering] = useState(false);
  const [orderResult, setOrderResult] = useState<{ success: boolean; message: string; vendorOrders?: any[] } | null>(null);
  const checkoutRef = useRef(false);

  const selectedComponents = useMemo(() => {
    return Object.entries(selectedParts)
      .filter(([, id]) => id && id !== 'skip')
      .map(([cat, id]) => ({ category: cat, component: components.find((c) => c.id === id)! }))
      .filter((x) => x.component);
  }, [selectedParts, components]);

  const partsCost = useMemo(
    () => selectedComponents.reduce((sum, { component }) => sum + Number(component.price), 0),
    [selectedComponents]
  );

  const sellPrice = useMemo(
    () => partsCost * (1 + DROPSHIP_MARGIN),
    [partsCost]
  );

  const margin = sellPrice - partsCost;

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

  const platformFee = (sellPrice + shippingTotal + builderFee) * PLATFORM_FEE_RATE;
  const grandTotal = sellPrice + shippingTotal + builderFee + platformFee;

  const errorCount = compatibility.issues.filter((i) => i.level === 'error').length;
  const warningCount = compatibility.issues.filter((i) => i.level === 'warning').length;

  const handleCheckout = async () => {
    if (!compatibility.compatible || ordering || checkoutRef.current) return;
    checkoutRef.current = true;
    setOrdering(true);
    setOrderResult(null);
    try {
      const res = await fetch('/api/fulfill-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedParts,
          customerDetails: { fulfillmentType, builderId: selectedBuilderId },
          totalPrice: grandTotal,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Order failed');
      setOrderResult({
        success: true,
        message: `Order placed! ${data.vendorOrders?.length || 0} vendor orders created.`,
        vendorOrders: data.vendorOrders,
      });
    } catch (err) {
      setOrderResult({
        success: false,
        message: err instanceof Error ? err.message : 'Could not place order. Please try again.',
      });
    } finally {
      setOrdering(false);
      checkoutRef.current = false;
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 h-full overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-cyan-400" />
            Checkout
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Compatibility summary */}
          <div className={cn(
            'rounded-xl border p-3',
            errorCount > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'
          )}>
            <div className="flex items-center gap-2">
              {errorCount > 0 ? (
                <XCircle className="w-4 h-4 text-red-400" />
              ) : (
                <Check className="w-4 h-4 text-emerald-400" />
              )}
              <span className={cn('text-sm font-semibold', errorCount > 0 ? 'text-red-300' : 'text-emerald-300')}>
                {errorCount > 0 ? `${errorCount} Compatibility Issues` : 'All Components Compatible'}
              </span>
            </div>
            {warningCount > 0 && errorCount === 0 && (
              <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {warningCount} warnings to review
              </p>
            )}
            {errorCount === 0 && warningCount === 0 && (
              <p className="text-[10px] text-emerald-400/70 mt-1">All 9 slots filled, zero conflicts detected.</p>
            )}
          </div>

          {/* Fulfillment toggle */}
          <div>
            <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Fulfillment</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onFulfillmentChange('kit')}
                className={cn(
                  'flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all',
                  fulfillmentType === 'kit'
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                    : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:bg-slate-800/70'
                )}
              >
                <Package className="w-4 h-4" />
                <span className="text-xs font-semibold">DIY Kit</span>
              </button>
              <button
                onClick={() => onFulfillmentChange('builder')}
                className={cn(
                  'flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all',
                  fulfillmentType === 'builder'
                    ? 'bg-orange-500/15 border-orange-500/50 text-orange-300'
                    : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:bg-slate-800/70'
                )}
              >
                <User className="w-4 h-4" />
                <span className="text-xs font-semibold">Pro Assembly</span>
              </button>
            </div>
          </div>

          {/* Builder selection */}
          {fulfillmentType === 'builder' && (
            <div className="space-y-2">
              {builders.map((builder) => (
                <button
                  key={builder.id}
                  onClick={() => onBuilderChange(builder.id)}
                  className={cn(
                    'w-full text-left p-2.5 rounded-xl border transition-all',
                    selectedBuilderId === builder.id
                      ? 'bg-orange-500/10 border-orange-500/50 ring-1 ring-orange-500/30'
                      : 'bg-slate-800/40 border-slate-700/40 hover:bg-slate-800/70'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-200">{builder.location}</p>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 text-amber-400" /> {builder.rating}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-orange-300">${builder.assembly_fee}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Itemized breakdown */}
          <div>
            <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Bill of Materials ({selectedComponents.length}/9)
            </h3>
            <div className="space-y-1.5">
              {selectedComponents.map(({ category, component }) => (
                <div key={category} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-800/40">
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-slate-500 uppercase">{category.replace('_', ' ')}</p>
                    <p className="text-xs font-medium text-slate-200 truncate">{component.name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-slate-300">${Number(component.price).toFixed(2)}</p>
                    <p className="text-[9px] text-slate-500">+${Number(component.shipping_cost || 0).toFixed(2)} ship</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Margin display */}
          <div className="rounded-lg bg-slate-800/30 border border-slate-700/30 p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Dropship Margin</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Parts cost</span>
              <span className="text-slate-300">${partsCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-slate-500">Sell price (+{DROPSHIP_MARGIN * 100}%)</span>
              <span className="text-emerald-300 font-medium">${sellPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs mt-1 pt-1 border-t border-slate-700/30">
              <span className="text-slate-400">Margin</span>
              <span className="text-emerald-400 font-bold">${margin.toFixed(2)}</span>
            </div>
          </div>

          {/* Order result */}
          {orderResult && (
            <div className={cn(
              'rounded-lg p-3 text-sm',
              orderResult.success ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'
            )}>
              <p className="font-medium">{orderResult.message}</p>
              {orderResult.vendorOrders && (
                <div className="mt-2 space-y-1">
                  {orderResult.vendorOrders.map((vo: any, i: number) => (
                    <div key={i} className="text-[10px] text-slate-400">
                      {vo.vendorName}: {vo.items.length} items · ${vo.totalCost.toFixed(2)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Totals + checkout button */}
          <div className="border-t border-slate-800 pt-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Parts subtotal</span>
              <span className="text-slate-200">${sellPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Shipping</span>
              <span className="text-slate-200">${shippingTotal.toFixed(2)}</span>
            </div>
            {builderFee > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Builder fee</span>
                <span className="text-orange-300">${builderFee.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Platform fee</span>
              <span className="text-slate-200">${platformFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm pt-1 border-t border-slate-700/50">
              <span className="text-slate-200 font-semibold">Total</span>
              <span className="text-cyan-300 font-bold text-lg">${grandTotal.toFixed(2)}</span>
            </div>
          </div>

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
            {ordering ? 'Placing Order...' : `Buy Complete Kit · $${grandTotal.toFixed(2)}`}
          </button>
          {!compatibility.compatible && selectedComponents.length > 0 && (
            <p className="text-[10px] text-red-400 text-center">
              {errorCount > 0 ? 'Fix compatibility errors before checkout' : 'Select all 9 parts to checkout'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
