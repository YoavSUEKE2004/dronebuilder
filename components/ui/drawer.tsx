'use client';

import { useEffect, useState } from 'react';
import { getPartsByCategory, CanonicalPart } from '@/lib/catalog';

interface ComponentDrawerProps {
  category: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectPart: (part: CanonicalPart) => void;
}

export default function ComponentDrawer({
  category,
  isOpen,
  onClose,
  onSelectPart,
}: ComponentDrawerProps) {
  const [parts, setParts] = useState<CanonicalPart[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && category) {
      setLoading(true);
      getPartsByCategory(category).then((data) => {
        setParts(data);
        setLoading(false);
      });
    }
  }, [isOpen, category]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-zinc-900 border-l border-zinc-800 p-6 z-50 overflow-y-auto shadow-2xl text-white">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold capitalize">
          Select {category.replace('_', ' ')}
        </h2>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white text-lg p-1"
        >
          ✕
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">
          Loading catalog from Supabase...
        </div>
      ) : parts.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          No components found for this category.
        </div>
      ) : (
        <div className="space-y-4">
          {parts.map((part) => {
            const lowestPrice = part.vendor_listings?.length
              ? Math.min(...part.vendor_listings.map((v) => v.price))
              : null;

            return (
              <div
                key={part.id}
                onClick={() => onSelectPart(part)}
                className="p-4 rounded-xl bg-zinc-800/60 border border-zinc-700/50 hover:border-blue-500 transition cursor-pointer"
              >
                <div className="font-semibold text-zinc-100">{part.name}</div>
                <div className="text-xs text-zinc-400 mt-1">{part.brand}</div>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {part.mounting_pattern && (
                    <span className="text-[10px] bg-zinc-700/80 px-2 py-0.5 rounded text-zinc-300">
                      Mount: {part.mounting_pattern}
                    </span>
                  )}
                  {part.voltage_range && (
                    <span className="text-[10px] bg-zinc-700/80 px-2 py-0.5 rounded text-zinc-300">
                      Voltage: {part.voltage_range}
                    </span>
                  )}
                  {part.mcu && (
                    <span className="text-[10px] bg-zinc-700/80 px-2 py-0.5 rounded text-zinc-300">
                      MCU: {part.mcu}
                    </span>
                  )}
                  {part.kv_rating && (
                    <span className="text-[10px] bg-zinc-700/80 px-2 py-0.5 rounded text-zinc-300">
                      {part.kv_rating} KV
                    </span>
                  )}
                  {part.continuous_current && (
                    <span className="text-[10px] bg-zinc-700/80 px-2 py-0.5 rounded text-zinc-300">
                      {part.continuous_current}A ESC
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center mt-4 pt-3 border-t border-zinc-700/40">
                  <span className="text-xs text-zinc-400">
                    {part.vendor_listings?.length || 0} seller(s) available
                  </span>
                  <span className="text-sm font-bold text-emerald-400">
                    {lowestPrice ? `$${lowestPrice.toFixed(2)}` : 'Out of Stock'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}