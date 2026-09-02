'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CreditCard, Lock, ArrowLeft, Check, Loader2, XCircle,
  Store, Wrench, Building2, ShieldCheck, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type SessionData = {
  session_id: string;
  grand_total: number;
  parts_total: number;
  platform_fee: number;
  builder_fee: number;
  fulfillment_type: string;
  builder_id: string | null;
  vendor_totals: Record<string, { amount: number; parts: string[] }>;
  components: { id: string; name: string; price: number; store_name: string; image_url: string }[];
};

type Transfer = {
  destination: string;
  amount: number;
  type: string;
  status: string;
};

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [expiry, setExpiry] = useState('12 / 28');
  const [cvc, setCvc] = useState('123');
  const [email, setEmail] = useState('test@example.com');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; transfers?: Transfer[]; message?: string; error?: string } | null>(null);
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;
    const data = searchParams.get('data');
    if (data) {
      try {
        const parsed = JSON.parse(decodeURIComponent(data)) as SessionData;
        setSessionData(parsed);
        setLoading(false);
        return;
      } catch (e) {
        // fall through to redirect
      }
    }
    router.replace('/');
  }, [searchParams, router]);

  const vendorCount = useMemo(() => {
    if (!sessionData) return 0;
    return Object.keys(sessionData.vendor_totals).length;
  }, [sessionData]);

  const handlePay = async () => {
    if (!sessionData) return;
    setProcessing(true);
    setResult(null);
    try {
      const res = await fetch('/api/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardNumber, expiry, cvc, sessionData }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setResult({ success: false, error: data.error || 'Payment failed' });
      } else {
        setResult({ success: true, transfers: data.transfers, message: data.message });
      }
    } catch (err) {
      setResult({ success: false, error: 'Network error. Please try again.' });
    } finally {
      setProcessing(false);
    }
  };

  if (loading || !sessionData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  // SUCCESS SCREEN
  if (result?.success) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
            {/* Success header */}
            <div className="bg-gradient-to-r from-emerald-500/20 to-green-500/10 p-8 text-center border-b border-emerald-500/20">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-4 ring-4 ring-emerald-500/10">
                <Check className="w-8 h-8 text-emerald-400" strokeWidth={3} />
              </div>
              <h1 className="text-2xl font-bold text-white mb-1">Payment Successful</h1>
              <p className="text-sm text-slate-400">{result.message}</p>
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/50">
                <span className="text-xs text-slate-500">Payment ID</span>
                <span className="text-xs font-mono text-cyan-300">pi_test_{Date.now().toString().slice(-8)}</span>
              </div>
            </div>

            {/* Fund distribution */}
            <div className="p-6">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Fund Distribution (Stripe Connect)
              </h2>
              <div className="space-y-2.5">
                {result.transfers?.map((t, i) => {
                  const icon = t.type === 'parts_payment' ? Store
                    : t.type === 'assembly_fee' ? Wrench
                    : Building2;
                  const Icon = icon;
                  const colorClass = t.type === 'parts_payment' ? 'text-cyan-400 bg-cyan-500/10'
                    : t.type === 'assembly_fee' ? 'text-orange-400 bg-orange-500/10'
                    : 'text-emerald-400 bg-emerald-500/10';
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/30">
                      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', colorClass)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{t.destination}</p>
                        <p className="text-[10px] text-slate-500 capitalize">
                          {t.type.replace('_', ' ')} · <span className="text-emerald-400">{t.status}</span>
                        </p>
                      </div>
                      <span className="text-sm font-bold text-slate-200">${t.amount.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Total */}
              <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between items-center">
                <span className="text-sm text-slate-400">Total Charged</span>
                <span className="text-xl font-bold text-emerald-400">${sessionData.grand_total.toFixed(2)}</span>
              </div>
            </div>

            <div className="p-6 pt-0">
              <button
                onClick={() => router.push('/')}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:from-cyan-400 hover:to-blue-400 transition-all shadow-lg shadow-cyan-500/20"
              >
                Back to Configurator
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // CHECKOUT FORM
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Configurator
        </button>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>Mock Checkout — Test Mode</span>
        </div>
      </header>

      <div className="flex-1 flex items-start justify-center p-4 md:p-8 overflow-y-auto">
        <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6">
          {/* Left: Payment form */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden order-2 md:order-1">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
                  <CreditCard className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-lg font-bold text-white">Checkout</h1>
              </div>
              <p className="text-xs text-slate-500 mb-6 ml-10">Enter your payment details to complete your order</p>

              {result?.error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 mb-4">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className="text-xs text-red-300">{result.error}</span>
                </div>
              )}

              {/* Email */}
              <label className="block mb-4">
                <span className="text-xs font-medium text-slate-400 mb-1.5 block">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
                  placeholder="you@example.com"
                />
              </label>

              {/* Card number */}
              <label className="block mb-4">
                <span className="text-xs font-medium text-slate-400 mb-1.5 block">Card number</span>
                <div className="relative">
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 19);
                      const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
                      setCardNumber(formatted);
                    }}
                    className="w-full px-3 py-2.5 pr-10 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-colors font-mono"
                    placeholder="4242 4242 4242 4242"
                  />
                  <CreditCard className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </label>

              {/* Expiry + CVC */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <label className="block">
                  <span className="text-xs font-medium text-slate-400 mb-1.5 block">Expiry</span>
                  <input
                    type="text"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-colors font-mono"
                    placeholder="MM / YY"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-400 mb-1.5 block">CVC</span>
                  <input
                    type="text"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-colors font-mono"
                    placeholder="123"
                  />
                </label>
              </div>

              {/* Pay button */}
              <button
                onClick={handlePay}
                disabled={processing}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold transition-all',
                  processing
                    ? 'bg-slate-800 text-slate-500 cursor-wait'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 shadow-lg shadow-cyan-500/20'
                )}
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Pay ${sessionData.grand_total.toFixed(2)}
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 mt-4 text-[10px] text-slate-600">
                <ShieldCheck className="w-3 h-3" />
                <span>Simulated payment — no real charges. Use 4242 4242 4242 4242 to succeed, 4000...2 to decline.</span>
              </div>
            </div>
          </div>

          {/* Right: Order summary */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden order-1 md:order-2">
            <div className="p-6">
              <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" /> Order Summary
              </h2>

              {/* Parts list */}
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
                {sessionData.components.map((comp) => (
                  <div key={comp.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-800/40">
                    <div className="w-8 h-8 rounded-md bg-slate-700/50 flex items-center justify-center flex-shrink-0 text-[10px] text-slate-500 font-bold">
                      {comp.store_name.slice(0, 3).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">{comp.name}</p>
                      <p className="text-[10px] text-slate-500">{comp.store_name}</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-300">${comp.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Price breakdown */}
              <div className="space-y-1.5 py-3 border-t border-slate-800">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Parts subtotal</span>
                  <span className="text-slate-200">${sessionData.parts_total.toFixed(2)}</span>
                </div>
                {sessionData.builder_fee > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Builder assembly fee</span>
                    <span className="text-orange-300">${sessionData.builder_fee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Platform commission (5%)</span>
                  <span className="text-slate-200">${sessionData.platform_fee.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center py-3 border-t border-slate-800">
                <span className="text-sm font-semibold text-slate-200">Total</span>
                <span className="text-xl font-bold text-cyan-300">${sessionData.grand_total.toFixed(2)}</span>
              </div>

              {/* Stripe Connect split visualization */}
              <div className="mt-4 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                  Payment Split (Stripe Connect)
                </p>
                <div className="space-y-2">
                  {Object.entries(sessionData.vendor_totals).map(([store, info]) => (
                    <div key={store} className="flex items-center gap-2 text-xs">
                      <Store className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                      <span className="text-slate-400 flex-1">{store}</span>
                      <span className="text-slate-300 font-medium">${info.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  {sessionData.builder_fee > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <Wrench className="w-3 h-3 text-orange-400 flex-shrink-0" />
                      <span className="text-slate-400 flex-1">Builder assembly</span>
                      <span className="text-slate-300 font-medium">${sessionData.builder_fee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs">
                    <Building2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    <span className="text-slate-400 flex-1">Platform commission</span>
                    <span className="text-slate-300 font-medium">${sessionData.platform_fee.toFixed(2)}</span>
                  </div>
                </div>
                <p className="text-[9px] text-slate-600 mt-2.5">
                  {vendorCount} vendor{vendorCount !== 1 ? 's' : ''} + platform · funds split automatically at checkout
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
